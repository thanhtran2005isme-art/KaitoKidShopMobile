using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Customer.Tests;

public class OrderPartialCheckoutTests
{
    [Fact]
    public async Task CreateOrderAsync_WithSelectedIds_OnlyProcessesSelectedCartRows()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Users.Add(User(42, "partial@example.com"));
        db.StoreSettings.Add(new StoreSetting
        {
            Code = "enableCOD",
            Value = "true",
            Group = "payment",
        });

        var selectedProduct = Product(
            "KK-PARTIAL-1",
            "Áo bé",
            120_000m,
            stock: 10,
            reserved: 2);
        var remainingProduct = Product(
            "KK-PARTIAL-2",
            "Quần bé",
            180_000m,
            stock: 8,
            reserved: 1);

        db.Products.AddRange(selectedProduct, remainingProduct);
        await db.SaveChangesAsync();

        var selectedCart = Cart(
            userId: 42,
            selectedProduct,
            quantity: 2,
            size: "120",
            color: "Tím");
        var remainingCart = Cart(
            userId: 42,
            remainingProduct,
            quantity: 1,
            size: "130",
            color: "Cam");

        db.CartItems.AddRange(selectedCart, remainingCart);
        await db.SaveChangesAsync();

        var service = CreateService(db, shippingFee: 30_000m);

        var order = await service.CreateOrderAsync(42, new CreateOrderDTO
        {
            CartItemIds = [selectedCart.Id],
            CustomerName = "Phụ huynh KaitoKid",
            CustomerPhone = "0901234567",
            CustomerEmail = "partial@example.com",
            CustomerAddress = "Giá trị legacy không được dùng để quote",
            PaymentMethod = "COD",
            ShippingProvider = "mock",
            ShippingServiceCode = "standard",
            ShippingFee = 1m,
            LeadTimeHours = 1,
            ShippingProvince = "Hà Nội",
            ShippingDistrict = "Cầu Giấy",
            ShippingWard = "Dịch Vọng",
            ShippingStreet = "12 Trần Thái Tông",
        });

        Assert.Single(order.Items);
        Assert.Equal(selectedProduct.Id, order.Items[0].ProductId);
        Assert.Equal(240_000m, order.Subtotal);
        Assert.Equal(30_000m, order.ShippingFee);
        Assert.Equal(270_000m, order.Total);
        Assert.Equal(48, order.LeadTimeHours);

        var remainingRows = await db.CartItems
            .AsNoTracking()
            .Where(c => c.UserId == 42)
            .ToListAsync();

        Assert.Single(remainingRows);
        Assert.Equal(remainingCart.Id, remainingRows[0].Id);

        await db.Entry(selectedProduct).ReloadAsync();
        await db.Entry(remainingProduct).ReloadAsync();

        Assert.Equal(8, selectedProduct.Stock);
        Assert.Equal(0, selectedProduct.Reserved);
        Assert.Equal(2, selectedProduct.SoldCount);

