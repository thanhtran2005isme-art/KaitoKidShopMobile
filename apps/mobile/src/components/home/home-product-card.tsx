import { ProductCard } from '@/components/product/product-card';
import type { Product } from '@/types/shop';

export function HomeProductCard({
  product,
  width,
}: {
  product: Product;
  width: number;
}) {
  return <ProductCard product={product} width={width} />;
}
