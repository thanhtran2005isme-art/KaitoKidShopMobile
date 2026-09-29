using System.Linq.Expressions;
using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class ProductService(CustomerDbContext db) : IProductService
{
    public async Task<PagedResult<ProductDTO>> GetAllAsync(ProductFilterDTO filter)
    {
        var query = db.Products.Where(p => p.Status == "active").AsQueryable();

        if (filter.CollectionId.HasValue)
            query = query.Where(p => p.CollectionId == filter.CollectionId.Value);

        if (!string.IsNullOrEmpty(filter.Category))
            query = query.Where(p => p.Category == filter.Category);

        if (!string.IsNullOrEmpty(filter.Subcategory))
            query = query.Where(p => p.Subcategory == filter.Subcategory);

        if (!string.IsNullOrEmpty(filter.Gender))
            query = query.Where(p => p.Gender == filter.Gender);

        if (!string.IsNullOrEmpty(filter.Style))
            query = query.Where(p => p.Style == filter.Style);

        if (!string.IsNullOrEmpty(filter.AgeGroup))
            query = query.Where(p => p.AgeGroup == filter.AgeGroup);

        if (!string.IsNullOrEmpty(filter.Search))
            query = query.Where(p => p.Name.Contains(filter.Search) || p.Description.Contains(filter.Search));

        if (filter.MinPrice.HasValue)
            query = query.Where(p => p.Price >= filter.MinPrice.Value);

        if (filter.MaxPrice.HasValue)
            query = query.Where(p => p.Price <= filter.MaxPrice.Value);

        if (filter.MinRating.HasValue)
            query = query.Where(p => p.Rating >= filter.MinRating.Value);

        query = ApplyJsonArrayAnyFilter(query, filter.Sizes, p => p.Sizes);
        query = ApplyJsonArrayAnyFilter(query, filter.Colors, p => p.Colors);

        if (filter.IsNew == true)
            query = query.Where(p => p.IsNew);

        if (filter.IsSale == true)
            query = query.Where(p => p.IsSale);

        if (filter.IsBestSeller == true)
            query = query.Where(p => p.IsBestSeller);

        query = filter.SortBy switch
        {
            "price-asc" => query.OrderBy(p => p.Price),
            "price-desc" => query.OrderByDescending(p => p.Price),
            "newest" => query.OrderByDescending(p => p.CreatedAt),
            "bestseller" => query.OrderByDescending(p => p.SoldCount),
            "rating" => query.OrderByDescending(p => p.Rating),
            _ => query.OrderByDescending(p => p.Id)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(p => MapToDTO(p))
            .ToListAsync();

        return new PagedResult<ProductDTO>
        {
            Items = items,
            TotalCount = totalCount,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    public async Task<ProductDetailDTO?> GetByIdAsync(int id)
    {
        var product = await db.Products
            .Include(p => p.Reviews.Where(r => r.Status == "approved"))
            .FirstOrDefaultAsync(p =>
                p.Id == id &&
                (p.Status == "active" || p.Status == "out-of-stock"));

        if (product is null) return null;

        var variantInventory = await db.VariantStocks
            .Where(v => v.ProductId == product.Id)
            .OrderBy(v => v.Size)
            .ThenBy(v => v.Color)
            .ToListAsync();

        return MapToDetailDTO(product, variantInventory);
    }

    public async Task<ProductDetailDTO?> GetBySlugAsync(string slug)
    {
        var product = await db.Products
            .Include(p => p.Reviews.Where(r => r.Status == "approved"))
            .FirstOrDefaultAsync(p =>
                p.Slug == slug &&
                (p.Status == "active" || p.Status == "out-of-stock"));

        if (product is null) return null;

        var variantInventory = await db.VariantStocks
            .Where(v => v.ProductId == product.Id)
            .OrderBy(v => v.Size)
            .ThenBy(v => v.Color)
            .ToListAsync();

        return MapToDetailDTO(product, variantInventory);
    }

    public async Task<List<ProductDTO>> GetNewArrivalsAsync(int count = 8)
    {
        return await db.Products
            .Where(p => p.Status == "active" && p.IsNew)
            .OrderByDescending(p => p.CreatedAt)
            .Take(count)
            .Select(p => MapToDTO(p))
            .ToListAsync();
    }

    public async Task<List<ProductDTO>> GetBestSellersAsync(int count = 8)
    {
        return await db.Products
            .Where(p => p.Status == "active" && p.IsBestSeller)
            .OrderByDescending(p => p.SoldCount)
            .Take(count)
            .Select(p => MapToDTO(p))
            .ToListAsync();
    }

    public async Task<List<ProductDTO>> GetSaleProductsAsync(int count = 8)
    {
        return await db.Products
            .Where(p => p.Status == "active" && p.IsSale)
            .OrderByDescending(p => p.OldPrice - p.Price)
            .Take(count)
            .Select(p => MapToDTO(p))
            .ToListAsync();
    }

    public async Task<List<ProductDTO>> GetRelatedAsync(int productId, int count = 4)
    {
        var product = await db.Products.FindAsync(productId);
        if (product is null) return [];

        return await db.Products
            .Where(p => p.Status == "active" && p.Id != productId && p.Category == product.Category)
            .OrderByDescending(p => p.SoldCount)
            .Take(count)
            .Select(p => MapToDTO(p))
            .ToListAsync();
    }


    public async Task<RecommendationDTO> GetRecommendationsAsync(int? userId, int limit = 12)
    {
        limit = Math.Clamp(limit, 1, 24);

        var signalCategories = new List<string>();
        var purchasedProductIds = new List<int>();

        if (userId.HasValue)
        {
            var wishlistCategories = await (
                from wishlist in db.WishlistItems
                join product in db.Products on wishlist.ProductId equals product.Id
                where wishlist.UserId == userId.Value && product.Status == "active"
                select product.Category)
                .Distinct()
                .ToListAsync();

            purchasedProductIds = await (
                from order in db.Orders
                join item in db.OrderItems on order.Id equals item.OrderId
                where order.UserId == userId.Value && order.Status == "completed"
                select item.ProductId)
                .Distinct()
                .ToListAsync();

            var orderCategories = new List<string>();
            if (purchasedProductIds.Count > 0)
            {
                orderCategories = await db.Products
                    .Where(p => purchasedProductIds.Contains(p.Id))
                    .Select(p => p.Category)
                    .Distinct()
                    .ToListAsync();
            }

            signalCategories = wishlistCategories
                .Concat(orderCategories)
                .Where(category => !string.IsNullOrWhiteSpace(category))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        var result = new List<ProductDTO>(limit);
        var selectedIds = new HashSet<int>();

        async Task AddCandidatesAsync(IQueryable<Product> query)
        {
            var remaining = limit - result.Count;
            if (remaining <= 0) return;

            if (selectedIds.Count > 0)
            {
                var excludedIds = selectedIds.ToList();
                query = query.Where(p => !excludedIds.Contains(p.Id));
            }

            var products = await query.Take(remaining).ToListAsync();
            foreach (var product in products)
            {
                if (!selectedIds.Add(product.Id)) continue;
                result.Add(MapToDTO(product));
            }
        }

        IQueryable<Product> AvailableProducts()
        {
            var query = db.Products.Where(p => p.Status == "active");
            if (purchasedProductIds.Count > 0)
                query = query.Where(p => !purchasedProductIds.Contains(p.Id));
            return query;
        }

        var personalizedCount = 0;
        if (signalCategories.Count > 0)
        {
            await AddCandidatesAsync(
                AvailableProducts()
                    .Where(p => signalCategories.Contains(p.Category))
                    .OrderByDescending(p => p.IsBestSeller)
                    .ThenByDescending(p => p.SoldCount)
                    .ThenByDescending(p => p.Rating)
                    .ThenByDescending(p => p.IsNew)
                    .ThenByDescending(p => p.Id));
            personalizedCount = result.Count;
        }

        await AddCandidatesAsync(
            AvailableProducts()
                .Where(p => p.IsBestSeller)
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => p.Rating)
                .ThenByDescending(p => p.Id));

        await AddCandidatesAsync(
            AvailableProducts()
                .Where(p => p.IsNew)
                .OrderByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id));

        await AddCandidatesAsync(
            AvailableProducts()
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => p.Rating)
                .ThenByDescending(p => p.Id));

        var isPersonalized = personalizedCount > 0;
        return new RecommendationDTO
        {
            IsPersonalized = isPersonalized,
            Source = isPersonalized ? "wishlist-orders" : "fallback",
            Items = result
        };
    }

    private static ProductDTO MapToDTO(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Category = p.Category,
        Subcategory = p.Subcategory,
        Gender = p.Gender,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Stock = p.Stock,
        AvailableStock = p.Available,
        Status = p.Status,
        Image = p.Image,
        ShortDescription = p.ShortDescription,
        Sku = p.Sku,
        Slug = p.Slug,
        IsNew = p.IsNew,
        IsSale = p.IsSale,
        IsBestSeller = p.IsBestSeller,
        Rating = p.Rating,
        SoldCount = p.SoldCount,
        Colors = Deserialize<List<string>>(p.Colors) ?? [],
        Sizes = Deserialize<List<string>>(p.Sizes) ?? []
    };

    private static ProductDetailDTO MapToDetailDTO(Product p, IReadOnlyCollection<VariantStock> variantInventory) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Category = p.Category,
        Subcategory = p.Subcategory,
        Style = p.Style,
        AgeGroup = p.AgeGroup,
        Gender = p.Gender,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Stock = p.Stock,
        AvailableStock = p.Available,
        Status = p.Status,
        Image = p.Image,
        Images = Deserialize<List<string>>(p.Images) ?? [],
        ShortDescription = p.ShortDescription,
        Description = p.Description,
        Sku = p.Sku,
        Slug = p.Slug,
        Menu = p.Menu,
        Collection = p.CollectionId?.ToString(),
        Specs = p.Specs,
        IsNew = p.IsNew,
        IsSale = p.IsSale,
        IsBestSeller = p.IsBestSeller,
        Rating = p.Rating,
        SoldCount = p.SoldCount,
        Colors = Deserialize<List<string>>(p.Colors) ?? [],
        Sizes = Deserialize<List<string>>(p.Sizes) ?? [],
        Variants = Deserialize<List<ProductVariantDTO>>(p.Variants) ?? [],
        VariantInventory = variantInventory.Select(v => new ProductVariantInventoryDTO
        {
            Size = v.Size,
            Color = v.Color,
            Stock = v.Stock,
            Reserved = v.Reserved,
            Available = v.Available
        }).ToList(),
        Reviews = p.Reviews
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDTO
        {
            Id = r.Id,
            ProductId = r.ProductId,
            CustomerName = r.CustomerName,
            Rating = r.Rating,
            Comment = r.Comment,
            CreatedAt = r.CreatedAt,
            OrderId = r.OrderId,
            Images = Deserialize<List<string>>(r.Images) ?? [],
            VideoUrl = r.VideoUrl,
            Size = r.Size,
            Color = r.Color,
            AdminReply = r.AdminReply,
            RepliedAt = r.RepliedAt,
            HelpfulCount = r.HelpfulCount,
            IsVerifiedPurchase = r.OrderId > 0
        }).ToList(),
        CreatedAt = p.CreatedAt
    };

    private static IQueryable<Product> ApplyJsonArrayAnyFilter(
        IQueryable<Product> query,
        string? rawFilter,
        Expression<Func<Product, string?>> selector)
    {
        var values = (rawFilter ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => value.Replace("\"", string.Empty))
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (values.Length == 0) return query;

        var parameter = selector.Parameters[0];
        Expression? predicateBody = null;

        foreach (var value in values)
        {
            var selected = selector.Body;
            var notNull = Expression.NotEqual(
                selected,
                Expression.Constant(null, typeof(string)));
            var contains = Expression.Call(
                selected,
                nameof(string.Contains),
                Type.EmptyTypes,
                Expression.Constant($"\"{value}\""));
            var current = Expression.AndAlso(notNull, contains);
            predicateBody = predicateBody is null
                ? current
                : Expression.OrElse(predicateBody, current);
        }

        return query.Where(
            Expression.Lambda<Func<Product, bool>>(predicateBody!, parameter));
    }

    private static T? Deserialize<T>(string? json)
    {
        if (string.IsNullOrEmpty(json)) return default;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch { return default; }
    }
}
// v1.1: Them GetById, GetBySlug
// v1.2: Them GetNewArrivals, GetBestSellers, GetSaleProducts, GetRelated
// v1.3: Them JSON deserialization an toan cho Colors, Sizes, Variants
