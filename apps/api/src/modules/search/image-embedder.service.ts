import { Injectable, Logger } from "@nestjs/common";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

@Injectable()
export class ImageEmbedder {
  private readonly logger = new Logger(ImageEmbedder.name);
  private session: any | null = null;
  private inputName: string | null = null;
  private outputName: string | null = null;
  private loading: Promise<void> | null = null;

  get modelName() {
    return (
      process.env.IMAGE_SEARCH_MODEL_NAME ??
      "fashion-clip"
    );
  }

  get ready() {
    return Boolean(this.session && this.inputName && this.outputName);
  }

  async init() {
    if (this.loading) return this.loading;
    this.loading = this.load();
    return this.loading;
  }

  async embed(bytes: Buffer): Promise<Float32Array | null> {
    await this.init();
    if (!this.ready || bytes.length === 0) return null;

    try {
      const [{ default: sharp }, ort] = await Promise.all([
        import("sharp"),
        import("onnxruntime-node"),
      ]);
      const size = Math.max(
        32,
        Number(process.env.IMAGE_SEARCH_INPUT_SIZE ?? 224) || 224,
      );
      const { data } = await sharp(bytes)
        .resize(size, size, { fit: "cover", position: "centre" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const mean = [0.48145466, 0.4578275, 0.40821073];
      const std = [0.26862954, 0.26130258, 0.27577711];
      const tensorData = new Float32Array(3 * size * size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const pixel = (y * size + x) * 3;
          for (let c = 0; c < 3; c += 1) {
            tensorData[c * size * size + y * size + x] =
              (data[pixel + c] / 255 - mean[c]) / std[c];
          }
        }
      }

      const tensor = new ort.Tensor(
        "float32",
        tensorData,
        [1, 3, size, size],
      );
      const result = await this.session.run({
        [this.inputName!]: tensor,
      });
      const output = result[this.outputName!];
      if (!output?.data) return null;
      const vector = Float32Array.from(output.data as unknown as ArrayLike<number>);
      this.normalize(vector);
      return vector;
    } catch (error) {
      this.logger.warn(
        `Image embedding failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async load() {
    if (
      !/^(1|true|yes)$/i.test(
        process.env.IMAGE_SEARCH_ENABLED ?? "true",
      )
    ) {
      return;
    }
    const configured = process.env.IMAGE_SEARCH_MODEL_PATH?.trim();
    const candidates = [
      ...(configured ? [resolve(configured)] : []),
      resolve(process.cwd(), "../../backend/API.Customer/Models/clip-image-encoder.onnx"),
      resolve(process.cwd(), "backend/API.Customer/Models/clip-image-encoder.onnx"),
      resolve(process.cwd(), "Models/clip-image-encoder.onnx"),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) {
      this.logger.warn(
        `Image search model not found; tried: ${candidates.join(", ")}. Feature soft-disabled.`,
      );
      return;
    }

    try {
      const ort = await import("onnxruntime-node");
      const session = await ort.InferenceSession.create(path, {
        graphOptimizationLevel: "all",
      });
      const inputs = session.inputNames;
      const outputs = session.outputNames;
      this.session = session;
      this.inputName = inputs[0] ?? null;
      const preferred = [
        "image_embeds",
        "image_embedding",
        "embeds",
        "embedding",
        "pooler_output",
        "sentence_embedding",
      ];
      this.outputName =
        preferred.find((name) => outputs.includes(name)) ??
        outputs[0] ??
        null;
      this.logger.log(
        `Loaded image model ${this.modelName} input=${this.inputName} output=${this.outputName}`,
      );
    } catch (error) {
      this.logger.error(
        "Could not load ONNX image model",
        error instanceof Error ? error.stack : String(error),
      );
      this.session = null;
      this.inputName = null;
      this.outputName = null;
    }
  }

  private normalize(vector: Float32Array) {
    let sum = 0;
    for (const value of vector) sum += value * value;
    const norm = Math.sqrt(sum);
    if (norm <= 1e-8) return;
    for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  }
}
