import { Injectable, Logger } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { ChatSettingsService } from "./chat-settings.service.js";
import {
  CHAT_SENDER,
  type BotReply,
  type ChatAttachment,
  type ChatIdentity,
  type MessageRow,
  type QuickReply,
} from "./chat.types.js";

interface BotContext {
  conversationId: number;
  who: ChatIdentity;
  userText: string;
  productContextId: number | null;
  recentHistory: MessageRow[];
  botFailCount: number;
}

const STARTERS: QuickReply[] = [
  { label: "Tra cứu đơn hàng", payload: "Tôi muốn tra cứu đơn hàng" },
  { label: "Kiểm tra tồn kho", payload: "Sản phẩm này còn size nào?" },
  { label: "Mã giảm giá", payload: "Có mã giảm giá nào không?" },
  { label: "Chính sách đổi trả", payload: "Chính sách đổi trả thế nào?" },
  { label: "Gặp nhân viên", payload: "Tôi muốn gặp nhân viên" },
];

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ChatSettingsService,
  ) {}

  async mode() {
    const s = await this.settings.get();
    const llm = s.llmEnabled && Boolean(s.apiKey) && Boolean(s.endpoint);
    return {
      mode: llm ? "llm" : "rule",
      label: llm ? "Trợ lý AI" : "Trợ lý cơ bản",
    };
  }

  async respond(context: BotContext): Promise<BotReply> {
    const text = context.userText.trim();
    const lower = text.toLowerCase();
    if (
      [
        "gặp nhân viên", "gap nhan vien", "nhân viên", "nhan vien",
        "người thật", "nguoi that", "tư vấn viên", "tu van vien",
        "tổng đài", "tong dai",
      ].some((k) => lower.includes(k))
    ) {
      return this.handoff(
        "Mình đang kết nối bạn với nhân viên hỗ trợ. Bạn vui lòng chờ trong giây lát nhé!",
      );
    }

    const order = await this.orderSkill(context);
    if (order) return order;
    const stock = await this.stockSkill(context);
    if (stock) return stock;
    const coupon = await this.couponSkill(context);
    if (coupon) return coupon;
    const faq = await this.faqSkill(context);
    if (faq) return faq;

    if (
      !text ||
      ["xin chào", "xin chao", "chào", "chao", "hello", "hi", "alo", "shop ơi", "shop oi"]
        .some((k) => lower.includes(k))
    ) {
      return {
        text:
          "Xin chào! Mình là trợ lý của KaitoKid Shop 👋. Mình có thể giúp bạn tra cứu đơn hàng, kiểm tra tồn kho, mã giảm giá hoặc chính sách. Bạn cần hỗ trợ gì ạ?",
        intent: "Greeting",
        quickReplies: STARTERS,
        attachment: null,
        shouldHandoff: false,
      };
    }

    const s = await this.settings.get();
    if (s.llmEnabled && s.apiKey && s.endpoint) {
      const llm = await this.callLlm(context, s).catch((error) => {
        this.logger.warn(
          `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      });
      if (llm) {
        return {
          text: llm,
          intent: "Faq",
          quickReplies: [],
          attachment: null,
          shouldHandoff: false,
        };
      }
    }

    if (context.botFailCount + 1 >= s.maxBotFailBeforeHandoff) {
      return this.handoff(
        "Xin lỗi, mình chưa hiểu rõ yêu cầu của bạn. Để chắc chắn hỗ trợ tốt nhất, mình sẽ kết nối bạn với nhân viên nhé!",
      );
    }

    return {
      text:
        "Mình chưa hiểu ý bạn. Bạn có thể chọn một trong các mục dưới đây, hoặc mô tả rõ hơn nhé:",
      intent: "Unknown",
      quickReplies: STARTERS,
      attachment: null,
      shouldHandoff: false,
    };
  }

  private async orderSkill(context: BotContext): Promise<BotReply | null> {
    const text = context.userText;
    const lower = text.toLowerCase();
    const code = text.match(/KK-\d{8}-[A-Za-z0-9]+/i)?.[0]?.toUpperCase();
    const keywords = [
      "đơn hàng", "don hang", "tra cứu đơn", "tra cuu don",
      "tình trạng đơn", "trạng thái đơn", "mã đơn", "ma don", "order",
    ];
    if (!code && !keywords.some((k) => lower.includes(k))) return null;

    if (code) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown; orderCode: string; userId: unknown; status: string;
        total: unknown; createdAt: Date | string; trackingCode: string | null;
      }>>(
        `SELECT Id AS id, MaDonHang AS orderCode, NguoiDungId AS userId,
                TrangThai AS status, TongTien AS total, NgayTao AS createdAt,
                MaVanDon AS trackingCode
         FROM DonHang WHERE MaDonHang = ? LIMIT 1`,
        code,
      );
      const order = rows[0];
      if (
        !order ||
        context.who.userId === null ||
        toNumber(order.userId) !== context.who.userId
      ) {
        return this.simple(
          `Mình không tìm thấy đơn hàng ${code} gắn với tài khoản của bạn. Bạn kiểm tra lại mã đơn giúp mình nhé, hoặc đăng nhập đúng tài khoản đã đặt.`,
          "OrderLookup",
        );
      }
      const history = await this.prisma.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT TrangThai AS status
         FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId = ?
         ORDER BY Id DESC LIMIT 1`,
        toNumber(order.id),
      );
      const status = this.orderStatus(order.status);
      let message =
        `Đơn ${order.orderCode}:\n• Trạng thái: ${status}\n• Ngày đặt: ${new Date(order.createdAt).toLocaleDateString("vi-VN")}\n• Tổng tiền: ${this.vnd(toNumber(order.total))}`;
      if (["shipping", "confirmed"].includes(order.status)) {
        if (order.trackingCode) message += `\n• Mã vận đơn: ${order.trackingCode}`;
        if (history[0]?.status) message += `\n• Vận chuyển: ${history[0].status}`;
      }
      return {
        text: message,
        intent: "OrderLookup",
        quickReplies: [],
        attachment: {
          type: "order",
          refId: order.orderCode,
          title: `Đơn ${order.orderCode}`,
          subtitle: `${status} • ${this.vnd(toNumber(order.total))}`,
          url: "/orders",
        },
        shouldHandoff: false,
      };
    }

    if (context.who.userId === null) {
      return this.simple(
        "Bạn vui lòng cho mình mã đơn hàng (dạng KK-20250326-ABC123) để tra cứu, hoặc đăng nhập để mình xem các đơn gần đây của bạn nhé.",
        "OrderLookup",
      );
    }

    const recent = await this.prisma.$queryRawUnsafe<Array<{
      orderCode: string; status: string; total: unknown; createdAt: Date | string;
    }>>(
      `SELECT MaDonHang AS orderCode, TrangThai AS status,
              TongTien AS total, NgayTao AS createdAt
       FROM DonHang WHERE NguoiDungId = ?
       ORDER BY NgayTao DESC LIMIT 5`,
      context.who.userId,
    );
    if (!recent.length) {
      return this.simple(
        "Bạn chưa có đơn hàng nào. Khám phá sản phẩm và đặt mua nhé!",
        "OrderLookup",
      );
    }
    const lines = recent.map(
      (o) =>
        `• ${o.orderCode} — ${this.orderStatus(o.status)} — ${this.vnd(toNumber(o.total))} (${new Date(o.createdAt).toLocaleDateString("vi-VN")})`,
    );
    return {
      text:
        `Đây là các đơn hàng gần đây của bạn:\n${lines.join("\n")}\n\nGửi mình mã đơn bạn muốn xem chi tiết nhé.`,
      intent: "OrderLookup",
      quickReplies: recent.slice(0, 3).map((o) => ({
        label: o.orderCode,
        payload: o.orderCode,
      })),
      attachment: null,
      shouldHandoff: false,
    };
  }

  private async stockSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const keywords = [
      "còn hàng", "con hang", "còn size", "con size", "hết hàng",
      "tồn kho", "ton kho", "còn không", "size", "màu", "mau", "stock",
    ];
    if (!keywords.some((k) => lower.includes(k))) return null;

    let product: {
      id: number; name: string; image: string; price: number; category: string;
    } | null = null;

    if (context.productContextId) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown; name: string; image: string; price: unknown; category: string;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, HinhAnh AS image,
                Gia AS price, DanhMuc AS category
         FROM SanPham WHERE Id = ? LIMIT 1`,
        context.productContextId,
      );
      if (rows[0]) {
        product = {
          id: toNumber(rows[0].id),
          name: rows[0].name,
          image: rows[0].image,
          price: toNumber(rows[0].price),
          category: rows[0].category,
        };
      }
    }

    if (!product) {
      const candidates = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown; name: string; image: string; price: unknown; category: string;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, HinhAnh AS image,
                Gia AS price, DanhMuc AS category
         FROM SanPham WHERE TrangThai = 'active'`,
      );
      const best = candidates
        .filter((p) => lower.includes(p.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (best) {
        product = {
          id: toNumber(best.id),
          name: best.name,
          image: best.image,
          price: toNumber(best.price),
          category: best.category,
        };
      }
    }

    if (!product) {
      return this.simple(
        "Bạn cho mình biết tên sản phẩm (hoặc mở trang sản phẩm) để mình kiểm tra tồn kho size/màu giúp bạn nhé.",
        "StockCheck",
      );
    }

    const variants = await this.prisma.$queryRawUnsafe<Array<{
      size: string; color: string; stock: unknown; reserved: unknown;
    }>>(
      `SELECT KichCo AS size, MauSac AS color,
              SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved
       FROM TonKhoBienThe WHERE SanPhamId = ?`,
      product.id,
    );
    const available = variants
      .map((v) => ({ ...v, available: Math.max(0, toNumber(v.stock) - toNumber(v.reserved)) }))
      .filter((v) => v.available > 0);

    const askedSize = [...new Set(variants.map((v) => v.size))]
      .find((v) => v && lower.includes(v.toLowerCase()));
    const askedColor = [...new Set(variants.map((v) => v.color))]
      .find((v) => v && lower.includes(v.toLowerCase()));
    if (askedSize || askedColor) {
      const matched = available.filter(
        (v) =>
          (!askedSize || v.size.toLowerCase() === askedSize.toLowerCase()) &&
          (!askedColor || v.color.toLowerCase() === askedColor.toLowerCase()),
      );
      const label =
        `${askedColor ? `màu ${askedColor}` : ""}${askedSize ? ` size ${askedSize}` : ""}`.trim();
      return this.simple(
        matched.length
          ? `"${product.name}" ${label} hiện CÒN HÀNG. Bạn có thể đặt mua ngay nhé!`
          : `Rất tiếc, "${product.name}" ${label} hiện đã HẾT HÀNG.`,
        "StockCheck",
      );
    }

    if (available.length) {
      const groups = new Map<string, string[]>();
      for (const v of available) {
        const list = groups.get(v.color) ?? [];
        list.push(`${v.size} (${v.available})`);
        groups.set(v.color, list);
      }
      return {
        text:
          `"${product.name}" hiện còn các lựa chọn sau:\n` +
          [...groups.entries()].map(([color, sizes]) => `• Màu ${color}: ${sizes.join(", ")}`).join("\n"),
        intent: "StockCheck",
        quickReplies: [],
        attachment: this.productAttachment(product),
        shouldHandoff: false,
      };
    }

    const similar = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown; name: string; image: string; price: unknown; category: string;
    }>>(
      `SELECT Id AS id, TenSanPham AS name, HinhAnh AS image,
              Gia AS price, DanhMuc AS category
       FROM SanPham
       WHERE Id <> ? AND DanhMuc = ? AND TrangThai = 'active' AND TonKho > 0
       ORDER BY SoLuongDaBan DESC LIMIT 3`,
      product.id,
      product.category,
    );
    return {
      text:
        `Rất tiếc, "${product.name}" hiện đã hết hàng.` +
        (similar.length
          ? ` Bạn tham khảo vài sản phẩm tương tự còn hàng nhé:\n${similar
              .map((p) => `• ${p.name} — ${this.vnd(toNumber(p.price))}`)
              .join("\n")}`
          : ""),
      intent: "StockCheck",
      quickReplies: [],
      attachment: similar[0]
        ? this.productAttachment({
            id: toNumber(similar[0].id),
            name: similar[0].name,
            image: similar[0].image,
            price: toNumber(similar[0].price),
            category: similar[0].category,
          })
        : null,
      shouldHandoff: false,
    };
  }

  private async couponSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    if (
      ![
        "mã giảm giá", "ma giam gia", "giảm giá", "giam gia",
        "khuyến mãi", "khuyen mai", "coupon", "voucher", "freeship", "ưu đãi",
      ].some((k) => lower.includes(k))
    ) {
      return null;
    }
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      code: string; type: string; value: unknown; minOrder: unknown;
      maxDiscount: unknown; endDate: Date | string;
    }>>(
      `SELECT MaCoupon AS code, LoaiGiamGia AS type, GiaTri AS value,
              DonToiThieu AS minOrder, GiamToiDa AS maxDiscount,
              NgayKetThuc AS endDate
       FROM MaGiamGia
       WHERE TrangThai = 1
         AND NgayBatDau <= ?
         AND NgayKetThuc >= ?
         AND (SoLuotDung = 0 OR DaSuDung < SoLuotDung)
       ORDER BY NgayKetThuc LIMIT 10`,
      new Date(),
      new Date(),
    );
    if (!rows.length) {
      return this.simple(
        "Hiện chưa có mã giảm giá nào đang chạy. Bạn theo dõi trang Khuyến mãi để cập nhật ưu đãi mới nhất nhé!",
        "Coupon",
      );
    }
    return this.simple(
      `Các mã giảm giá đang có hiệu lực:\n${rows
        .map((c) => {
          const discount =
            c.type === "percent"
              ? `giảm ${toNumber(c.value)}%`
              : `giảm ${this.vnd(toNumber(c.value))}`;
          const conditions = [];
          if (toNumber(c.minOrder) > 0) {
            conditions.push(`đơn từ ${this.vnd(toNumber(c.minOrder))}`);
          }
          if (c.type === "percent" && toNumber(c.maxDiscount) > 0) {
            conditions.push(`giảm tối đa ${this.vnd(toNumber(c.maxDiscount))}`);
          }
          return `• ${c.code} — ${discount}${conditions.length ? ` (${conditions.join(", ")})` : ""}, HSD ${new Date(c.endDate).toLocaleDateString("vi-VN")}`;
        })
        .join("\n")}\n\nNhập mã ở bước thanh toán để áp dụng nhé.`,
      "Coupon",
    );
  }

  private async faqSkill(context: BotContext): Promise<BotReply | null> {
    const lower = context.userText.toLowerCase();
    const topics = [
      {
        keywords: ["đổi trả", "doi tra", "trả hàng", "hoàn tiền", "bảo hành"],
        code: "policy.return",
        fallback:
          "Chính sách đổi trả: bạn được đổi/trả trong vòng 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên tem mác và chưa qua sử dụng.",
        link: "/pages/chinh-sach-doi-tra",
      },
      {
        keywords: ["phí ship", "phi ship", "vận chuyển", "giao hàng", "phí giao", "bao lâu", "freeship"],
        code: "policy.shipping",
        fallback:
          "Phí vận chuyển được tính theo địa chỉ nhận hàng. Thời gian giao phụ thuộc khu vực và nhà vận chuyển.",
        link: "/pages/chinh-sach-van-chuyen",
      },
      {
        keywords: ["thanh toán", "thanh toan", "trả tiền", "cod", "chuyển khoản", "atm"],
        code: "policy.payment",
        fallback:
          "Cửa hàng hỗ trợ COD và chuyển khoản ngân hàng theo cấu hình hiện tại.",
        link: "/pages/huong-dan-thanh-toan",
      },
      {
        keywords: ["bảo mật", "bao mat", "thông tin cá nhân", "privacy"],
        code: "policy.privacy",
        fallback:
          "Thông tin cá nhân của bạn được bảo mật và chỉ dùng để xử lý đơn hàng.",
        link: "/pages/chinh-sach-bao-mat",
      },
    ];
    const topic = topics.find((t) => t.keywords.some((k) => lower.includes(k)));
    if (!topic) return null;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value
       FROM CauHinhCuaHang
       WHERE MaCauHinh = ? LIMIT 1`,
      topic.code,
    );
    return this.simple(
      `${rows[0]?.value?.trim() || topic.fallback}\nXem chi tiết: ${topic.link}`,
      "Faq",
    );
  }

  private async callLlm(
    context: BotContext,
    settings: Awaited<ReturnType<ChatSettingsService["get"]>>,
  ): Promise<string | null> {
    const grounding = await this.retrieveGrounding(
      context.userText,
      context.productContextId,
    );
    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content:
          "Bạn là trợ lý tư vấn của KaitoKid Shop (thời trang). Trả lời ngắn gọn, thân thiện, lịch sự bằng tiếng Việt. CHỈ dựa vào DỮ LIỆU CỬA HÀNG để nói về sản phẩm, giá, tồn kho, chính sách; không bịa. Nếu thiếu dữ liệu hãy nói chưa có thông tin và đề nghị gặp nhân viên.",
      },
      {
        role: "system",
        content:
          grounding ||
          "DỮ LIỆU CỬA HÀNG: (không tìm thấy dữ liệu liên quan)",
      },
    ];
    for (const m of context.recentHistory.slice(-6)) {
      messages.push({
        role:
          m.senderType === CHAT_SENDER.CUSTOMER ? "user" : "assistant",
        content: m.content,
      });
    }
    messages.push({ role: "user", content: context.userText });

    const response = await fetch(settings.endpoint!, {
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
    if (!response.ok) return null;
    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() || null;
  }

  private async retrieveGrounding(
    query: string,
    productContextId: number | null,
  ): Promise<string> {
    const chunks: string[] = [];
    if (productContextId) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown; name: string; price: unknown; category: string;
        colors: string | null; sizes: string | null; stock: unknown; reserved: unknown;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, Gia AS price,
                DanhMuc AS category, DanhSachMau AS colors,
                DanhSachSize AS sizes, TonKho AS stock,
                COALESCE(SoLuongDaGiu,0) AS reserved
         FROM SanPham WHERE Id = ? LIMIT 1`,
        productContextId,
      );
      const p = rows[0];
      if (p) {
        chunks.push(
          `Sản phẩm đang xem: "${p.name}", giá ${this.vnd(toNumber(p.price))}, danh mục ${p.category}, tồn khả dụng ${Math.max(0, toNumber(p.stock)-toNumber(p.reserved))}, màu ${p.colors ?? "[]"}, size ${p.sizes ?? "[]"}.`,
        );
      }
    }
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((x) => x.length >= 2)
      .slice(0, 5);
    if (tokens.length) {
      const products = await this.prisma.$queryRawUnsafe<Array<{
        id: unknown; name: string; price: unknown; category: string;
        stock: unknown; reserved: unknown;
      }>>(
        `SELECT Id AS id, TenSanPham AS name, Gia AS price,
                DanhMuc AS category, TonKho AS stock,
                COALESCE(SoLuongDaGiu,0) AS reserved
         FROM SanPham
         WHERE TrangThai='active'
           AND (${tokens.map(() => "LOWER(TenSanPham) LIKE ?").join(" OR ")})
         ORDER BY SoLuongDaBan DESC LIMIT 6`,
        ...tokens.map((t) => `%${t}%`),
      );
      for (const p of products) {
        chunks.push(
          `Sản phẩm: "${p.name}" (/product/${toNumber(p.id)}), giá ${this.vnd(toNumber(p.price))}, danh mục ${p.category}, tồn khả dụng ${Math.max(0,toNumber(p.stock)-toNumber(p.reserved))}.`,
        );
      }
    }
    return chunks.length ? `DỮ LIỆU CỬA HÀNG:\n${chunks.join("\n")}` : "";
  }

  private simple(text: string, intent: string): BotReply {
    return {
      text,
      intent,
      quickReplies: [],
      attachment: null,
      shouldHandoff: false,
    };
  }

  private handoff(text: string): BotReply {
    return {
      text,
      intent: "Handoff",
      quickReplies: [],
      attachment: null,
      shouldHandoff: true,
    };
  }

  private productAttachment(product: {
    id: number; name: string; image: string; price: number;
  }): ChatAttachment {
    return {
      type: "product",
      refId: String(product.id),
      title: product.name,
      imageUrl: product.image,
      subtitle: this.vnd(product.price),
      url: `/product/${product.id}`,
    };
  }

  private orderStatus(status: string): string {
    return ({
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao hàng",
      completed: "Hoàn thành",
      cancelled: "Đã hủy",
      returned: "Đã trả hàng",
    } as Record<string, string>)[status] ?? status;
  }

  private vnd(value: number): string {
    return `${Math.trunc(value).toLocaleString("vi-VN")}đ`;
  }
}
