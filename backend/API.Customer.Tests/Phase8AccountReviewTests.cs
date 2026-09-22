using System.Security.Claims;
using API.Customer.Controllers;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace API.Customer.Tests;

public class Phase8AccountReviewTests
{
    [Fact]
    public async Task ReviewCreate_UsesExactOwnedCompletedOrderAndServerVariant()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var product = Product("KK-P8-REVIEW");
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var order = Order(userId: 41, code: "KK-P8-OWNED", status: "completed");
        order.Items.Add(new OrderItem
        {
            ProductId = product.Id,
            Product = product,
            ProductName = product.Name,
            ProductImage = product.Image,
            Price = product.Price,
            Size = "120",
            Color = "Tím",
            Quantity = 1,
        });
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReviewService(db);

        var foreignError = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(42, "User khác", new CreateReviewDTO
            {
                ProductId = product.Id,
                OrderId = order.Id,
                Rating = 5,
                Comment = "Sản phẩm tốt",
                Size = "120",
                Color = "Tím",
            }));
        Assert.Contains("không thuộc", foreignError.Message);

        var created = await service.CreateAsync(41, "Phụ huynh", new CreateReviewDTO
        {
            ProductId = product.Id,
            OrderId = order.Id,
            Rating = 5,
            Comment = "Vải mềm, bé mặc thoải mái",
            Size = "999",
            Color = "Màu client tự sửa",
            Images =
            [
                "/uploads/reviews/a.jpg",
                "/uploads/reviews/a.jpg",
                "/uploads/reviews/b.jpg",
                "/uploads/reviews/c.jpg",
                "/uploads/reviews/d.jpg",
                "/uploads/reviews/e.jpg",
            ],
        });

        Assert.Equal("120", created.Size);
        Assert.Equal("Tím", created.Color);
        Assert.Equal(4, created.Images.Count);
        Assert.Equal("pending", (await db.Reviews.SingleAsync()).Status);

        var duplicate = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(41, "Phụ huynh", new CreateReviewDTO
            {
                ProductId = product.Id,
                OrderId = order.Id,
                Rating = 4,
                Comment = "Đánh giá lần hai",
                Size = "120",
                Color = "Tím",
            }));
        Assert.Contains("đã đánh giá", duplicate.Message);
    }

    [Fact]
    public async Task OrderHasReviewed_IsVariantSpecific()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Users.Add(new User
        {
            Id = 51,
            Name = "Review Variant",
            Email = "variant@example.com",
            Role = "user",
        });

        var product = Product("KK-P8-VARIANT");
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var order = Order(51, "KK-P8-VARIANTS", "completed");
        order.Items.Add(new OrderItem
        {
            ProductId = product.Id,
            Product = product,
            ProductName = product.Name,
            ProductImage = product.Image,
            Price = product.Price,
            Size = "120",
            Color = "Tím",
            Quantity = 1,
        });
        order.Items.Add(new OrderItem
        {
            ProductId = product.Id,
            Product = product,
            ProductName = product.Name,
            ProductImage = product.Image,
            Price = product.Price,
            Size = "130",
            Color = "Cam",
            Quantity = 1,
        });
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        db.Reviews.Add(new Review
        {
            UserId = 51,
            ProductId = product.Id,
            OrderId = order.Id,
            CustomerName = "Review Variant",
            Rating = 5,
            Comment = "Đã review size 120",
            Status = "pending",
            Size = "120",
            Color = "Tím",
        });
        await db.SaveChangesAsync();

        var service = CreateOrderService(db);
        var dto = await service.GetOrderByIdAsync(51, order.Id);

        Assert.NotNull(dto);
        Assert.True(dto!.Items.Single(i => i.Size == "120").HasReviewed);
        Assert.False(dto.Items.Single(i => i.Size == "130").HasReviewed);
    }

    [Fact]
    public async Task DeleteAccount_ReleasesCartReservationAndClearsProtectedData()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var user = new User
        {
            Id = 61,
            Name = "Delete Me",
            Email = "delete@example.com",
            Phone = "0901234567",
            Role = "user",
            LoyaltyPoints = 500,
            MemberTier = "Silver",
        };
        db.Users.Add(user);

        var product = Product("KK-P8-DELETE");
        product.Stock = 10;
        product.Reserved = 2;
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var variant = new VariantStock
        {
            ProductId = product.Id,
            Size = "120",
            Color = "Tím",
            Stock = 10,
            Reserved = 2,
        };
        db.VariantStocks.Add(variant);

        db.CartItems.Add(new CartItem
        {
            UserId = user.Id,
            ProductId = product.Id,
            Product = product,
            Size = "120",
            Color = "Tím",
            Quantity = 2,
            ReservedUntil = DateTime.UtcNow.AddMinutes(15),
        });
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            Title = "Thông báo",
            Body = "Nội dung",
            Type = "system",
        });
        await db.SaveChangesAsync();

        var controller = new AccountController(
            db,
            new FakeEnvironment(),
            new CartService(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = AuthenticatedContext(user.Id),
            },
        };

        var response = await controller.DeleteAccount(new DeleteAccountDTO
        {
            Confirm = "DELETE",
        });

        Assert.IsType<OkObjectResult>(response);
        Assert.Empty(await db.CartItems.Where(c => c.UserId == user.Id).ToListAsync());
        Assert.Empty(await db.Notifications.Where(n => n.UserId == user.Id).ToListAsync());

        await db.Entry(product).ReloadAsync();
        await db.Entry(variant).ReloadAsync();
        await db.Entry(user).ReloadAsync();

        Assert.Equal(0, product.Reserved);
        Assert.Equal(0, variant.Reserved);
        Assert.Equal(0, user.LoyaltyPoints);
        Assert.Equal("Member", user.MemberTier);
        Assert.Equal($"deleted-{user.Id}@kaitokid.local", user.Email);
    }


    [Fact]
    public async Task Notifications_ReadAndDelete_RejectForeignNotification()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var own = new Notification
        {
            UserId = 71,
            Title = "Thông báo của tôi",
            Body = "Own",
            Type = "system",
        };
        var foreign = new Notification
        {
            UserId = 72,
            Title = "Thông báo user khác",
            Body = "Foreign",
            Type = "system",
        };
        db.Notifications.AddRange(own, foreign);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = AuthenticatedContext(71),
            },
        };

        Assert.IsType<NotFoundResult>(await controller.MarkRead(foreign.Id));
        Assert.IsType<NotFoundResult>(await controller.Remove(foreign.Id));

        Assert.IsType<OkObjectResult>(await controller.MarkRead(own.Id));
        await db.Entry(own).ReloadAsync();
        Assert.True(own.IsRead);

        Assert.IsType<NoContentResult>(await controller.Remove(own.Id));
        Assert.False(await db.Notifications.AnyAsync(n => n.Id == own.Id));
        Assert.True(await db.Notifications.AnyAsync(n => n.Id == foreign.Id));
    }

    private static DefaultHttpContext AuthenticatedContext(int userId)
    {
        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
                    "test")),
        };
    }

    private static Product Product(string sku) => new()
    {
        Name = sku,
        Category = "Áo bé",
        Gender = "Unisex",
        Price = 150_000m,
        Stock = 10,
        Reserved = 0,
        Status = "active",
        Image = "/products/placeholder.jpg",
        Description = "Test product",
        Sku = sku,
        Slug = sku.ToLowerInvariant(),
        Colors = "[\"Tím\",\"Cam\"]",
        Sizes = "[\"120\",\"130\"]",
    };

    private static Order Order(int userId, string code, string status) => new()
    {
        UserId = userId,
        OrderCode = code,
        CustomerName = "Phụ huynh",
        CustomerPhone = "0901234567",
        CustomerEmail = "parent@example.com",
        CustomerAddress = "Hà Nội",
        Subtotal = 150_000m,
        ShippingFee = 0,
        Total = 150_000m,
        PaymentMethod = "COD",
        Status = status,
    };

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

    private sealed class FakeEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "API.Customer.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
