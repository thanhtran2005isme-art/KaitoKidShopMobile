import { Injectable, Logger } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  type BotContext,
  type BotReply,
  type ChatAttachment,
  type MessageDto,
  type QuickReply,
} from "./chat.types.js";
import { ChatSettingsService } from "./chat-settings.service.js";

const STARTER: QuickReply[] = [
  { label: "Tra cứu đơn hàng", payload: "Tôi muốn tra cứu đơn hàng" },
  { label: "Kiểm tra tồn kho", payload: "Sản phẩm này còn size nào?" },
  { label: "Mã giảm giá", payload: "Có mã giảm giá nào không?" },
  { label: "Chính sách đổi trả", payload: "Chính sách đổi trả thế nào?" },
  { label: "Gặp nhân viên", payload: "Tôi muốn gặp nhân viên" },
];

const HANDOFF = [
  "gặp nhân viên", "gap nhan vien", "nhân viên", "nhan vien",
  "người thật", "nguoi that", "tư vấn viên", "tu van vien",
  "tổng đài", "tong dai", "hỗ trợ trực tiếp",
];

const GREETING = [
  "xin chào", "xin chao", "chào", "chao", "hello", "hi",
  "alo", "shop ơi", "shop oi",
];

function hasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function formatVnd(value: number) {
  return `${Math.trunc(value).toLocaleString("vi-VN")}đ`;
}

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ChatSettingsService,
  ) {}

  async mode() {
    const settings = await this.settings.get();
    const useLlm =
      settings.llmEnabled &&
      Boolean(settings.apiKey) &&
      Boolean(settings.endpoint);
    return {
      mode: useLlm ? "llm" : "rule",
      label: useLlm ? "Trợ lý AI" : "Trợ lý cơ bản",
    } as const;
  }

  async respond(context: BotContext): Promise<BotReply> {
    const text = context.userText.trim();
    const lower = text.toLowerCase();

    if (hasAny(lower, HANDOFF)) {
      return {
        text:
          "Mình đang kết nối bạn với nhân viên hỗ trợ. Bạn vui lòng chờ trong giây lát nhé!",
        intent: "Handoff",
        shouldHandoff: true,
      };
    }

    if (!text || hasAny(lower, GREETING)) {
      return {
        text:
          "Xin chào! Mình là trợ lý của KaitoKid Shop 👋. Mình có thể giúp bạn tra cứu đơn hàng, kiểm tra tồn kho, mã giảm giá hoặc chính sách. Bạn cần hỗ trợ gì ạ?",
        intent: "Greeting",
        quickReplies: STARTER,
      };
    }

    const order = await this.orderSkill(context);
    if (order) return order;

    const stock = await this.stockSkill(context);
    if (stock) return stock;

    const coupon = await this.couponSkill(context);
    if (coupon) return coupon;

    const faq = await this.faqSkill(context);
    if (faq) return faq;

    const settings = await this.settings.get();
    if (
      settings.llmEnabled &&
      settings.apiKey &&
      settings.endpoint
    ) {
      try {
        const answer = await this.llm(context, settings);
        if (answer) {
          return { text: answer, intent: "Faq" };
        }
      } catch (error) {
        this.logger.warn(
          `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          text:
            "Trợ lý AI đang bận. Bạn thử lại sau giây lát, hoặc bấm \"Gặp nhân viên\" để được hỗ trợ ngay nhé.",
          intent: "Unknown",
          quickReplies: [
            { label: "Gặp nhân viên", payload: "Tôi muốn gặp nhân viên" },
          ],
        };
      }
    }

    if (context.botFailCount + 1 >= settings.maxBotFailBeforeHandoff) {
      return {
        text:
          "Xin lỗi, mình chưa hiểu rõ yêu cầu của bạn. Để chắc chắn hỗ trợ tốt nhất, mình sẽ kết nối bạn với nhân viên nhé!",
        intent: "Unknown",
        shouldHandoff: true,
      };
    }

    return {
      text:
        "Mình chưa hiểu ý bạn. Bạn có thể chọn một trong các mục dưới đây, hoặc mô tả rõ hơn nhé:",
      intent: "Unknown",
      quickReplies: STARTER,
    };
  }

  private async orderSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const code = context.userText.match(/KK-\d{8}-[A-Za-z0-9]+/i)?.[0];
    const keywords = [
      "đơn hàng", "don hang", "tra cứu đơn", "tra cuu don",
      "trạng thái đơn", "trang thai don", "mã đơn", "ma don", "order",
    ];
    if (!code && !hasAny(lower, keywords)) return null;

    if (code) {
      if (!context.who.authenticated) {
        return {
          text:
            "Để bảo vệ thông tin đơn hàng, bạn vui lòng đăng nhập đúng tài khoản đã đặt rồi gửi lại mã đơn nhé.",
          intent: "OrderLookup",
        };
      }
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown;
        code: string;
        status: string;
        total: unknown;
        createdAt: Date | string;
        trackingCode: string | null;
        shippingStatus: string | null;
      }>>(
        `SELECT d.Id AS id, d.MaDonHang AS code, d.TrangThai AS status,
                d.TongTien AS total, d.NgayTao AS createdAt,
                d.MaVanDon AS trackingCode,
                (
                  SELECT h.TrangThai
                  FROM LichSuTrangThaiVanChuyen h
                  WHERE h.DonHangId = d.Id
                  ORDER BY h.Id DESC
                  LIMIT 1
                ) AS shippingStatus
         FROM DonHang d
         WHERE d.MaDonHang = ? AND d.NguoiDungId = ?
         LIMIT 1`,
        code.toUpperCase(),
        context.who.userId,
      );
      const order = rows[0];
      if (!order) {
        return {
          text:
            `Mình không tìm thấy đơn hàng ${code.toUpperCase()} gắn với tài khoản của bạn. Bạn kiểm tra lại mã đơn giúp mình nhé.`,
          intent: "OrderLookup",
        };
      }
      const status = this.statusText(order.status);
      const attachment: ChatAttachment = {
        type: "order",
        refId: order.code,
        title: `Đơn ${order.code}`,
        subtitle: `${status} • ${formatVnd(toNumber(order.total))}`,
        url: "/orders",
      };
      return {
        text:
          `Đơn ${order.code}:\n• Trạng thái: ${status}\n• Ngày đặt: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}\n• Tổng tiền: ${formatVnd(toNumber(order.total))}` +
          (order.trackingCode ? `\n• Mã vận đơn: ${order.trackingCode}` : "") +
          (order.shippingStatus ? `\n• Vận chuyển: ${order.shippingStatus}` : ""),
        intent: "OrderLookup",
        attachment,
      };
    }

    if (!context.who.authenticated) {
      return {
        text:
          "Bạn vui lòng đăng nhập để mình xem các đơn gần đây của bạn nhé.",
        intent: "OrderLookup",
      };
    }
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      code: string;
      status: string;
      total: unknown;
      createdAt: Date | string;
    }>>(
      `SELECT MaDonHang AS code, TrangThai AS status,
              TongTien AS total, NgayTao AS createdAt
       FROM DonHang
       WHERE NguoiDungId = ?
       ORDER BY NgayTao DESC
       LIMIT 5`,
      context.who.userId,
    );
    if (rows.length === 0) {
      return {
        text: "Bạn chưa có đơn hàng nào. Khám phá sản phẩm và đặt mua nhé!",
        intent: "OrderLookup",
      };
    }
    return {
      text:
        "Đây là các đơn hàng gần đây của bạn:\n" +
        rows
          .map(
            (row) =>
              `• ${row.code} — ${this.statusText(row.status)} — ${formatVnd(toNumber(row.total))} (${new Date(row.createdAt).toLocaleDateString("vi-VN")})`,
          )
          .join("\n") +
        "\n\nGửi mình mã đơn bạn muốn xem chi tiết nhé.",
      intent: "OrderLookup",
      quickReplies: rows.slice(0, 3).map((row) => ({
        label: row.code,
        payload: row.code,
      })),
    };
  }

  private async stockSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const keywords = [
      "còn hàng", "con hang", "còn size", "con size", "hết hàng",
      "het hang", "tồn kho", "ton kho", "còn không", "con khong",
      "size", "màu", "mau", "stock",
    ];
    if (!hasAny(lower, keywords)) return null;

    let productId = context.productContextId;
    if (!productId) {
      const candidates = await this.prisma.$queryRawUnsafe<
        Array<{ id: unknown; name: string }>
      >(
        `SELECT Id AS id, TenSanPham AS name
         FROM SanPham
         WHERE TrangThai IN ('active','out-of-stock')
         ORDER BY CHAR_LENGTH(TenSanPham) DESC`,
      );
      productId =
        toNumber(
          candidates.find((item) =>
            lower.includes(item.name.toLowerCase()),
          )?.id,
        ) || null;
    }

    if (!productId) {
      return {
        text:
          "Bạn cho mình biết tên sản phẩm (hoặc mở trang sản phẩm) để mình kiểm tra tồn kho size/màu giúp bạn nhé.",
        intent: "StockCheck",
      };
    }

    const products = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown;
      name: string;
      image: string | null;
      price: unknown;
      category: string;
      stock: unknown;
      reserved: unknown;
    }>>(
      `SELECT Id AS id, TenSanPham AS name, HinhAnh AS image,
              Gia AS price, DanhMuc AS category, TonKho AS stock,
              COALESCE(SoLuongDaGiu,0) AS reserved
       FROM SanPham WHERE Id = ? LIMIT 1`,
      productId,
    );
    const product = products[0];
    if (!product) return null;

    const variants = await this.prisma.$queryRawUnsafe<Array<{
      size: string;
      color: string;
      stock: unknown;
      reserved: unknown;
    }>>(
      `SELECT KichCo AS size, MauSac AS color,
              SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved
       FROM TonKhoBienThe
       WHERE SanPhamId = ?`,
      productId,
    );
    const normalized = variants.map((v) => ({
      ...v,
      available: Math.max(
        0,
        toNumber(v.stock) - toNumber(v.reserved),
      ),
    }));
    const available = normalized.filter((v) => v.available > 0);

    const askedSize = [...new Set(normalized.map((v) => v.size))]
      .find((size) =>
        size && lower.includes(size.toLowerCase()),
      );
    const askedColor = [...new Set(normalized.map((v) => v.color))]
      .find((color) =>
        color && lower.includes(color.toLowerCase()),
      );

    const attachment: ChatAttachment = {
      type: "product",
      refId: String(toNumber(product.id)),
      title: product.name,
      imageUrl: product.image,
      subtitle: formatVnd(toNumber(product.price)),
      url: `/product/${toNumber(product.id)}`,
    };

    if (variants.length === 0) {
      const free = Math.max(
        0,
        toNumber(product.stock) - toNumber(product.reserved),
      );
      return {
        text:
          free > 0
            ? `"${product.name}" hiện CÒN HÀNG (${free} sản phẩm khả dụng).`
            : `Rất tiếc, "${product.name}" hiện đã HẾT HÀNG.`,
        intent: "StockCheck",
        attachment,
      };
    }

    if (askedSize || askedColor) {
      const matched = normalized.filter(
        (v) =>
          (!askedSize ||
            v.size.toLowerCase() === askedSize.toLowerCase()) &&
          (!askedColor ||
            v.color.toLowerCase() === askedColor.toLowerCase()),
      );
      const variantText = [
        askedColor ? `màu ${askedColor}` : "",
        askedSize ? `size ${askedSize}` : "",
      ].filter(Boolean).join(" ");
      if (matched.some((v) => v.available > 0)) {
        return {
          text:
            `"${product.name}" ${variantText} hiện CÒN HÀNG. Bạn có thể đặt mua ngay nhé!`,
          intent: "StockCheck",
          attachment,
        };
      }
      return {
        text:
          `Rất tiếc, "${product.name}" ${variantText} hiện đã HẾT HÀNG.` +
          (available.length > 0
            ? " Bạn xem các lựa chọn còn hàng bên dưới nhé."
            : ""),
        intent: "StockCheck",
        attachment,
      };
    }

    if (available.length === 0) {
      const similar = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown;
        name: string;
        price: unknown;
        image: string | null;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, Gia AS price,
                HinhAnh AS image
         FROM SanPham
         WHERE Id <> ? AND DanhMuc = ?
           AND TrangThai = 'active' AND TonKho > 0
         ORDER BY SoLuongDaBan DESC
         LIMIT 3`,
        productId,
        product.category,
      );
      const extra =
        similar.length > 0
          ? "\nBạn tham khảo vài sản phẩm tương tự còn hàng nhé:\n" +
            similar
              .map(
                (item) =>
                  `• ${item.name} — ${formatVnd(toNumber(item.price))}`,
              )
              .join("\n")
          : "";
      return {
        text:
          `Rất tiếc, "${product.name}" hiện đã hết hàng.${extra}`,
        intent: "StockCheck",
        attachment:
          similar[0]
            ? {
                type: "product",
                refId: String(toNumber(similar[0].id)),
                title: similar[0].name,
                imageUrl: similar[0].image,
                subtitle: formatVnd(toNumber(similar[0].price)),
                url: `/product/${toNumber(similar[0].id)}`,
              }
            : attachment,
      };
    }

    const grouped = new Map<string, string[]>();
    for (const item of available) {
      const list = grouped.get(item.color) ?? [];
      list.push(`${item.size} (${item.available})`);
      grouped.set(item.color, list);
    }
    return {
      text:
        `"${product.name}" hiện còn các lựa chọn sau:\n` +
        [...grouped.entries()]
          .map(([color, sizes]) => `• Màu ${color}: ${sizes.join(", ")}`)
          .join("\n"),
      intent: "StockCheck",
      attachment,
    };
  }

  private async couponSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const keywords = [
      "mã giảm giá", "ma giam gia", "giảm giá", "giam gia",
      "khuyến mãi", "khuyen mai", "coupon", "voucher",
      "freeship", "ưu đãi", "uu dai",
    ];
    if (!hasAny(lower, keywords)) return null;
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      code: string;
      type: string;
      value: unknown;
      minOrder: unknown;
      maxDiscount: unknown;
      endDate: Date | string;
    }>>(
      `SELECT MaCoupon AS code, LoaiGiamGia AS type, GiaTri AS value,
              DonToiThieu AS minOrder, GiamToiDa AS maxDiscount,
              NgayKetThuc AS endDate
       FROM MaGiamGia
       WHERE TrangThai = 1
         AND NgayBatDau <= ?
         AND NgayKetThuc >= ?
         AND (SoLuotDung = 0 OR DaSuDung < SoLuotDung)
       ORDER BY NgayKetThuc
       LIMIT 10`,
      new Date(),
      new Date(),
    ).catch(() => []);

    if (rows.length === 0) {
      return {
        text:
          "Hiện chưa có mã giảm giá nào đang chạy. Bạn theo dõi trang Khuyến mãi để cập nhật ưu đãi mới nhất nhé!",
        intent: "Coupon",
      };
    }
    return {
      text:
        "Các mã giảm giá đang có hiệu lực:\n" +
        rows
          .map((row) => {
            const discount =
              row.type === "percent"
                ? `giảm ${toNumber(row.value)}%`
                : `giảm ${formatVnd(toNumber(row.value))}`;
            const conditions: string[] = [];
            if (toNumber(row.minOrder) > 0) {
              conditions.push(
                `đơn từ ${formatVnd(toNumber(row.minOrder))}`,
              );
            }
            if (
              row.type === "percent" &&
              toNumber(row.maxDiscount) > 0
            ) {
              conditions.push(
                `giảm tối đa ${formatVnd(toNumber(row.maxDiscount))}`,
              );
            }
            const suffix =
              conditions.length > 0
                ? ` (${conditions.join(", ")})`
                : "";
            return `• ${row.code} — ${discount}${suffix}, HSD ${new Date(row.endDate).toLocaleDateString("vi-VN")}`;
          })
          .join("\n") +
        "\n\nNhập mã ở bước thanh toán để áp dụng nhé.",
      intent: "Coupon",
    };
  }

  private async faqSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const topics = [
      {
        keys: ["đổi trả", "doi tra", "trả hàng", "tra hang", "hoàn tiền", "hoan tien"],
        code: "policy.return",
        fallback:
          "Chính sách đổi trả: bạn được đổi/trả trong vòng 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên tem mác và chưa qua sử dụng.",
        link: "/pages/chinh-sach-doi-tra",
      },
      {
        keys: ["phí ship", "phi ship", "vận chuyển", "van chuyen", "giao hàng", "giao hang"],
        code: "policy.shipping",
        fallback:
          "Phí vận chuyển được tính theo địa chỉ nhận hàng. Thời gian giao phụ thuộc khu vực và gói vận chuyển bạn chọn.",
        link: "/pages/chinh-sach-van-chuyen",
      },
      {
        keys: ["thanh toán", "thanh toan", "cod", "chuyển khoản", "chuyen khoan", "atm"],
        code: "policy.payment",
        fallback:
          "Cửa hàng hỗ trợ COD và chuyển khoản ngân hàng theo cấu hình đang bật.",
        link: "/pages/huong-dan-thanh-toan",
      },
      {
        keys: ["bảo mật", "bao mat", "thông tin cá nhân", "thong tin ca nhan", "privacy"],
        code: "policy.privacy",
        fallback:
          "Thông tin cá nhân của bạn được bảo mật và chỉ dùng để xử lý đơn hàng, không chia sẻ cho bên thứ ba.",
        link: "/pages/chinh-sach-bao-mat",
      },
    ];
    const topic = topics.find((item) => hasAny(lower, item.keys));
    if (!topic) return null;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value
       FROM CauHinhCuaHang
       WHERE MaCauHinh = ?
       LIMIT 1`,
      topic.code,
    ).catch(() => []);
    return {
      text:
        `${rows[0]?.value?.trim() || topic.fallback}\nXem chi tiết: ${topic.link}`,
      intent: "Faq",
    };
  }

  private async llm(
    context: BotContext,
    settings: {
      apiKey: string | null;
      endpoint: string | null;
      model: string;
    },
  ): Promise<string | null> {
    if (!settings.apiKey || !settings.endpoint) return null;
    const grounding = await this.retrieve(context);
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content:
          "Bạn là trợ lý tư vấn KaitoKid Shop. Trả lời ngắn gọn bằng tiếng Việt. Chỉ dùng DỮ LIỆU CỬA HÀNG; không bịa giá, tồn kho, chính sách hay đơn hàng.",
      },
      {
        role: "system",
        content:
          grounding || "DỮ LIỆU CỬA HÀNG: không có dữ liệu liên quan.",
      },
      ...context.recentHistory.slice(-6).map((item: MessageDto) => ({
        role: item.senderType === "customer" ? "user" : "assistant",
        content: item.content,
      })),
      { role: "user", content: context.userText },
    ];

    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }
    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() || null;
  }

  private async retrieve(context: BotContext): Promise<string> {
    const parts: string[] = [];
    if (context.productContextId) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown;
        name: string;
        price: unknown;
        stock: unknown;
        reserved: unknown;
        colors: string | null;
        sizes: string | null;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, Gia AS price,
                TonKho AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
                DanhSachMau AS colors, DanhSachSize AS sizes
         FROM SanPham WHERE Id = ? LIMIT 1`,
        context.productContextId,
      );
      const p = rows[0];
      if (p) {
        parts.push(
          `Sản phẩm đang xem: "${p.name}", giá ${formatVnd(toNumber(p.price))}, tồn khả dụng ${Math.max(0, toNumber(p.stock) - toNumber(p.reserved))}, màu ${p.colors ?? "chưa có"}, size ${p.sizes ?? "chưa có"}, link /product/${toNumber(p.id)}.`,
        );
      }
    }
    const policy = await this.prisma.$queryRawUnsafe<Array<{
      code: string;
      value: string;
    }>>(
      `SELECT MaCauHinh AS code, GiaTri AS value
       FROM CauHinhCuaHang
       WHERE MaCauHinh LIKE 'policy.%'
       LIMIT 8`,
    ).catch(() => []);
    if (policy.length > 0) {
      parts.push(
        "Chính sách: " +
          policy.map((item) => `${item.code}: ${item.value}`).join(" | "),
      );
    }
    return "DỮ LIỆU CỬA HÀNG:\n" + parts.join("\n");
  }

  private statusText(status: string) {
    const map: Record<string, string> = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao hàng",
      completed: "Hoàn thành",
      cancelled: "Đã hủy",
      returned: "Đã trả hàng",
    };
    return map[status] ?? status;
  }
}
