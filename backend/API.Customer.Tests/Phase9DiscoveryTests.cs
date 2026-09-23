using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Customer.Tests;

public class Phase9DiscoveryTests
{
    [Fact]
    public async Task ProductFilter_ByCollection_IsServerSideAndExact()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var firstCollection = new Collection { Name = "Ngày Đến Trường", Slug = "ngay-den-truong", IsActive = true };
        var secondCollection = new Collection { Name = "Cuối Tuần Phiêu Lưu", Slug = "cuoi-tuan-phieu-luu", IsActive = true };
        db.Collections.AddRange(firstCollection, secondCollection);
        await db.SaveChangesAsync();

        db.Products.AddRange(
            Product("KK-P9-COL-1", "Áo bé", firstCollection.Id),
            Product("KK-P9-COL-2", "Quần bé", secondCollection.Id));
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetAllAsync(new ProductFilterDTO
        {
            CollectionId = firstCollection.Id,
            Page = 1,
            PageSize = 20,
        });

        Assert.Single(result.Items);
        Assert.Equal("KK-P9-COL-1", result.Items[0].Sku);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task Recommendation_UsesWishlistSignal_AndExcludesCompletedPurchase()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var wished = Product("KK-P9-WISH", "Áo bé");
        var recommended = Product("KK-P9-REC", "Áo bé");
        recommended.IsBestSeller = true;
        recommended.SoldCount = 50;
        var purchased = Product("KK-P9-BOUGHT", "Áo bé");
        var unrelated = Product("KK-P9-OTHER", "Quần bé");
        unrelated.IsBestSeller = true;
        unrelated.SoldCount = 100;

        db.Products.AddRange(wished, recommended, purchased, unrelated);
        await db.SaveChangesAsync();

        db.WishlistItems.Add(new WishlistItem
        {
            UserId = 90,
            ProductId = wished.Id,
            Product = wished,
        });

        var order = new Order
        {
            UserId = 90,
            OrderCode = "KK-P9-COMPLETED",
            CustomerName = "Phụ huynh",
            CustomerPhone = "0901234567",
            CustomerEmail = "parent@example.com",
            CustomerAddress = "Hà Nội",
            Subtotal = purchased.Price,
            ShippingFee = 0,
            Discount = 0,
            Total = purchased.Price,
            PaymentMethod = "COD",
            Status = "completed",
        };
        order.Items.Add(new OrderItem
        {
            ProductId = purchased.Id,
            Product = purchased,
            ProductName = purchased.Name,
            ProductImage = purchased.Image,
            Price = purchased.Price,
            Size = "120",
            Color = "Tím",
            Quantity = 1,
        });
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetRecommendationsAsync(90, 3);

        Assert.True(result.IsPersonalized);
        Assert.Equal("wishlist-orders", result.Source);
        Assert.Contains(result.Items, item => item.Id == recommended.Id);
        Assert.DoesNotContain(result.Items, item => item.Id == purchased.Id);
        Assert.Equal(recommended.Id, result.Items[0].Id);
    }

    [Fact]
    public async Task Recommendation_GuestUsesBestSellerAndNewFallback()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var bestSeller = Product("KK-P9-BEST", "Áo bé");
        bestSeller.IsBestSeller = true;
        bestSeller.SoldCount = 80;
        var newArrival = Product("KK-P9-NEW", "Váy bé gái");
        newArrival.IsNew = true;
        newArrival.CreatedAt = DateTime.UtcNow.AddMinutes(1);

        db.Products.AddRange(bestSeller, newArrival);
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetRecommendationsAsync(null, 4);

        Assert.False(result.IsPersonalized);
        Assert.Equal("fallback", result.Source);
        Assert.Equal(bestSeller.Id, result.Items[0].Id);
        Assert.Contains(result.Items, item => item.Id == newArrival.Id);
    }


    [Fact]
    public async Task Recommendation_WithSignalButNoUsableCandidate_IsReportedAsFallback()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        var purchasedAndWished = Product("KK-P9-SIGNAL-ONLY", "Áo bé");
        var fallback = Product("KK-P9-FALLBACK", "Quần bé");
        fallback.IsBestSeller = true;
        fallback.SoldCount = 90;
        db.Products.AddRange(purchasedAndWished, fallback);
        await db.SaveChangesAsync();

        db.WishlistItems.Add(new WishlistItem
        {
            UserId = 91,
            ProductId = purchasedAndWished.Id,
            Product = purchasedAndWished,
        });

        var order = new Order
        {
            UserId = 91,
            OrderCode = "KK-P9-SIGNAL-ORDER",
            CustomerName = "Phụ huynh",
            CustomerPhone = "0901234567",
            CustomerEmail = "parent@example.com",
            CustomerAddress = "Hà Nội",
            Subtotal = purchasedAndWished.Price,
            ShippingFee = 0,
            Discount = 0,
            Total = purchasedAndWished.Price,
            PaymentMethod = "COD",
            Status = "completed",
        };
        order.Items.Add(new OrderItem
        {
            ProductId = purchasedAndWished.Id,
            Product = purchasedAndWished,
            ProductName = purchasedAndWished.Name,
            ProductImage = purchasedAndWished.Image,
            Price = purchasedAndWished.Price,
            Size = "120",
            Color = "Tím",
            Quantity = 1,
        });
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetRecommendationsAsync(91, 3);

        Assert.False(result.IsPersonalized);
        Assert.Equal("fallback", result.Source);
        Assert.Single(result.Items);
        Assert.Equal(fallback.Id, result.Items[0].Id);
    }

    private static Product Product(string sku, string category, int? collectionId = null) => new()
    {
        Name = sku,
        Category = category,
        Gender = "Unisex",
        Price = 180_000m,
        Stock = 10,
        Reserved = 0,
        Status = "active",
        Image = "/products/placeholder.jpg",
        Description = "Phase 9 test product",
        Sku = sku,
        Slug = sku.ToLowerInvariant(),
        CollectionId = collectionId,
        Colors = "[\"Tím\",\"Cam\"]",
        Sizes = "[\"120\",\"130\"]",
        CreatedAt = DateTime.UtcNow,
    };
}
