import { BadRequestException } from "@nestjs/common";

export const RETURN_REASON_LABELS = {
  defective: "Sản phẩm bị lỗi sản xuất, đường may",
  damaged: "Sản phẩm bị rách, hỏng khi nhận",
  wrong_item: "Shop giao sai sản phẩm",
  wrong_variant: "Sai kích cỡ hoặc màu sắc",
  not_as_described: "Sản phẩm khác mô tả hoặc hình ảnh",
  missing_items: "Thiếu sản phẩm hoặc phụ kiện",
  other: "Lý do khác",
} as const;

export type ReturnEvidenceImage = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

export function normalizeReturnReason(body: Record<string, unknown>): string {
  const code = typeof body.reasonCode === "string" ? body.reasonCode.trim() : "";
  // Backward compatibility for old App builds sending {reason}.
  const legacy = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!code && legacy) {
    if (legacy.length < 5 || legacy.length > 450) {
      throw new BadRequestException("Lý do hoàn hàng cần từ 5 đến 450 ký tự.");
    }
    return legacy;
  }
  if (!Object.prototype.hasOwnProperty.call(RETURN_REASON_LABELS, code)) {
    throw new BadRequestException("Vui lòng chọn lý do hoàn hàng hợp lệ.");
  }
  const detail = typeof body.detail === "string" ? body.detail.trim() : "";
  if (code === "other" && detail.length < 5) {
    throw new BadRequestException("Khi chọn Khác, cần mô tả chi tiết ít nhất 5 ký tự.");
  }
  if (detail.length > 380) {
    throw new BadRequestException("Mô tả lý do hoàn hàng tối đa 380 ký tự.");
  }
  const label = RETURN_REASON_LABELS[code as keyof typeof RETURN_REASON_LABELS];
  return detail ? label + ": " + detail : label;
}

export function validateReturnImages(files: ReturnEvidenceImage[]): Array<{ buffer: Buffer; extension: string }> {
  if (!Array.isArray(files) || files.length > 3) {
    throw new BadRequestException("Tối đa 3 ảnh cho một yêu cầu hoàn hàng.");
  }
  return files.map((file) => {
    if (!file.buffer || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("Ảnh bằng chứng phải có dung lượng tối đa 5MB.");
    }
    const mime = file.mimetype.toLowerCase();
    const bytes = file.buffer;
    const jpeg = mime === "image/jpeg" && bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = mime === "image/png" && bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = mime === "image/webp" && bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!jpeg && !png && !webp) {
      throw new BadRequestException("Ảnh không hợp lệ. Chỉ nhận JPEG, PNG hoặc WebP.");
    }
    return { buffer: bytes, extension: jpeg ? ".jpg" : png ? ".png" : ".webp" };
  });
}
