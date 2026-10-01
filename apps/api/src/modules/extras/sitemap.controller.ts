import {
  Controller,
  Get,
  Header,
  Req,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";

interface RequestLike {
  protocol?: string;
  headers: { host?: string };
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

@Controller()
export class SitemapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  async sitemap(@Req() req: RequestLike) {
    const base =
      (process.env.PUBLIC_WEB_BASE_URL?.trim() ||
        `${req.protocol ?? "http"}://${req.headers.host ?? "localhost:5300"}`)
        .replace(/\/+$/, "");
    const products = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown;
      slug: string | null;
      updatedAt: Date | string | null;
      createdAt: Date | string;
    }>>(
      `SELECT Id AS id, Slug AS slug, NgayCapNhat AS updatedAt,
              NgayTao AS createdAt
       FROM SanPham
       WHERE TrangThai='active'`,
    );
    const collections = await this.prisma.$queryRawUnsafe<Array<{
      slug: string | null;
      name: string;
    }>>(
      `SELECT Slug AS slug, TenBoSuuTap AS name
       FROM BoSuuTap
       WHERE TrangThai=1`,
    );
    const staticUrls = [
      ["/", "1.0", "daily"],
      ["/products", "0.9", "daily"],
      ["/women", "0.9", "daily"],
      ["/men", "0.9", "daily"],
      ["/kids", "0.9", "daily"],
      ["/new-in", "0.8", "daily"],
      ["/sale", "0.8", "daily"],
      ["/bestseller", "0.8", "daily"],
      ["/collections", "0.7", "weekly"],
      ["/lookbook", "0.7", "weekly"],
    ];
    const rows: string[] = [];
    for (const [path, priority, freq] of staticUrls) {
      rows.push(
        `<url><loc>${xml(base + path)}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`,
      );
    }
    for (const p of products) {
      const loc = p.slug
        ? `${base}/p/${encodeURIComponent(p.slug)}`
        : `${base}/product/${Number(p.id)}`;
      const last = new Date(p.updatedAt ?? p.createdAt)
        .toISOString()
        .slice(0, 10);
      rows.push(
        `<url><loc>${xml(loc)}</loc><lastmod>${last}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
      );
    }
    for (const c of collections) {
      const slug = c.slug || c.name;
      rows.push(
        `<url><loc>${xml(`${base}/products?collection=${encodeURIComponent(slug)}`)}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
      );
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>`;
  }

  @Get("robots.txt")
  @Header("Content-Type", "text/plain; charset=utf-8")
  robots(@Req() req: RequestLike) {
    const base =
      (process.env.PUBLIC_WEB_BASE_URL?.trim() ||
        `${req.protocol ?? "http"}://${req.headers.host ?? "localhost:5300"}`)
        .replace(/\/+$/, "");
    return `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /account
Disallow: /address
Disallow: /cart
Disallow: /checkout
Disallow: /wishlist
Disallow: /orders

Sitemap: ${base}/sitemap.xml
`;
  }
}
