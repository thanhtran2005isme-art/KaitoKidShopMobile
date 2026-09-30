import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type {
  BotReply,
  ChatAttachment,
  ChatIdentity,
  MessageDto,
  QuickReply,
} from "./chat.types.js";

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
  "tổng đài", "tong dai",
];
const GREET = ["xin chào", "xin chao", "chào", "chao", "hello", "hi", "alo", "shop ơi", "shop oi"];
const ORDER = ["đơn hàng", "don hang", "tra cứu đơn", "tra cuu don", "mã đơn", "ma don", "order"];
const STOCK = ["còn hàng", "con hang", "còn size", "con size", "hết hàng", "het hang", "tồn kho", "ton kho", "size", "màu", "mau", "stock"];
const COUPON = ["mã giảm giá", "ma giam gia", "giảm giá", "giam gia", "khuyến mãi", "khuyen mai", "coupon", "voucher", "freeship"];
const FAQ = ["đổi trả", "doi tra", "trả hàng", "tra hang", "hoàn tiền", "hoan tien", "phí ship", "phi ship", "vận chuyển", "van chuyen", "thanh toán", "thanh toan", "bảo mật", "bao mat"];

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function reply(
  text: string,
  intent: string,
  extra: Partial<BotReply> = {},
): BotReply {
  return {
    text,
    intent,
    quickReplies: [],
    attachment: null,
    shouldHandoff: false,
    ...extra,
  };
}

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async mode() {
    const settings = await this.settings();
    const llm = settings.enabled && Boolean(settings.apiKey) && Boolean(settings.endpoint);
    return {
      mode: llm ? "llm" : "rule",
      label: llm ? "Trợ lý AI" : "Trợ lý cơ bản",
    };
  }

  async respond(context: {
    conversationId: number;
    who: ChatIdentity;
    userText: string;
    productContextId: number | null;
    recent: MessageDto[];
    botFailCount: number;
  }): Promise<BotReply> {
    const text = context.userText.trim();
    const lower = text.toLowerCase();

    if (includesAny(lower, HANDOFF)) {
      return reply(
        "Mình đang kết nối bạn với nhân viên hỗ trợ. Bạn vui lòng chờ trong giây lát nhé!",
        "Handoff",
        { shouldHandoff: true },
      );
    }

    if (!text || includesAny(lower, GREET)) {
      return reply(
        "Xin chào! Mình là trợ lý của KaitoKid Shop 👋. Mình có thể giúp bạn tra cứu đơn hàng, kiểm tra tồn kho, mã giảm giá hoặc chính sách. Bạn cần hỗ trợ gì ạ?",
        "Greeting",
        { quickReplies: STARTER },
      );
    }

    if (/KK-\d{8}-[A-Za-z0-9]+/i.test(text) || includesAny(lower, ORDER)) {
      return this.order(context.who, text);
    }
    if (includesAny(lower, STOCK)) {
      return this.stock(context.productContextId, text);
    }
    if (includesAny(lower, COUPON)) {
      return this.coupons();
    }
    if (includesAny(lower, FAQ)) {
      return this.faq(text);
    }

    const settings = await this.settings();
    if (settings.enabled && settings.apiKey && settings.endpoint) {
      try {
        const answer = await this.llm(context, settings);
        if (answer) return reply(answer, "Faq");
      } catch (error) {
        this.logger.warn(
          "LLM chat lỗi: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return reply(
          "Trợ lý AI đang bận. Bạn thử lại sau giây lát, hoặc bấm \"Gặp nhân viên\" để được hỗ trợ ngay nhé.",
          "Unknown",
          {
            quickReplies: [
              { label: "Gặp nhân viên", payload: "Tôi muốn gặp nhân viên" },
            ],
          },
        );
      }
    }

    if (context.botFailCount + 1 >= settings.maxFail) {
      return reply(
        "Xin lỗi, mình chưa hiểu rõ yêu cầu của bạn. Để chắc chắn hỗ trợ tốt nhất, mình sẽ kết nối bạn với nhân viên nhé!",
        "Handoff",
        { shouldHandoff: true },
      );
    }

    return reply(
      "Mình chưa hiểu ý bạn. Bạn có thể chọn một trong các mục dưới đây, hoặc mô tả rõ hơn nhé:",
      "Unknown",
      { quickReplies: STARTER },
    );
  }

  private async order(who: ChatIdentity, text: string): Promise<BotReply> {
    const match = text.match(/KK-\d{8}-[A-Za-z0-9]+/i);

    if (match) {
      const code = match[0].toUpperCase();
      if (!who.userId) {
        return reply(
          "Bạn vui lòng đăng nhập đúng tài khoản đã đặt để mình tra cứu đơn này nhé.",
          "OrderLookup",
        );
      }

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: unknown;
          code: string;
          status: string;
          total: unknown;
          trackingCode: string | null;
        }>
      >(
        "SELECT Id AS id, MaDonHang AS code, TrangThai AS status, TongTien AS total, MaVanDon AS trackingCode FROM DonHang WHERE MaDonHang = ? AND NguoiDungId = ? LIMIT 1",
        code,
        who.userId,
      );
      const order = rows[0];
      if (!order) {
        return reply(
          "Mình không tìm thấy đơn hàng " +
            code +
            " gắn với tài khoản của bạn. Bạn kiểm tra lại mã đơn giúp mình nhé.",
          "OrderLookup",
        );
      }

      const attachment: ChatAttachment = {
        type: "order",
        refId: code,
        title: "Đơn " + code,
        subtitle: this.status(order.status) + " • " + this.vnd(Number(order.total)),
        url: "/orders",
      };

      let message =
        "Đơn " +
        code +
        ":\n• Trạng thái: " +
        this.status(order.status) +
        "\n• Tổng tiền: " +
        this.vnd(Number(order.total));
      if (order.trackingCode) {
        message += "\n• Mã vận đơn: " + order.trackingCode;
      }
      return reply(message, "OrderLookup", { attachment });
    }

    if (!who.userId) {
      return reply(
        "Bạn vui lòng cho mình mã đơn hàng (dạng KK-20250326-ABC123), hoặc đăng nhập để mình xem các đơn gần đây của bạn nhé.",
        "OrderLookup",
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ code: string; status: string; total: unknown }>
    >(
      "SELECT MaDonHang AS code, TrangThai AS status, TongTien AS total FROM DonHang WHERE NguoiDungId = ? ORDER BY NgayTao DESC LIMIT 5",
      who.userId,
    );

    if (!rows.length) {
      return reply(
        "Bạn chưa có đơn hàng nào. Khám phá sản phẩm và đặt mua nhé!",
        "OrderLookup",
      );
    }

    const lines = rows.map(
      (item) =>
        "• " +
        item.code +
        " — " +
        this.status(item.status) +
        " — " +
        this.vnd(Number(item.total)),
    );

    return reply(
      "Đây là các đơn hàng gần đây của bạn:\n" +
        lines.join("\n") +
        "\n\nGửi mình mã đơn bạn muốn xem chi tiết nhé.",
      "OrderLookup",
      {
        quickReplies: rows
          .slice(0, 3)
          .map((item) => ({ label: item.code, payload: item.code })),
      },
    );
  }

  private async stock(
    productContextId: number | null,
    text: string,
  ): Promise<BotReply> {
    type Product = {
      id: unknown;
      name: string;
      category: string;
      price: unknown;
      image: string | null;
      stock: unknown;
    };

    let product: Product | undefined;
    if (productContextId) {
      const rows = await this.prisma.$queryRawUnsafe<Product[]>(
        "SELECT Id AS id, TenSanPham AS name, DanhMuc AS category, Gia AS price, HinhAnh AS image, TonKho AS stock FROM SanPham WHERE Id = ? LIMIT 1",
        productContextId,
      );
      product = rows[0];
    }

    if (!product) {
      const candidates = await this.prisma.$queryRawUnsafe<Product[]>(
        "SELECT Id AS id, TenSanPham AS name, DanhMuc AS category, Gia AS price, HinhAnh AS image, TonKho AS stock FROM SanPham WHERE TrangThai = 'active' ORDER BY CHAR_LENGTH(TenSanPham) DESC LIMIT 500",
      );
      const lower = text.toLowerCase();
      product = candidates.find((item) =>
        lower.includes(item.name.toLowerCase()),
      );
    }

    if (!product) {
      return reply(
        "Bạn cho mình biết tên sản phẩm (hoặc mở trang sản phẩm) để mình kiểm tra tồn kho size/màu giúp bạn nhé.",
        "StockCheck",
      );
    }

    const variants = await this.prisma.$queryRawUnsafe<
      Array<{ size: string; color: string; stock: unknown; reserved: unknown }>
    >(
      "SELECT KichCo AS size, MauSac AS color, SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved FROM TonKhoBienThe WHERE SanPhamId = ?",
      Number(product.id),
    );

    const attachment: ChatAttachment = {
      type: "product",
      refId: String(product.id),
      title: product.name,
      imageUrl: product.image,
      subtitle: this.vnd(Number(product.price)),
      url: "/product/" + String(product.id),
    };

    if (!variants.length) {
      return reply(
        Number(product.stock) > 0
          ? '"' + product.name + '" hiện CÒN HÀNG.'
          : 'Rất tiếc, "' + product.name + '" hiện đã hết hàng.',
        "StockCheck",
        { attachment },
      );
    }

    const available = variants
      .map((item) => ({
        ...item,
        available: Number(item.stock) - Number(item.reserved),
      }))
      .filter((item) => item.available > 0);

    if (!available.length) {
      return reply(
        'Rất tiếc, "' + product.name + '" hiện đã hết hàng.',
        "StockCheck",
        { attachment },
      );
    }

    const groups = new Map<string, string[]>();
    for (const item of available) {
      const list = groups.get(item.color) ?? [];
      list.push(item.size + " (" + item.available + ")");
      groups.set(item.color, list);
    }

    const details = [...groups.entries()]
      .map(([color, sizes]) => "• Màu " + color + ": " + sizes.join(", "))
      .join("\n");

    return reply(
      '"' + product.name + '" hiện còn các lựa chọn sau:\n' + details,
      "StockCheck",
      { attachment },
    );
  }

  private async coupons(): Promise<BotReply> {
    const now = new Date();
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        code: string;
        type: string;
        value: unknown;
        endDate: Date | string;
      }>
    >(
      "SELECT MaCoupon AS code, LoaiGiamGia AS type, GiaTri AS value, NgayKetThuc AS endDate FROM MaGiamGia WHERE TrangThai = 1 AND NgayBatDau <= ? AND NgayKetThuc >= ? AND (SoLuotDung = 0 OR DaSuDung < SoLuotDung) ORDER BY NgayKetThuc LIMIT 10",
      now,
      now,
    );

    if (!rows.length) {
      return reply(
        "Hiện chưa có mã giảm giá nào đang chạy. Bạn theo dõi trang Khuyến mãi để cập nhật ưu đãi mới nhất nhé!",
        "Coupon",
      );
    }

    const lines = rows.map((item) => {
      const discount =
        item.type === "percent"
          ? "giảm " + String(item.value) + "%"
          : "giảm " + this.vnd(Number(item.value));
      return "• " + item.code + " — " + discount;
    });

    return reply(
      "Các mã giảm giá đang có hiệu lực:\n" +
        lines.join("\n") +
        "\n\nNhập mã ở bước thanh toán để áp dụng nhé.",
      "Coupon",
    );
  }

  private async faq(text: string): Promise<BotReply> {
    const lower = text.toLowerCase();
    let code: string;
    let fallback: string;
    let link: string;

    if (includesAny(lower, ["đổi", "doi", "trả", "tra", "hoàn", "hoan"])) {
      code = "policy.return";
      fallback =
        "Chính sách đổi trả: bạn được đổi/trả trong vòng 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên tem mác và chưa qua sử dụng.";
      link = "/pages/chinh-sach-doi-tra";
    } else if (
      includesAny(lower, ["ship", "vận chuyển", "van chuyen", "giao", "phí", "phi"])
    ) {
      code = "policy.shipping";
      fallback =
        "Phí vận chuyển được tính theo địa chỉ nhận hàng. Thời gian giao thường 2–5 ngày tùy khu vực.";
      link = "/pages/chinh-sach-van-chuyen";
    } else if (
      includesAny(lower, ["thanh toán", "thanh toan", "cod", "chuyển khoản", "atm"])
    ) {
      code = "policy.payment";
      fallback =
        "Cửa hàng hỗ trợ COD và chuyển khoản ngân hàng theo cấu hình hiện tại.";
      link = "/pages/huong-dan-thanh-toan";
    } else {
      code = "policy.privacy";
      fallback =
        "Thông tin cá nhân của bạn được bảo mật và chỉ dùng để xử lý nghiệp vụ cửa hàng.";
      link = "/pages/chinh-sach-bao-mat";
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ value: string }>>(
      "SELECT GiaTri AS value FROM CauHinhCuaHang WHERE MaCauHinh = ? LIMIT 1",
      code,
    );

    return reply(
      (rows[0]?.value?.trim() || fallback) + "\nXem chi tiết: " + link,
      "Faq",
    );
  }

  private async settings() {
    const rows = await this.prisma
      .$queryRawUnsafe<Array<{ code: string; value: string }>>(
        "SELECT MaCauHinh AS code, GiaTri AS value FROM CauHinhCuaHang WHERE NhomCauHinh = 'chatbot'",
      )
      .catch(() => []);
    const map = new Map(rows.map((item) => [item.code, item.value]));

    const apiKey =
      map.get("chatLlmApiKey") || process.env.CHAT_LLM_API_KEY || "";
    const endpoint =
      map.get("chatLlmEndpoint") || process.env.CHAT_LLM_ENDPOINT || "";
    const model =
      map.get("chatLlmModel") || process.env.CHAT_LLM_MODEL || "gpt-4o-mini";
    const enabledRaw = map.get("chatLlmEnabled");
    const enabled =
      enabledRaw == null ? Boolean(apiKey) : /^true$/i.test(enabledRaw);

    return {
      enabled,
      apiKey,
      endpoint,
      model,
      maxFail: Math.max(
        1,
        Number(process.env.CHAT_MAX_BOT_FAIL_BEFORE_HANDOFF ?? 2),
      ),
    };
  }

  private async llm(
    context: {
      userText: string;
      recent: MessageDto[];
    },
    settings: {
      apiKey: string;
      endpoint: string;
      model: string;
    },
  ): Promise<string | null> {
    const products = await this.prisma.$queryRawUnsafe<
      Array<{
        id: unknown;
        name: string;
        price: unknown;
        stock: unknown;
        category: string;
      }>
    >(
      "SELECT Id AS id, TenSanPham AS name, Gia AS price, TonKho AS stock, DanhMuc AS category FROM SanPham WHERE TrangThai = 'active' ORDER BY SoLuongDaBan DESC LIMIT 80",
    );

    const words = context.userText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2);
    const matched = products
      .filter((item) =>
        words.some((word) =>
          (item.name + " " + item.category).toLowerCase().includes(word),
        ),
      )
      .slice(0, 6);

    const grounding = matched.length
      ? matched
          .map(
            (item) =>
              '- "' +
              item.name +
              '", giá ' +
              this.vnd(Number(item.price)) +
              ", " +
              (Number(item.stock) > 0 ? "còn hàng" : "hết hàng") +
              ", link /product/" +
              String(item.id),
          )
          .join("\n")
      : "(không tìm thấy dữ liệu liên quan)";

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content:
          "Bạn là trợ lý KaitoKid Shop. Chỉ dùng dữ liệu cửa hàng được cung cấp; không bịa giá, tồn kho, chính sách. Trả lời ngắn gọn bằng tiếng Việt.",
      },
      {
        role: "system",
        content: "DỮ LIỆU CỬA HÀNG:\n" + grounding,
      },
      ...context.recent.slice(-6).map((item) => ({
        role: item.senderType === "customer" ? "user" : "assistant",
        content: item.content,
      })),
      { role: "user", content: context.userText },
    ];

    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + settings.apiKey,
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
      throw new Error("LLM HTTP " + response.status);
    }

    const json = (await response.json()) as Record<string, any>;
    const content = json?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  }

  private status(status: string): string {
    return (
      {
        pending: "Chờ xác nhận",
        confirmed: "Đã xác nhận",
        shipping: "Đang giao hàng",
        completed: "Hoàn thành",
        cancelled: "Đã hủy",
        returned: "Đã trả hàng",
      } as Record<string, string>
    )[status] ?? status;
  }

  private vnd(value: number): string {
    return Math.trunc(value).toLocaleString("vi-VN") + "đ";
  }
}
