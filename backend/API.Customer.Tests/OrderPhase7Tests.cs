using System.Security.Claims;
using API.Customer.Controllers;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Customer.Tests;

public class OrderPhase7Tests
{
    [Fact]
    public async Task GetOrderByIdAsync_ExposesServerAuthoritativeCanCancel()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var order = new Order
        {
            UserId = 10,
            OrderCode = "KK-P7-CANCEL",
            CustomerName = "Phụ huynh",
            CustomerPhone = "0901234567",
            CustomerEmail = "parent@example.com",
            CustomerAddress = "Hà Nội",
            Subtotal = 100_000m,
            ShippingFee = 20_000m,
            Total = 120_000m,
            PaymentMethod = "COD",
            Status = "pending",
            ShippingStatus = "ready_to_pick",
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var service = CreateOrderService(db);

        var cancellable = await service.GetOrderByIdAsync(10, order.Id);
        Assert.NotNull(cancellable);
        Assert.True(cancellable!.CanCancel);

        order.ShippingStatus = "picked";
        await db.SaveChangesAsync();

        var locked = await service.GetOrderByIdAsync(10, order.Id);
        Assert.NotNull(locked);
        Assert.False(locked!.CanCancel);
    }

    [Fact]
    public async Task ShippingTrack_ReturnsNotFound_WhenOrderBelongsToAnotherUser()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var order = new Order
        {
            UserId = 21,
            OrderCode = "KK-P7-TRACK",
            CustomerName = "Owner",
            CustomerPhone = "0901234567",
            CustomerEmail = "owner@example.com",
            CustomerAddress = "Hà Nội",
            Subtotal = 100_000m,
            ShippingFee = 20_000m,
            Total = 120_000m,
            PaymentMethod = "COD",
            Status = "confirmed",
            ShippingStatus = "picked",
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        db.Set<ShippingHistory>().Add(new ShippingHistory
        {
            OrderId = order.Id,
            Status = "picked",
            Description = "Đã lấy hàng",
            Location = "Kho trung chuyển",
        });
        await db.SaveChangesAsync();

        var foreignController = CreateShippingController(db, userId: 22);
        var foreignResult = await foreignController.Track(order.OrderCode);
        Assert.IsType<NotFoundObjectResult>(foreignResult.Result);

        var ownerController = CreateShippingController(db, userId: 21);
        var ownerResult = await ownerController.Track(order.OrderCode);
        var ok = Assert.IsType<OkObjectResult>(ownerResult.Result);
        var dto = Assert.IsType<ShippingTrackingDTO>(ok.Value);

        Assert.Equal(order.Id, dto.OrderId);
        Assert.Single(dto.History);
        Assert.Equal("picked", dto.History[0].TrangThai);
    }

    [Fact]
    public async Task ReorderAsync_RejectsOrderOwnedByAnotherUser()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var order = new Order
        {
            UserId = 31,
            OrderCode = "KK-P7-REORDER",
            CustomerName = "Owner",
            CustomerPhone = "0901234567",
            CustomerEmail = "owner@example.com",
            CustomerAddress = "Hà Nội",
            Subtotal = 0,
            ShippingFee = 0,
            Total = 0,
            PaymentMethod = "COD",
            Status = "completed",
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var cartService = new CartService(db);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => cartService.ReorderAsync(32, order.Id));

        Assert.Contains("không tồn tại", error.Message);
        Assert.Empty(await db.CartItems.Where(c => c.UserId == 32).ToListAsync());
    }

    private static ShippingController CreateShippingController(
        CustomerDbContext db,
        int userId)
    {
        var controller = new ShippingController(new NoopShippingService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(
                        new ClaimsIdentity(
                            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                            "test"))
                }
            }
        };
        return controller;
    }

    private static OrderService CreateOrderService(CustomerDbContext db)
        => new(
            db,
            new NoCouponService(),
            new ComboDiscountService(db),
            new NoopShippingService(),
            new NoopEmailService(),
            TestConfig.Create());

    private sealed class NoCouponService : ICouponService
    {
        public Task<CouponResultDTO> ValidateAsync(CouponValidateDTO dto)
            => Task.FromResult(new CouponResultDTO
            {
                IsValid = false,
                DiscountAmount = 0,
            });
    }

    private sealed class NoopShippingService : IShippingService
    {
        public Task<List<ShippingProviderDTO>> GetProvidersAsync()
            => Task.FromResult(new List<ShippingProviderDTO>());

        public Task<ShippingQuoteResponseDTO> QuoteAsync(ShippingQuoteRequestDTO req)
            => Task.FromResult(new ShippingQuoteResponseDTO());

        public Task<string> CreateShippingOrderAsync(
            int orderId,
            string provider,
            string serviceCode)
            => Task.FromResult("TEST");

        public Task AppendHistoryAsync(
            int orderId,
            string status,
            string? description,
            string? location)
            => Task.CompletedTask;
    }

    private sealed class NoopEmailService : IEmailService
    {
        public Task SendAsync(
            string toEmail,
            string subject,
            string htmlBody,
            CancellationToken ct = default)
            => Task.CompletedTask;
    }
}
