import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaService } from "../../database/prisma.service.js";
import { ImageEmbedderService } from "./image-embedder.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";

interface EmbeddingRow { productId: unknown; vector: string; sourceHash: string; }
interface ProductImageRow { id: unknown; image: string | null; }

@Injectable()
export class ImageEmbeddingIndexerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger=new Logger(ImageEmbeddingIndexerService.name);
  private timer:NodeJS.Timeout|null=null;
  private running=false;
  constructor(private readonly prisma:PrismaService,private readonly embedder:ImageEmbedderService,private readonly store:ImageEmbeddingStore){}

  async onApplicationBootstrap(){
    if(!/^(1|true|yes)$/i.test(process.env.IMAGE_SEARCH_ENABLED??"true"))return;
    await this.loadExisting();
    if(!/^(1|true|yes)$/i.test(process.env.IMAGE_SEARCH_INDEXER_ENABLED??"false")){
      this.logger.log("Image indexer disabled trong coexistence; chỉ đọc embedding hiện có.");
      return;
    }
    const seconds=Math.max(60,Number(process.env.IMAGE_SEARCH_REINDEX_INTERVAL_SECONDS??600));
    setTimeout(()=>void this.reindex(),5000);
    this.timer=setInterval(()=>void this.reindex(),seconds*1000);
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}

  private async loadExisting(){
    try{
      const rows=await this.prisma.$queryRawUnsafe<EmbeddingRow[]>(
        "SELECT SanPhamId AS productId, Vector AS vector, NguonHash AS sourceHash FROM SanPhamEmbedding WHERE Model = ?",
        this.embedder.modelName,
      );
      const loaded:Array<[number,Float32Array]>=[];
      for(const r of rows){try{const a=JSON.parse(r.vector);if(Array.isArray(a)&&a.length)loaded.push([Number(r.productId),Float32Array.from(a.map(Number))]);}catch{}}
      this.store.replaceAll(loaded);this.logger.log(`Loaded ${loaded.length} image embeddings.`);
    }catch(e){this.logger.warn(`Không nạp được SanPhamEmbedding: ${e instanceof Error?e.message:String(e)}`);}
  }

  private async reindex(){
    if(this.running||!this.embedder.ready)return;this.running=true;
    try{
      const products=await this.prisma.$queryRawUnsafe<ProductImageRow[]>("SELECT Id AS id, HinhAnh AS image FROM SanPham WHERE TrangThai='active' ORDER BY Id");
      const existing=await this.prisma.$queryRawUnsafe<Array<EmbeddingRow&{id:unknown;model:string}>>(
        "SELECT Id AS id, SanPhamId AS productId, Vector AS vector, NguonHash AS sourceHash, Model AS model FROM SanPhamEmbedding WHERE Model = ?",
        this.embedder.modelName,
      );
      const by=new Map(existing.map(r=>[Number(r.productId),r]));const active=new Set(products.map(p=>Number(p.id)));let changed=0;
      for(const p of products){
        const id=Number(p.id),hash=createHash("sha256").update(p.image??"").digest("hex").toUpperCase(),cur=by.get(id);
        if(cur?.sourceHash===hash){if(!this.store.has(id)){try{this.store.upsert(id,Float32Array.from(JSON.parse(cur.vector).map(Number)));}catch{}}continue;}
        const bytes=await this.fetchImage(p.image);if(!bytes)continue;const vec=await this.embedder.embed(bytes);if(!vec)continue;
        const json=JSON.stringify(Array.from(vec)),now=new Date();
        const affected=await this.prisma.$executeRawUnsafe(
          "UPDATE SanPhamEmbedding SET SoChieu=?, Vector=?, Model=?, NguonHash=?, NgayCapNhat=? WHERE SanPhamId=?",
          vec.length,json,this.embedder.modelName,hash,now,id,
        );
        if(!affected)await this.prisma.$executeRawUnsafe(
          "INSERT INTO SanPhamEmbedding (SanPhamId,SoChieu,Vector,Model,NguonHash,NgayCapNhat) VALUES (?,?,?,?,?,?)",
          id,vec.length,json,this.embedder.modelName,hash,now,
        );
        this.store.upsert(id,vec);changed++;
      }
      for(const r of existing){const id=Number(r.productId);if(!active.has(id)){this.store.remove(id);await this.prisma.$executeRawUnsafe("DELETE FROM SanPhamEmbedding WHERE SanPhamId=?",id);}}
      if(changed)this.logger.log(`Image indexer updated ${changed} products; total=${this.store.count}.`);
    }catch(e){this.logger.error("Image indexer tick failed",e instanceof Error?e.stack:String(e));}
    finally{this.running=false;}
  }

  private async fetchImage(image:string|null):Promise<Buffer|null>{
    if(!image?.trim())return null;const value=image.trim();
    try{
      if(/^https?:\/\//i.test(value)){const res=await fetch(value,{signal:AbortSignal.timeout(20000)});return res.ok?Buffer.from(await res.arrayBuffer()):null;}
      const publicRoot=resolve(process.env.PUBLIC_ROOT??"public"),local=resolve(publicRoot,value.replace(/^\/+/, ""));
      if(local.startsWith(publicRoot))try{return await readFile(local);}catch{}
      const base=process.env.IMAGE_SEARCH_PUBLIC_ASSET_BASE_URL?.replace(/\/+$/,"");
      if(base){const res=await fetch(`${base}/${value.replace(/^\/+/, "")}`,{signal:AbortSignal.timeout(20000)});return res.ok?Buffer.from(await res.arrayBuffer()):null;}
    }catch{}
    return null;
  }
}
