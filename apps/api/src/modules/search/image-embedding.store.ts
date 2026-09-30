export class ImageEmbeddingStore {
  private readonly vectors = new Map<number, Float32Array>();

  get count() {
    return this.vectors.size;
  }

  upsert(productId: number, vector: ArrayLike<number>) {
    this.vectors.set(productId, Float32Array.from(vector));
  }

  remove(productId: number) {
    this.vectors.delete(productId);
  }

  contains(productId: number) {
    return this.vectors.has(productId);
  }

  replaceAll(entries: Array<[number, ArrayLike<number>]>) {
    this.vectors.clear();
    for (const [id, vector] of entries) this.upsert(id, vector);
  }

  search(
    query: ArrayLike<number>,
    topK: number,
    minSimilarity: number,
  ) {
    const scored: Array<{ productId: number; score: number }> = [];
    for (const [productId, vector] of this.vectors) {
      if (vector.length !== query.length) continue;
      let dot = 0;
      for (let i = 0; i < vector.length; i += 1) {
        dot += vector[i] * Number(query[i]);
      }
      if (dot >= minSimilarity) scored.push({ productId, score: dot });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, topK));
  }
}
