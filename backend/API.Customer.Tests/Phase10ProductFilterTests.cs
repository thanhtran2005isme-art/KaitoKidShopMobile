using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using Xunit;

namespace API.Customer.Tests;

public class Phase10ProductFilterTests
{
    [Fact]
    public async Task ProductFilter_AgeGroupStyleRatingSizeAndColor_AreAppliedServerSide()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Products.AddRange(
            Product("KK-P10-KID", "Nu", "TreEm", "Dạo phố", 4.8, "[\"120\",\"130\"]", "[\"Tím\",\"Trắng\"]"),
            Product("KK-P10-ADULT", "Nu", "NguoiLon", "Dạo phố", 4.9, "[\"M\",\"L\"]", "[\"Tím\"]"),
            Product("KK-P10-LOW", "Nu", "TreEm", "Dạo phố", 3.2, "[\"120\"]", "[\"Tím\"]"));
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetAllAsync(new ProductFilterDTO
        {
            AgeGroup = "TreEm",
            Style = "Dạo phố",
            MinRating = 4,
            Sizes = "120",
            Colors = "Tím",
            Page = 1,
            PageSize = 20,
        });

        Assert.Single(result.Items);
        Assert.Equal("KK-P10-KID", result.Items[0].Sku);
    }

    [Fact]
    public async Task ProductFilter_MultipleSizesAndColors_UseAnyMatch()
    {
        using var testDb = new TestDb();
        var db = testDb.Context;

        db.Products.AddRange(
            Product("KK-P10-M", "Nam", "NguoiLon", "Basic", 4.5, "[\"M\"]", "[\"Đen\"]"),
            Product("KK-P10-120", "Nam", "TreEm", "Basic", 4.5, "[\"120\"]", "[\"Xanh\"]"),
            Product("KK-P10-NO", "Nam", "NguoiLon", "Basic", 4.5, "[\"XL\"]", "[\"Trắng\"]"));
        await db.SaveChangesAsync();

        var result = await new ProductService(db).GetAllAsync(new ProductFilterDTO
        {
            Sizes = "M,120",
            Colors = "Đen,Xanh",
            Page = 1,
            PageSize = 20,
        });

        Assert.Equal(2, result.TotalCount);
        Assert.Contains(result.Items, item => item.Sku == "KK-P10-M");
        Assert.Contains(result.Items, item => item.Sku == "KK-P10-120");
        Assert.DoesNotContain(result.Items, item => item.Sku == "KK-P10-NO");
    }

    private static Product Product(
        string sku,
        string gender,
        string ageGroup,
        string style,
        double rating,
        string sizes,
        string colors) => new()
    {
        Name = sku,
        Category = "Áo",
        Subcategory = "Áo thun",
        Gender = gender,
        AgeGroup = ageGroup,
        Style = style,
        Price = 300_000m,
        Stock = 10,
        Reserved = 0,
        Status = "active",
        Image = "/products/placeholder.jpg",
        Description = "Phase 10 filter test",
        Sku = sku,
        Slug = sku.ToLowerInvariant(),
        Rating = rating,
        Sizes = sizes,
        Colors = colors,
        CreatedAt = DateTime.UtcNow,
    };
}
