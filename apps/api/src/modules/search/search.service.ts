import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import { buildFacets, levenshtein, parseCsv, type SearchRequest } from "./search.helpers.js";

const SELECT=`SELECT Id AS id, TenSanPham AS name, DanhMuc AS category, DanhMucPhu AS subcategory,
GioiTinh AS gender, Gia AS price, GiaCu AS oldPrice, TonKho AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
TrangThai AS status, HinhAnh AS image, MoTaNgan AS shortDescription, MaSanPham AS sku, Slug AS slug,
LaSanPhamMoi AS isNew, DangGiamGia AS isSale, BanChayNhat AS isBestSeller, DiemDanhGia AS rating,
SoLuongDaBan AS soldCount, DanhSachMau AS colors, DanhSachSize AS sizes, NgayTao AS createdAt FROM SanPham`;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: Record<string, unknown>) {
    const req: SearchRequest={
      query:typeof q.query==="string"?q.query.trim():undefined,
      category:typeof q.category==="string"?q.category.trim():undefined,
      minPrice:this.num(q.minPrice),maxPrice:this.num(q.maxPrice),
      sizes:parseCsv(q.sizes),colors:parseCsv(q.colors),minRating:this.num(q.minRating),
      sortBy:typeof q.sortBy==="string"?q.sortBy:undefined,
      page:Math.max(1,Math.trunc(this.num(q.page)??1)),
      pageSize:Math.min(100,Math.max(1,Math.trunc(this.num(q.pageSize)??24))),
    };
    const where=["TrangThai='active'"], params:unknown[]=[];
    if(req.query){ for(const token of [...new Set(req.query.split(/\s+/).filter(Boolean))]) { where.push("(TenSanPham LIKE ? OR MoTaChiTiet LIKE ? OR MaSanPham LIKE ?)"); params.push(`%${token}%`,`%${token}%`,`%${token}%`); } }
    const sample=await this.prisma.$queryRawUnsafe<ProductRow[]>(`${SELECT} WHERE ${where.join(" AND ")} LIMIT 500`,...params);
    const filtered=sample.filter(p=>{
      const price=Number(p.price),rating=Number(p.rating);
      const sizes=this.arr(p.sizes), colors=this.arr(p.colors);
      return (!req.category||p.category===req.category)
        &&(req.minPrice==null||price>=req.minPrice)&&(req.maxPrice==null||price<=req.maxPrice)
        &&(req.minRating==null||rating>=req.minRating)
        &&(!req.sizes?.length||sizes.some(x=>req.sizes!.includes(x)))
        &&(!req.colors?.length||colors.some(x=>req.colors!.includes(x)));
    });
    const sorted=[...filtered].sort((a,b)=>{
      switch(req.sortBy){
        case "price-asc": return Number(a.price)-Number(b.price);
        case "price-desc": return Number(b.price)-Number(a.price);
        case "bestseller": return Number(b.soldCount)-Number(a.soldCount);
        case "rating": return Number(b.rating)-Number(a.rating);
        default:
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      }
    });
    const start=(req.page-1)*req.pageSize;
    let didYouMean:string|null=null;
    if(sorted.length===0&&req.query&&req.query.length>=3) didYouMean=await this.didYouMean(req.query);
    return {items:sorted.slice(start,start+req.pageSize).map(mapProduct),total:sorted.length,page:req.page,pageSize:req.pageSize,facets:buildFacets(sample,req),didYouMean};
  }

  async suggestions(query:string,limit:number){
    const q=query.trim(); if(q.length<2)return {suggestions:[],products:[]};
    const tokens=[...new Set(q.split(/\s+/).filter(Boolean))], where=["TrangThai='active'"], params:unknown[]=[];
    for(const token of tokens){where.push("(TenSanPham LIKE ? OR MaSanPham LIKE ?)");params.push(`%${token}%`,`%${token}%`);}
    const rows=await this.prisma.$queryRawUnsafe<ProductRow[]>(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY SoLuongDaBan DESC LIMIT ${Math.max(1,Math.min(20,limit))}`,...params);
    return {suggestions:[...new Set(rows.map(r=>r.name))],products:rows.map(mapProduct)};
  }

  private async didYouMean(query:string){
    const rows=await this.prisma.$queryRawUnsafe<Array<{name:string}>>("SELECT TenSanPham AS name FROM SanPham WHERE TrangThai='active' ORDER BY SoLuongDaBan DESC LIMIT 500");
    const q=query.toLowerCase(), threshold=Math.max(1,Math.floor(q.length/3)); let best:string|null=null,bestD=Infinity;
    for(const row of rows) for(const token of row.name.toLowerCase().split(/\s+/)) {
      if(token.length<2||token===q||Math.abs(token.length-q.length)>threshold+1)continue;
      const d=levenshtein(q,token); if(d<bestD&&d<=threshold){bestD=d;best=token;}
    }
    return best;
  }
  private num(v:unknown){
    if(v===undefined||v===null||v==="")return undefined;
    const n=Number(v);return Number.isFinite(n)?n:undefined;
  }
  private arr(raw:string|null|undefined){try{const x=JSON.parse(raw??"[]");return Array.isArray(x)?x.filter(v=>typeof v==="string"):[];}catch{return [];}}
}
