using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace API.Customer.Services;

public class OrderService(
    CustomerDbContext db,
    ICouponService couponService,
    IComboDiscountService comboService,
    IShippingService shippingService,
    IEmailService emailService,
    IConfiguration config) : IOrderService
{
    public async Task<OrderDTO> CreateOrderAsync(int userId, CreateOrderDTO dto)
    {
        var requestedIds = dto.CartItemIds?.Distinct().ToList();
        if (dto.CartItemIds is not null && requestedIds is { Count: 0 })
            throw new InvalidOperationException("Bạn chưa chọn sản phẩm để thanh toán.");

        var cartQuery = db.CartItems
            .Include(c => c.Product)
            .Where(c => c.UserId == userId);

        if (requestedIds is { Count: > 0 })
            cartQuery = cartQuery.Where(c => requestedIds.Contains(c.Id));

        var cartItems = await cartQuery.ToListAsync();

        if (requestedIds is { Count: > 0 } && cartItems.Count != requestedIds.Count)
            throw new InvalidOperationException("Một số sản phẩm đã không còn trong giỏ. Vui lòng tải lại giỏ hàng.");

        if (cartItems.Count == 0)
            throw new InvalidOperationException("Giỏ hàng trống");

        var now = DateTime.UtcNow;
        if (cartItems.Any(c => c.ReservedUntil.HasValue && c.ReservedUntil.Value <= now))
            throw new InvalidOperationException("Thời gian giữ hàng đã hết. Vui lòng tải lại giỏ hàng để kiểm tra tồn kho.");

        var paymentMethod = (dto.PaymentMethod ?? "COD").Trim().ToUpperInvariant();
        if (paymentMethod != "COD" && paymentMethod != "ATM")
            throw new InvalidOperationException("Phương thức thanh toán không được hỗ trợ.");

        var paymentSettings = await db.StoreSettings
            .Where(s => s.Group == "payment")
            .ToListAsync();

        static bool ReadBoolSetting(
            IReadOnlyCollection<StoreSetting> settings,
            string code,
            bool fallback)
        {
            var raw = settings.FirstOrDefault(s => s.Code == code)?.Value;
            return bool.TryParse(raw, out var parsed) ? parsed : fallback;
        }

        var legacyBankConfigured =
            !string.IsNullOrWhiteSpace(paymentSettings.FirstOrDefault(s => s.Code == "bankName")?.Value) &&
            !string.IsNullOrWhiteSpace(paymentSettings.FirstOrDefault(s => s.Code == "bankAccount")?.Value) &&
            !string.IsNullOrWhiteSpace(paymentSettings.FirstOrDefault(s => s.Code == "bankOwner")?.Value);

        var bankListConfigured = false;
        var bankListJson = paymentSettings.FirstOrDefault(s => s.Code == "bankAccounts")?.Value;
        if (!string.IsNullOrWhiteSpace(bankListJson))
        {
            try
            {
                var accounts = JsonSerializer.Deserialize<List<PaymentBankAccountDTO>>(
                    bankListJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                bankListConfigured = accounts?.Any(a =>
                    !string.IsNullOrWhiteSpace(a.BankName) &&
                    !string.IsNullOrWhiteSpace(a.AccountNumber) &&
                    !string.IsNullOrWhiteSpace(a.AccountHolder)) == true;
            }
            catch
            {
                bankListConfigured = false;
            }
        }

        var bankConfigured = legacyBankConfigured || bankListConfigured;

        if (paymentMethod == "COD" &&
            !ReadBoolSetting(paymentSettings, "enableCOD", true))
            throw new InvalidOperationException("Thanh toán COD hiện đang tạm tắt.");

        if (paymentMethod == "ATM" &&
            (!ReadBoolSetting(paymentSettings, "enableBankTransfer", bankConfigured) || !bankConfigured))
            throw new InvalidOperationException("Chuyển khoản ngân hàng hiện chưa được cấu hình.");

        var account = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("Tài khoản không còn tồn tại.");

        var customerName = dto.CustomerName?.Trim() ?? string.Empty;
        var customerPhone = dto.CustomerPhone?.Trim() ?? string.Empty;
        var customerEmail = string.IsNullOrWhiteSpace(dto.CustomerEmail)
            ? account.Email.Trim()
            : dto.CustomerEmail.Trim();

        var shippingProvince = dto.ShippingProvince?.Trim() ?? string.Empty;
        var shippingDistrict = dto.ShippingDistrict?.Trim() ?? string.Empty;
        var shippingWard = dto.ShippingWard?.Trim() ?? string.Empty;
        var shippingStreet = dto.ShippingStreet?.Trim() ?? string.Empty;

        if (customerName.Length < 2)
            throw new InvalidOperationException("Tên người nhận không hợp lệ.");
        if (customerPhone.Count(char.IsDigit) < 9)
            throw new InvalidOperationException("Số điện thoại người nhận không hợp lệ.");
        if (string.IsNullOrWhiteSpace(customerEmail))
            throw new InvalidOperationException("Email tài khoản không hợp lệ.");
        if (string.IsNullOrWhiteSpace(shippingProvince) ||
            string.IsNullOrWhiteSpace(shippingDistrict) ||
            string.IsNullOrWhiteSpace(shippingWard) ||
            string.IsNullOrWhiteSpace(shippingStreet))
            throw new InvalidOperationException("Địa chỉ giao hàng chưa đầy đủ.");

        var customerAddress = string.Join(", ",
            new[] { shippingStreet, shippingWard, shippingDistrict, shippingProvince }
                .Where(value => !string.IsNullOrWhiteSpace(value)));

        var variantProductIds = cartItems.Select(c => c.ProductId).Distinct().ToList();
        var variants = await db.VariantStocks
            .Where(v => variantProductIds.Contains(v.ProductId))
            .ToListAsync();

        foreach (var item in cartItems)
        {
            if (item.Product.Status != "active")
                throw new InvalidOperationException(
                    $"Sản phẩm {item.Product.Name} hiện không còn được bán.");

            if (item.Quantity < 1 || item.Product.Stock < item.Quantity)
                throw new InvalidOperationException($"Sản phẩm {item.Product.Name} không còn đủ tồn kho.");

            var productVariants = variants.Where(v => v.ProductId == item.ProductId).ToList();
            if (productVariants.Count > 0)
            {
                var variant = productVariants.FirstOrDefault(v =>
                    v.Size == item.Size && v.Color == item.Color);

                if (variant is null || variant.Stock < item.Quantity)
                    throw new InvalidOperationException(
                        $"Biến thể {item.Size} - {item.Color} của {item.Product.Name} không còn đủ tồn kho.");
            }
        }

        var subtotal = cartItems.Sum(c => c.Product.Price * c.Quantity);
        decimal couponDiscount = 0;
        string? validCouponCode = null;

        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
        {
            var normalizedCoupon = dto.CouponCode.Trim().ToUpperInvariant();
            var couponResult = await couponService.ValidateAsync(new CouponValidateDTO
            {
                Code = normalizedCoupon,
                OrderAmount = subtotal
            });

            if (!couponResult.IsValid)
                throw new InvalidOperationException(couponResult.Message ?? "Mã giảm giá không còn hợp lệ.");

            couponDiscount = couponResult.DiscountAmount;
            validCouponCode = normalizedCoupon;
        }

        var combo = await comboService.EvaluateForItemsAsync(cartItems);
        var comboDiscount = combo.Eligible ? combo.Discount : 0m;
        var totalDiscount = couponDiscount + comboDiscount;

        var shippingProvider = string.IsNullOrWhiteSpace(dto.ShippingProvider)
            ? "mock"
            : dto.ShippingProvider.Trim().ToLowerInvariant();
        var shippingServiceCode = string.IsNullOrWhiteSpace(dto.ShippingServiceCode)
            ? "standard"
            : dto.ShippingServiceCode.Trim();

        var quote = await shippingService.QuoteAsync(new ShippingQuoteRequestDTO
        {
            Provider = shippingProvider,
            ToProvince = shippingProvince,
            ToDistrict = shippingDistrict,
            ToWard = shippingWard,
            ToAddress = shippingStreet,
            WeightGram = Math.Max(300, cartItems.Sum(c => c.Quantity * 300)),
            OrderValue = subtotal,
        });

        var selectedShipping = quote.Options.FirstOrDefault(o =>
            o.Provider.Equals(shippingProvider, StringComparison.OrdinalIgnoreCase) &&
            o.ServiceCode.Equals(shippingServiceCode, StringComparison.OrdinalIgnoreCase));

        if (!quote.Success || selectedShipping is null)
            throw new InvalidOperationException(
                "Gói vận chuyển đã thay đổi. Vui lòng tính lại phí và chọn lại phương thức giao hàng.");

        // Phí ship/ETA luôn lấy từ quote backend, không tin giá trị client gửi.
        var shippingFee = selectedShipping.Fee;
        var leadTimeHours = selectedShipping.LeadTimeHours;
        shippingProvider = selectedShipping.Provider;
        shippingServiceCode = selectedShipping.ServiceCode;

        var total = subtotal - totalDiscount + shippingFee;
        if (total < 0) total = 0;

        var orderCode = $"KK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";

        var order = new Order
        {
            OrderCode = orderCode,
            UserId = userId,
            CustomerName = customerName,
            CustomerPhone = customerPhone,
            CustomerEmail = customerEmail,
            CustomerAddress = customerAddress,
            Subtotal = subtotal,
            ShippingFee = shippingFee,
            Discount = totalDiscount,
            Total = total,
            CouponCode = validCouponCode,
            PaymentMethod = paymentMethod,
            Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            ShippingProvider = shippingProvider,
            PaymentExpiresAt = paymentMethod == "ATM"
                ? DateTime.UtcNow.AddMinutes(15)
                : null,
            ShippingServiceCode = shippingServiceCode,
            LeadTimeHours = leadTimeHours,
            Items = cartItems.Select(c => new OrderItem
            {
                ProductId = c.ProductId,
                ProductName = c.Product.Name,
                ProductImage = c.Product.Image,
                Price = c.Product.Price,
                Size = c.Size,
                Color = c.Color,
                Quantity = c.Quantity
            }).ToList()
        };

        db.Orders.Add(order);

        foreach (var item in cartItems)
        {
            item.Product.Stock -= item.Quantity;
            item.Product.Reserved = Math.Max(0, item.Product.Reserved - item.Quantity);
            item.Product.SoldCount += item.Quantity;
            item.Product.UpdatedAt = DateTime.UtcNow;
            if (item.Product.Stock <= 0)
                item.Product.Status = "out-of-stock";

            var variant = variants.FirstOrDefault(x =>
                x.ProductId == item.ProductId &&
                x.Size == item.Size &&
                x.Color == item.Color);

            if (variant != null)
            {
                variant.Stock = Math.Max(0, variant.Stock - item.Quantity);
                variant.Reserved = Math.Max(0, variant.Reserved - item.Quantity);
                variant.SoldCount += item.Quantity;
                variant.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Partial checkout: chỉ xóa item đã chọn. Item không chọn vẫn giữ nguyên reservation.
        db.CartItems.RemoveRange(cartItems);

        if (validCouponCode is not null)
        {
            var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == validCouponCode);
            if (coupon is not null) coupon.UsedCount++;
        }

        await db.SaveChangesAsync();

        await shippingService.AppendHistoryAsync(order.Id, "order_placed",
            $"Đơn hàng {order.OrderCode} đã được tạo", "Hệ thống KaitoKid");

        if (paymentMethod == "COD")
        {
            try
            {
                await shippingService.CreateShippingOrderAsync(
                    order.Id,
                    order.ShippingProvider ?? "mock",
                    order.ShippingServiceCode ?? "standard");
            }
            catch
            {
                // Không chặn luồng tạo đơn nếu shipping fail.
            }
        }

        var frontendUrl = (config["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var trackingUrl = $"{frontendUrl}/orders";
        _ = emailService.SendAsync(order.CustomerEmail,
            $"[KaitoKid] Xác nhận đơn hàng {order.OrderCode}",
            EmailMessageBuilder.OrderConfirmation(
                order.CustomerName,
                order.OrderCode,
                order.Total,
                order.PaymentMethod,
                trackingUrl));

        return MapToDTO(order);
    }

    public async Task<List<OrderDTO>> GetOrdersByUserAsync(int userId)
    {
        var orders = await db.Orders
            .Where(o => o.UserId == userId)
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        // Lấy tất cả review (orderId, productId) của user trong 1 query
        var orderIds = orders.Select(o => o.Id).ToList();
        var reviewedSet = await db.Reviews
            .Where(r => r.UserId == userId && orderIds.Contains(r.OrderId))
            .Select(r => new { r.OrderId, r.ProductId })
            .ToListAsync();
        var reviewedKeys = reviewedSet
            .Select(x => $"{x.OrderId}:{x.ProductId}")
            .ToHashSet();

        return orders.Select(o => MapToDTO(o, reviewedKeys)).ToList();
    }

    public async Task<OrderDTO?> GetOrderByIdAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null) return null;

        var reviewedSet = await db.Reviews
            .Where(r => r.UserId == userId && r.OrderId == orderId)
            .Select(r => r.ProductId)
            .ToListAsync();
        var reviewedKeys = reviewedSet
            .Select(pid => $"{orderId}:{pid}")
            .ToHashSet();

        return MapToDTO(order, reviewedKeys);
    }

    public async Task<bool> CancelOrderAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

        if (order is null) return false;

        // Quyền hủy là rule server-side dùng chung cho command + DTO.
        if (!CanCancelOrder(order)) return false;

        order.Status = "cancelled";
        order.ShippingStatus = "cancelled";
        order.UpdatedAt = DateTime.UtcNow;

        // Hoàn kho cả 2 cấp (product + variant) — fix BUG #1
        await InventoryRestoreHelper.RestoreStockAsync(db, order.Items);

        // Hoàn lại lượt dùng coupon nếu đơn có áp mã
        await RestoreCouponUsageAsync(order.CouponCode);

        await db.SaveChangesAsync();
        await shippingService.AppendHistoryAsync(order.Id, "cancelled",
            "Khách hàng đã hủy đơn", null);
        return true;
    }

    /// <summary>
    /// Hoàn lại 1 lượt dùng coupon khi đơn bị huỷ (fix BUG #2).
    /// Không cho UsedCount âm.
    /// </summary>
    private async Task RestoreCouponUsageAsync(string? couponCode)
    {
        if (string.IsNullOrEmpty(couponCode)) return;
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == couponCode);
        if (coupon is not null && coupon.UsedCount > 0)
            coupon.UsedCount--;
    }

    private static bool CanCancelOrder(Order order)
        => (order.Status is "pending" or "confirmed")
           && (order.ShippingStatus is null or "ready_to_pick" or "picking");

    private static OrderDTO MapToDTO(Order o) => MapToDTO(o, null);

    private static OrderDTO MapToDTO(Order o, HashSet<string>? reviewedKeys) => new()
    {
        Id = o.Id,
        OrderCode = o.OrderCode,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        CustomerEmail = o.CustomerEmail,
        CustomerAddress = o.CustomerAddress,
        Subtotal = o.Subtotal,
        ShippingFee = o.ShippingFee,
        Discount = o.Discount,
        Total = o.Total,
        CouponCode = o.CouponCode,
        PaymentMethod = o.PaymentMethod,
        Status = o.Status,
        CanCancel = CanCancelOrder(o),
        Note = o.Note,
        CreatedAt = o.CreatedAt,
        TrackingCode = o.TrackingCode,
        TrackingUrl = o.TrackingUrl,
        ShippingStatus = o.ShippingStatus,
        ShippingProvider = o.ShippingProvider,
        ShippingServiceCode = o.ShippingServiceCode,
        LeadTimeHours = o.LeadTimeHours,
        PaymentExpiresAt = o.PaymentExpiresAt,
        PaidAt = o.PaidAt,
        Items = o.Items.Select(i => new OrderDetailDTO
        {
            ProductId = i.ProductId,
            ProductName = i.ProductName,
            ProductImage = i.ProductImage,
            Price = i.Price,
            Size = i.Size,
            Color = i.Color,
            Quantity = i.Quantity,
            HasReviewed = reviewedKeys != null && reviewedKeys.Contains($"{o.Id}:{i.ProductId}"),
        }).ToList()
    };
}
// v1.3: Tich hop IShippingService — luu phi/provider, tao van don khi COD
