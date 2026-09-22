namespace API.Customer.DTOs;

public class CreateOrderDTO
{
    /// <summary>
    /// Cart item IDs cần checkout. null = tương thích ngược: checkout toàn bộ giỏ.
    /// List rỗng là request không hợp lệ.
    /// </summary>
    public List<int>? CartItemIds { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    // Giữ field này để tương thích request cũ; backend PHASE 6 dựng địa chỉ
    // canonical từ ShippingProvince/District/Ward/Street.
    public string CustomerAddress { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = "COD";
    public string? CouponCode { get; set; }
    public string? Note { get; set; }

    // Shipping
    public string? ShippingProvider { get; set; }
    public string? ShippingServiceCode { get; set; }
    // Client có thể echo fee/ETA để review, nhưng OrderService không tin hai giá trị
    // này: backend luôn quote lại theo provider/service + địa chỉ có cấu trúc.
    public decimal ShippingFee { get; set; }
    public int? LeadTimeHours { get; set; }

    // Bắt buộc cho order mới từ Mobile/Web PHASE 6 để backend quote shipping.
    public string? ShippingProvince { get; set; }
    public string? ShippingDistrict { get; set; }
    public string? ShippingWard { get; set; }
    public string? ShippingStreet { get; set; }
}

public class OrderDTO
{
    public int Id { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string? CouponCode { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderDetailDTO> Items { get; set; } = [];

    // Shipping echo back
    public string? TrackingCode { get; set; }
    public string? TrackingUrl { get; set; }
    public string? ShippingStatus { get; set; }
    public string? ShippingProvider { get; set; }
    public string? ShippingServiceCode { get; set; }
    public int? LeadTimeHours { get; set; }

    // Payment echo back
    public DateTime? PaymentExpiresAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class OrderDetailDTO
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ProductImage { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Size { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Quantity { get; set; }
    /// <summary>true nếu user đã đánh giá sản phẩm này trong đơn này.</summary>
    public bool HasReviewed { get; set; }
}
