import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

@Injectable()
export class ImageEmbedderService implements OnModuleInit {
  private readonly logger=new Logger(ImageEmbedderService.name);
  private session:ort.InferenceSession|null=null;
  private inputName=""; private outputName="";
  readonly modelName=process.env.IMAGE_SEARCH_MODEL_NAME??"fashion-clip";
  readonly size=Math.max(32,Number(process.env.IMAGE_SEARCH_INPUT_SIZE??224));

  async onModuleInit(){
    if(!/^(1|true|yes)$/i.test(process.env.IMAGE_SEARCH_ENABLED??"true"))return;
    const path=resolve(process.env.IMAGE_SEARCH_MODEL_PATH??"Models/clip-image-encoder.onnx");
    if(!existsSync(path)){this.logger.warn(`ImageSearch model chưa có: ${path}`);return;}
    try{this.session=await ort.InferenceSession.create(path,{graphOptimizationLevel:"all"});this.inputName=this.session.inputNames[0]??"";this.outputName=this.session.outputNames.find(n=>/image_embeds|embedding|pooler_output/i.test(n))??this.session.outputNames[0]??"";}
    catch(e){this.logger.error("Không nạp được ONNX image model",e instanceof Error?e.stack:String(e));this.session=null;}
  }
  get ready(){return !!this.session&&!!this.inputName&&!!this.outputName;}

  async embed(bytes:Buffer):Promise<Float32Array|null>{
    if(!this.ready||!this.session||bytes.length===0)return null;
    try{
      const {data,info}=await sharp(bytes).resize(this.size,this.size,{fit:"cover",position:"centre"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
      if(info.channels<3)return null;
      const out=new Float32Array(3*this.size*this.size);
      const mean=[0.48145466,0.4578275,0.40821073],std=[0.26862954,0.26130258,0.27577711];
      for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){const base=(y*this.size+x)*info.channels;for(let c=0;c<3;c++)out[c*this.size*this.size+y*this.size+x]=(data[base+c]/255-mean[c])/std[c];}
      const input=new ort.Tensor("float32",out,[1,3,this.size,this.size]);
      const result=await this.session.run({[this.inputName]:input});
      const tensor=result[this.outputName]; if(!tensor)return null;
      const vec=Float32Array.from(tensor.data as Float32Array); let ss=0;for(const v of vec)ss+=v*v;const norm=Math.sqrt(ss);if(norm>1e-8)for(let i=0;i<vec.length;i++)vec[i]/=norm;
      return vec;
    }catch(e){this.logger.warn(`Image embedding lỗi: ${e instanceof Error?e.message:String(e)}`);return null;}
  }
}
