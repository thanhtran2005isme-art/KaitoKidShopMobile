import { Injectable } from "@nestjs/common";
@Injectable()
export class ImageEmbeddingStore {
  private readonly vectors=new Map<number,Float32Array>();
  get count(){return this.vectors.size;}
  replaceAll(items:Array<[number,Float32Array]>){this.vectors.clear();for(const [id,v] of items)this.vectors.set(id,v);}
  upsert(id:number,v:Float32Array){this.vectors.set(id,v);}
  remove(id:number){this.vectors.delete(id);}
  has(id:number){return this.vectors.has(id);}
  search(query:Float32Array,topK:number,min:number){
    const hits:Array<{productId:number;score:number}>=[];
    for(const [id,v] of this.vectors){if(v.length!==query.length)continue;let dot=0;for(let i=0;i<v.length;i++)dot+=v[i]*query[i];if(dot>=min)hits.push({productId:id,score:dot});}
    return hits.sort((a,b)=>b.score-a.score).slice(0,topK);
  }
}
