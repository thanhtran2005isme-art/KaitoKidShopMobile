import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  body?: Record<string, unknown>;
}

function bodyStatus(body: Record<string, unknown> | undefined): string {
  if (!body) return "";
  const entry = Object.entries(body).find(
    ([key]) => key.toLowerCase() === "trangthai",
  );
  return String(entry?.[1] ?? "").trim().toLowerCase();
}

/**
 * Chạy sau auth/guards và trước handler để chặn Admin tự tạo customer-receipt
 * hoặc returned qua endpoint status legacy.
 */
@Injectable()
export class AdminOrderStatusBoundaryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if ((request.method ?? "").toUpperCase() !== "PUT") return next.handle();

    const url = request.originalUrl ?? request.url ?? "";
    if (!/\/api\/admin\/orders\/\d+\/status(?:[/?]|$)/.test(url)) return next.handle();

    const status = bodyStatus(request.body);
    if (status === "completed") {
      throw new BadRequestException(
        "Admin không được tự hoàn tất đơn. Chỉ khách xác nhận đã nhận hàng mới tạo trạng thái completed.",
      );
    }
    if (status === "returned") {
      throw new BadRequestException(
        "Đơn trả hàng phải được xử lý qua workflow hậu mãi sau khi hàng thực tế quay về.",
      );
    }
    return next.handle();
  }
}
