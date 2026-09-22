using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class ReviewService(CustomerDbContext db) : IReviewService
{
    public async Task<List<ReviewDTO>> GetByProductAsync(int productId)
    {
        var reviews = await db.Reviews
            .Where(r => r.ProductId == productId && r.Status == "approved")
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reviews.Select(MapToDto).ToList();
    }

    public async Task<ReviewDTO> CreateAsync(int userId, string customerName, CreateReviewDTO dto)
    {
        if (dto.OrderId <= 0)
            throw new InvalidOperationException("Đánh giá phải được tạo từ một đơn hàng đã hoàn tất.");

        if (dto.Rating is < 1 or > 5)
            throw new InvalidOperationException("Số sao đánh giá phải từ 1 đến 5.");

        var comment = dto.Comment?.Trim() ?? string.Empty;
        if (comment.Length < 3)
            throw new InvalidOperationException("Vui lòng chia sẻ ít nhất 3 ký tự về trải nghiệm sản phẩm.");
        if (comment.Length > 2000)
            throw new InvalidOperationException("Nội dung đánh giá tối đa 2000 ký tự.");

        var order = await db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o =>
                o.Id == dto.OrderId &&
                o.UserId == userId &&
                o.Status == "completed");

        if (order is null)
            throw new InvalidOperationException("Đơn hàng không tồn tại, không thuộc tài khoản này hoặc chưa hoàn tất.");

        var productItems = order.Items
            .Where(i => i.ProductId == dto.ProductId)
            .ToList();

        if (productItems.Count == 0)
            throw new InvalidOperationException("Sản phẩm này không thuộc đơn hàng đã chọn.");

        OrderItem? purchasedItem = null;
        var requestedSize = dto.Size?.Trim();
        var requestedColor = dto.Color?.Trim();

        if (!string.IsNullOrWhiteSpace(requestedSize) ||
            !string.IsNullOrWhiteSpace(requestedColor))
        {
            purchasedItem = productItems.FirstOrDefault(i =>
                (string.IsNullOrWhiteSpace(requestedSize) || i.Size == requestedSize) &&
                (string.IsNullOrWhiteSpace(requestedColor) || i.Color == requestedColor));
        }

        purchasedItem ??= productItems.Count == 1 ? productItems[0] : null;

        if (purchasedItem is null)
            throw new InvalidOperationException("Không xác định được đúng biến thể đã mua để đánh giá.");

        var duplicate = await db.Reviews.AnyAsync(r =>
            r.UserId == userId &&
            r.ProductId == dto.ProductId &&
            r.OrderId == dto.OrderId &&
            (string.IsNullOrEmpty(r.Size) || r.Size == purchasedItem.Size) &&
            (string.IsNullOrEmpty(r.Color) || r.Color == purchasedItem.Color));

        if (duplicate)
            throw new InvalidOperationException("Bạn đã đánh giá biến thể sản phẩm này trong đơn hàng rồi.");

        var images = (dto.Images ?? [])
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Select(url => url.Trim())
            .Distinct()
            .Take(4)
            .ToList();

        var review = new Review
        {
            ProductId = dto.ProductId,
            UserId = userId,
            CustomerName = string.IsNullOrWhiteSpace(customerName) ? "Khách hàng" : customerName.Trim(),
            OrderId = dto.OrderId,
            Rating = dto.Rating,
            Comment = comment,
            Status = "pending",
            Images = images.Count > 0 ? JsonSerializer.Serialize(images) : null,
            VideoUrl = string.IsNullOrWhiteSpace(dto.VideoUrl) ? null : dto.VideoUrl.Trim(),
            Size = purchasedItem.Size,
            Color = purchasedItem.Color,
        };

        db.Reviews.Add(review);
        await db.SaveChangesAsync();

        // Rating sản phẩm chỉ dựa trên review đã được duyệt.
        var avg = await db.Reviews
            .Where(r => r.ProductId == dto.ProductId && r.Status == "approved")
            .AverageAsync(r => (double?)r.Rating) ?? 0;

        var product = await db.Products.FindAsync(dto.ProductId);
        if (product is not null)
        {
            product.Rating = Math.Round(avg, 1);
            await db.SaveChangesAsync();
        }

        return MapToDto(review);
    }

    public async Task<bool> MarkHelpfulAsync(int reviewId)
    {
        var review = await db.Reviews.FindAsync(reviewId);
        if (review is null) return false;
        review.HelpfulCount += 1;
        await db.SaveChangesAsync();
        return true;
    }

    private static ReviewDTO MapToDto(Review r) => new()
    {
        Id = r.Id,
        ProductId = r.ProductId,
        CustomerName = r.CustomerName,
        Rating = r.Rating,
        Comment = r.Comment,
        CreatedAt = r.CreatedAt,
        OrderId = r.OrderId,
        Images = ParseImages(r.Images),
        VideoUrl = r.VideoUrl,
        Size = r.Size,
        Color = r.Color,
        AdminReply = r.AdminReply,
        RepliedAt = r.RepliedAt,
        HelpfulCount = r.HelpfulCount,
        IsVerifiedPurchase = r.OrderId > 0,
    };

    private static List<string> ParseImages(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new();
        }
        catch { return new(); }
    }
}
// v1.1: Hỗ trợ media + verified purchase + helpful counter