        Assert.Equal(8, remainingProduct.Stock);
        Assert.Equal(1, remainingProduct.Reserved);
        Assert.Equal(0, remainingProduct.SoldCount);
    }

    [Fact]
    public async Task CreateOrderAsync_WithoutCartItemIds_KeepsLegacyAllCartCheckout()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Users.Add(User(88, "legacy-web@example.com"));
        db.StoreSettings.Add(new StoreSetting
        {
            Code = "enableCOD",
            Value = "true",
            Group = "payment",
        });

        var first = Product(
            "KK-LEGACY-1",
            "Áo bé",
            100_000m,
            stock: 5,
            reserved: 1);
        var second = Product(
            "KK-LEGACY-2",
            "Quần bé",
            200_000m,
            stock: 5,
            reserved: 1);

        db.Products.AddRange(first, second);
        await db.SaveChangesAsync();

        db.CartItems.AddRange(
            Cart(88, first, 1, "120", "Tím"),
            Cart(88, second, 1, "130", "Cam"));
        await db.SaveChangesAsync();

        var service = CreateService(db, shippingFee: 25_000m);

        var order = await service.CreateOrderAsync(88, new CreateOrderDTO
        {
            CustomerName = "Web legacy",
            CustomerPhone = "0901234567",
            CustomerEmail = "legacy-web@example.com",
            CustomerAddress = "Hà Nội",
            PaymentMethod = "COD",
            ShippingProvider = "mock",
            ShippingServiceCode = "standard",
            ShippingProvince = "Hà Nội",
            ShippingDistrict = "Hoàn Kiếm",
            ShippingWard = "Hàng Bạc",
            ShippingStreet = "1 Đinh Tiên Hoàng",
        });

        Assert.Equal(2, order.Items.Count);
        Assert.Equal(300_000m, order.Subtotal);
        Assert.Equal(325_000m, order.Total);
        Assert.Empty(await db.CartItems.Where(c => c.UserId == 88).ToListAsync());
    }

    [Fact]
    public async Task CreateOrderAsync_WithMissingSelectedId_RejectsWithoutRemovingCart()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Users.Add(User(7, "invalid-selection@example.com"));

        var product = Product(
            "KK-PARTIAL-3",
            "Áo bé",
            150_000m,
            stock: 5,
            reserved: 1);

        db.Products.Add(product);
        await db.SaveChangesAsync();

        var cart = Cart(7, product, 1, "110", "Trắng");
        db.CartItems.Add(cart);
        await db.SaveChangesAsync();

        var service = CreateService(db, shippingFee: 20_000m);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateOrderAsync(7, new CreateOrderDTO
            {
                CartItemIds = [cart.Id, 999_999],
                CustomerName = "Phụ huynh",
                CustomerPhone = "0901234567",
                CustomerEmail = "invalid-selection@example.com",
                CustomerAddress = "Hà Nội",
                PaymentMethod = "COD",
                ShippingProvider = "mock",
                ShippingServiceCode = "standard",
                ShippingProvince = "Hà Nội",
                ShippingDistrict = "Ba Đình",
                ShippingWard = "Điện Biên",
                ShippingStreet = "1 Độc Lập",
            }));

        Assert.Contains("không còn trong giỏ", error.Message);
        Assert.Equal(1, await db.CartItems.CountAsync(c => c.UserId == 7));
        Assert.Empty(await db.Orders.Where(o => o.UserId == 7).ToListAsync());
    }

    private static OrderService CreateService(
        CustomerDbContext db,
        decimal shippingFee)
        => new(
            db,
            new NoCouponService(),
            new ComboDiscountService(db),
            new FakeShippingService(shippingFee),
            new NoopEmailService(),
            TestConfig.Create(new Dictionary<string, string?>
            {
                ["Frontend:BaseUrl"] = "http://localhost:5173",
            }));

    private static User User(int id, string email)
        => new()
        {
            Id = id,
            Name = "KaitoKid Test",
            Email = email,
            Phone = "0901234567",
            Role = "user",
        };

    private static Product Product(
        string sku,
        string category,
        decimal price,
        int stock,
        int reserved)
        => new()
        {
            Name = sku,
            Category = category,
            Gender = "Unisex",
            Price = price,
            Stock = stock,
            Reserved = reserved,
            Status = "active",
            Image = "/products/placeholder.jpg",
            Description = "Test product",
            Sku = sku,
            Slug = sku.ToLowerInvariant(),
            Colors = "[\"Tím\",\"Cam\",\"Trắng\"]",
            Sizes = "[\"110\",\"120\",\"130\"]",
        };

    private static CartItem Cart(
        int userId,
        Product product,
        int quantity,
        string size,
        string color)
        => new()
        {
            UserId = userId,
            ProductId = product.Id,
            Product = product,
            Size = size,
            Color = color,
            Quantity = quantity,
            ReservedUntil = DateTime.UtcNow.AddMinutes(10),
        };

    private sealed class NoCouponService : ICouponService
    {
        public Task<CouponResultDTO> ValidateAsync(CouponValidateDTO dto)
            => Task.FromResult(new CouponResultDTO
            {
                IsValid = false,
                DiscountAmount = 0,
            });
    }

    private sealed class FakeShippingService(decimal fee) : IShippingService
    {
        public Task<List<ShippingProviderDTO>> GetProvidersAsync()
            => Task.FromResult(new List<ShippingProviderDTO>
            {
                new()
                {
                    Code = "mock",
                    Name = "Mock Shipping",
                    Enabled = true,
                },
            });

        public Task<ShippingQuoteResponseDTO> QuoteAsync(
            ShippingQuoteRequestDTO req)
            => Task.FromResult(new ShippingQuoteResponseDTO
            {
                Success = true,
                Options =
                [
                    new ShippingQuoteOptionDTO
                    {
                        Provider = "mock",
                        ServiceCode = "standard",
                        ServiceName = "Tiêu chuẩn",
                        Fee = fee,
                        InsuranceFee = 0,
                        LeadTimeHours = 48,
                        DeliveryType = "standard",
                    },
                ],
            });

        public Task<string> CreateShippingOrderAsync(
            int orderId,
            string provider,
            string serviceCode)
            => Task.FromResult("TEST-TRACKING");

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
