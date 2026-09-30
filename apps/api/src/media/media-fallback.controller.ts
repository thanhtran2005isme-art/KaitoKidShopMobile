import { Controller, Get, Header } from "@nestjs/common";

const PRODUCT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5f3ff"/><stop offset="100%" stop-color="#ede9fe"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <circle cx="400" cy="410" r="120" fill="#ddd6fe"/>
  <path d="M330 355h140l58 78-58 52v190H330V485l-58-52 58-78z" fill="#8b5cf6"/>
  <text x="400" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#4c1d95">KaitoKid</text>
  <text x="400" y="820" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#6d28d9">Hình ảnh sản phẩm đang cập nhật</text>
</svg>`;

const LOOKBOOK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125" viewBox="0 0 900 1125">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5B21B6"/><stop offset="100%" stop-color="#F97316"/></linearGradient></defs>
  <rect width="900" height="1125" fill="url(#bg)"/>
  <circle cx="450" cy="430" r="165" fill="rgba(255,255,255,0.16)"/>
  <text x="450" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" font-weight="800" fill="#ffffff">KaitoKid</text>
  <text x="450" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#f5f3ff">SHOP THE LOOK</text>
  <text x="450" y="790" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#ffffff">Ảnh lookbook đang cập nhật</text>
</svg>`;

@Controller()
export class MediaFallbackController {
  @Get("products/*path")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  productFallback(): string {
    return PRODUCT_SVG;
  }

  @Get("lookbook/*path")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  lookbookFallback(): string {
    return LOOKBOOK_SVG;
  }
}
