using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class CartService(CustomerDbContext db) : ICartService
{
    private const int ReservationMinutes = 30;

    public async Task<List<CartItemDTO>> GetCartAsync(int userId)
    {
        var items = await db.CartItems
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();

        // Lấy variant stock cho tất cả item trong giỏ
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var variants = await db.VariantStocks
            .Where(v => productIds.Contains(v.ProductId))
            .ToListAsync();

        return items.Select(c =>
        {
            var matchedVariant = variants.FirstOrDefault(v =>
                v.ProductId == c.ProductId &&
                v.Size == c.Size &&
                v.Color == c.Color);

            var available = matchedVariant != null
                ? matchedVariant.Available
                : c.Product.Available;

            return new CartItemDTO
            {
                Id = c.Id,
                ProductId = c.ProductId,
                Name = c.Product.Name,
                Price = c.Product.Price,
                Image = c.Product.Image,
                Size = c.Size,
                Color = c.Color,
                Quantity = c.Quantity,
                AvailableStock = available,
                ReservedUntil = c.ReservedUntil,
                IsLowStock = available > 0 && available < 5,
            };
        }).ToList();
    }

    public async Task<CartItemDTO> AddToCartAsync(int userId, AddToCartDTO dto)
    {
        if (dto.Quantity < 1)
            throw new InvalidOperationException("Số lượng phải lớn hơn 0");

        dto.Size = dto.Size?.Trim() ?? string.Empty;
        dto.Color = dto.Color?.Trim() ?? string.Empty;

        var product = await db.Products.FindAsync(dto.ProductId)
            ?? throw new InvalidOperationException("Sản phẩm không tồn tại");

        if (product.Status != "active")
            throw new InvalidOperationException("Sản phẩm hiện không thể thêm vào giỏ hàng");

        var allowedSizes = DeserializeList(product.Sizes);
        var allowedColors = DeserializeList(product.Colors);

        if (allowedSizes.Count > 0 &&
            !allowedSizes.Contains(dto.Size, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Kích cỡ đã chọn không hợp lệ");

        if (allowedColors.Count > 0 &&
            !allowedColors.Contains(dto.Color, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Màu sắc đã chọn không hợp lệ");

        var hasVariantInventory = await db.VariantStocks
            .AnyAsync(v => v.ProductId == dto.ProductId);

        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == dto.ProductId &&
            v.Size == dto.Size &&
            v.Color == dto.Color);

        if (hasVariantInventory && variant is null)
            throw new InvalidOperationException("Biến thể size/màu đã chọn không tồn tại hoặc không còn bán");

        var availableStock = variant != null
            ? Math.Min(variant.Available, product.Available)
            : product.Available;

        if (availableStock < dto.Quantity)
            throw new InvalidOperationException(
                $"Chỉ còn {availableStock} sản phẩm khả dụng cho size {dto.Size} - màu {dto.Color}");

        var existing = await db.CartItems.FirstOrDefaultAsync(c =>
            c.UserId == userId &&
            c.ProductId == dto.ProductId &&
            c.Size == dto.Size &&
            c.Color == dto.Color);

        var quantityDelta = dto.Quantity;
        var reserveUntil = DateTime.UtcNow.AddMinutes(ReservationMinutes);

        if (existing != null)
        {
            existing.Quantity += dto.Quantity;
            existing.ReservedUntil = reserveUntil;
        }
        else
        {
            existing = new CartItem
            {
                UserId = userId,
                ProductId = dto.ProductId,
                Size = dto.Size,
                Color = dto.Color,
                Quantity = dto.Quantity,
                ReservedUntil = reserveUntil,
            };
            db.CartItems.Add(existing);
        }

        product.Reserved += quantityDelta;
        product.UpdatedAt = DateTime.UtcNow;

        if (variant != null)
        {
            variant.Reserved += quantityDelta;
            variant.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        var availableAfter = variant != null
            ? Math.Min(variant.Available, product.Available)
            : product.Available;

        return new CartItemDTO
        {
            Id = existing.Id,
            ProductId = existing.ProductId,
            Name = product.Name,
            Price = product.Price,
            Image = product.Image,
            Size = existing.Size,
            Color = existing.Color,
            Quantity = existing.Quantity,
            AvailableStock = availableAfter,
            ReservedUntil = existing.ReservedUntil,
            IsLowStock = availableAfter > 0 && availableAfter < 5,
        };
    }

    public async Task<CartItemDTO?> UpdateQuantityAsync(int userId, int cartItemId, int quantity)
    {
        var item = await db.CartItems
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId);

        if (item is null) return null;
        if (quantity < 1) return null;

        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == item.ProductId &&
            v.Size == item.Size &&
            v.Color == item.Color);

        var oldQty = item.Quantity;
        var delta = quantity - oldQty;

        var productAvailableForItem =
            item.Product.Stock - item.Product.Reserved + oldQty;

        if (quantity > productAvailableForItem)
            throw new InvalidOperationException(
                $"Chỉ còn {productAvailableForItem} sản phẩm khả dụng");

        if (variant != null)
        {
            var variantAvailableForItem =
                variant.Stock - variant.Reserved + oldQty;

            if (quantity > variantAvailableForItem)
                throw new InvalidOperationException(
                    $"Chỉ còn {variantAvailableForItem} sản phẩm khả dụng cho biến thể này");

            variant.Reserved = Math.Max(0, variant.Reserved + delta);
            variant.UpdatedAt = DateTime.UtcNow;
        }

        item.Product.Reserved = Math.Max(0, item.Product.Reserved + delta);
        item.Product.UpdatedAt = DateTime.UtcNow;

        item.Quantity = quantity;
        item.ReservedUntil = DateTime.UtcNow.AddMinutes(ReservationMinutes);
        await db.SaveChangesAsync();

        var availableAfter = variant != null
            ? Math.Min(variant.Available, item.Product.Available)
            : item.Product.Available;

        return new CartItemDTO
        {
            Id = item.Id,
            ProductId = item.ProductId,
            Name = item.Product.Name,
            Price = item.Product.Price,
            Image = item.Product.Image,
            Size = item.Size,
            Color = item.Color,
            Quantity = item.Quantity,
            AvailableStock = availableAfter,
            ReservedUntil = item.ReservedUntil,
            IsLowStock = availableAfter > 0 && availableAfter < 5,
        };
    }

    public async Task<bool> RemoveFromCartAsync(int userId, int cartItemId)
    {
        var item = await db.CartItems.FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId);
        if (item is null) return false;
        await ReleaseReservation(item);
        db.CartItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task ClearCartAsync(int userId)
    {
        var items = await db.CartItems.Where(c => c.UserId == userId).ToListAsync();
        foreach (var i in items) await ReleaseReservation(i);
        db.CartItems.RemoveRange(items);
        await db.SaveChangesAsync();
    }

    public async Task<int> RemoveManyAsync(int userId, IEnumerable<int> cartItemIds)
    {
        var ids = cartItemIds.ToList();
        var items = await db.CartItems.Where(c => c.UserId == userId && ids.Contains(c.Id)).ToListAsync();
        foreach (var i in items) await ReleaseReservation(i);
        db.CartItems.RemoveRange(items);
        await db.SaveChangesAsync();
        return items.Count;
    }

    public async Task<int> MoveToWishlistAsync(int userId, IEnumerable<int> cartItemIds)
    {
        var ids = cartItemIds.ToList();
        var items = await db.CartItems.Where(c => c.UserId == userId && ids.Contains(c.Id)).ToListAsync();
        var moved = 0;
        foreach (var item in items)
        {
            // Skip nếu đã có trong wishlist
            var exists = await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.ProductId == item.ProductId);
            if (!exists)
            {
                db.WishlistItems.Add(new WishlistItem
                {
                    UserId = userId,
                    ProductId = item.ProductId,
                });
                moved++;
            }
            await ReleaseReservation(item);
            db.CartItems.Remove(item);
        }
        await db.SaveChangesAsync();
        return moved;
    }

    public async Task<List<CartItemDTO>> GetCrossSellAsync(int userId, int limit = 4)
    {
        var cartItems = await db.CartItems
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();
        if (cartItems.Count == 0) return new List<CartItemDTO>();

        // Lấy category của item đầu tiên + loại trừ sản phẩm đã có trong giỏ
        var firstCategory = cartItems[0].Product.Category;
        var inCart = cartItems.Select(c => c.ProductId).ToHashSet();

        var related = await db.Products
            .Where(p => p.Status == "active" && p.Category == firstCategory && !inCart.Contains(p.Id))
            .OrderByDescending(p => p.SoldCount)
            .Take(limit)
            .ToListAsync();

        return related.Select(p => new CartItemDTO
        {
            Id = 0,
            ProductId = p.Id,
            Name = p.Name,
            Price = p.Price,
            Image = p.Image,
            Size = "",
            Color = "",
            Quantity = 0,
            AvailableStock = p.Available,
        }).ToList();
    }

    public async Task<ReorderResultDTO> ReorderAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null)
            throw new InvalidOperationException("Đơn hàng không tồn tại");

        var result = new ReorderResultDTO();
        foreach (var item in order.Items)
        {
            // Sản phẩm có thể đã bị disable / xoá → skip
            var product = await db.Products.FindAsync(item.ProductId);
            if (product is null || product.Status != "active")
            {
                result.Skipped++;
                result.SkippedNames.Add(item.ProductName);
                continue;
            }

            try
            {
                await AddToCartAsync(userId, new AddToCartDTO
                {
                    ProductId = item.ProductId,
                    Size = item.Size,
                    Color = item.Color,
                    Quantity = item.Quantity,
                });
                result.Added++;
            }
            catch (InvalidOperationException)
            {
                // Hết hàng / vượt tồn kho — bỏ qua, FE sẽ báo cho user
                result.Skipped++;
                result.SkippedNames.Add(item.ProductName);
            }
        }
        return result;
    }

    private async Task ReleaseReservation(CartItem item)
    {
        var now = DateTime.UtcNow;

        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == item.ProductId &&
            v.Size == item.Size &&
            v.Color == item.Color);

        if (variant != null)
        {
            variant.Reserved = Math.Max(0, variant.Reserved - item.Quantity);
            variant.UpdatedAt = now;
        }

        var product = await db.Products.FindAsync(item.ProductId);
        if (product != null)
        {
            product.Reserved = Math.Max(0, product.Reserved - item.Quantity);
            product.UpdatedAt = now;
        }
    }

    private static List<string> DeserializeList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
