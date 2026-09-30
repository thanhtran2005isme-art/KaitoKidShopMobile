import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import { ImageEmbedderService } from "./image-embedder.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";

const SELECT=`SELECT Id AS id, TenSanPham AS name, DanhMuc AS category, DanhMucPhu AS subcategory, GioiTinh AS gender,
Gia AS price, GiaCu AS oldPrice, TonKho AS stock, COALESCE(SoLuongDaGiu,0) AS reserved, TrangThai AS status,
HinhAnh AS image, MoTaNgan AS shortDescription, MaSanPham AS sku, Slug AS slug, LaSanPhamMoi AS isNew,
DangGiamGia AS isSale, BanChayNhat AS isBestSeller, DiemDanhGia AS rating, SoLuongDaBan AS soldCount,
DanhSachMau AS colors, DanhSachSize AS sizes FROM SanPham`;

@Injectable()
export class ImageSearchService {
  constructor(private readonly prisma:PrismaService,private readonly embedder:ImageEmbedderService,private readonly store:ImageEmbeddingStore){}
  get ready(){return this.embedder.ready&&this.store.count>0;}
  async search(bytes:Buffer,limit:number){
    if(!this.embedder.ready)return {items:[],total:0,ready:false,message:"Tìm kiếm bằng hình ảnh chưa sẵn sàng (chưa cấu hình mô hình nhận diện). Vui lòng thử lại sau."};
    if(this.store.count===0)return {items:[],total:0,ready:false,message:"Hệ thống đang lập chỉ mục hình ảnh sản phẩm. Vui lòng thử lại sau ít phút."};
    const query=await this.embedder.embed(bytes);if(!query)return {items:[],total:0,ready:true,message:"Không đọc được ảnh. Hãy thử ảnh khác (JPG/PNG/WebP)."};
    const configuredMaxRaw = Number(process.env.IMAGE_SEARCH_MAX_RESULTS ?? 48);
    const configuredMax = Number.isFinite(configuredMaxRaw)
      ? Math.max(1, Math.trunc(configuredMaxRaw))
      : 48;
    const requested = limit <= 0 ? configuredMax : limit;
    const max = Math.max(1, Math.min(configuredMax, Math.trunc(requested)));
    const thresholdRaw = Number(process.env.IMAGE_SEARCH_MIN_SIMILARITY ?? 0.6);
    const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.6;
    const hits=this.store.search(query,max,threshold);if(!hits.length)return {items:[],total:0,ready:true};
    const ids=hits.map(h=>h.productId), marks=ids.map(()=>"?").join(",");
    const rows=await this.prisma.$queryRawUnsafe<ProductRow[]>(`${SELECT} WHERE TrangThai='active' AND Id IN (${marks})`,...ids);
    const by=new Map(rows.map(r=>[Number(r.id),r]));
    const items=hits.flatMap(h=>{const p=by.get(h.productId);return p?[{product:mapProduct(p),similarity:Math.round(h.score*10000)/10000}]:[];});
    return {items,total:items.length,ready:true};
  }
}
