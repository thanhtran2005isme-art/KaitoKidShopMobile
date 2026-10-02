import { useCallback, useState } from 'react';
import {
  PiHeartStraight,
  PiHeartStraightFill,
  PiShoppingBagOpen,
  PiStarFill,
} from 'react-icons/pi';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/format';
import { useCart } from '../../context/CartContext';
import ProductVariantModal from './ProductVariantModal';

interface ProductCardProps {
  product: Product;
  onToggleWishlist?: (id: number) => void;
  isWishlisted?: boolean;
}

function getWishlist(): number[] {
  try {
    return JSON.parse(localStorage.getItem('wishlist') || '[]');
  } catch {
    return [];
  }
}

function toggleWishlistInStorage(id: number): boolean {
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  localStorage.setItem('wishlist', JSON.stringify(list));
  return idx < 0;
}

export default function ProductCard({
  product,
  onToggleWishlist,
  isWishlisted,
}: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(
    () => isWishlisted ?? getWishlist().includes(product.id),
  );
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { addItem } = useCart();

  const handleWishlist = useCallback(() => {
    if (onToggleWishlist) {
      onToggleWishlist(product.id);
      setWishlisted((previous) => !previous);
    } else {
      setWishlisted(toggleWishlistInStorage(product.id));
    }
  }, [onToggleWishlist, product.id]);

  const handleConfirmAddCart = async (
    size: string,
    color: string,
    quantity: number,
  ) => {
    await addItem(product, size, color, quantity);
  };

  const hasOldPrice = Boolean(product.oldPrice && product.oldPrice > product.price);
  const discount = hasOldPrice && product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const visibleColors = Array.from(
    new Set((product.colors || []).map((color) => color.trim()).filter(Boolean)),
  ).slice(0, 3);

  return (
    <article className="ivy-product-card">
      <div className="ivy-card-image">
        <Link
          to={`/product/${product.id}`}
          className="ivy-card-image-link"
          aria-label={`Xem ${product.name}`}>
          {!imageFailed && product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="ivy-card-image-fallback">Ảnh đang cập nhật</span>
          )}
        </Link>

        <div className="ivy-card-badges" aria-hidden="true">
          {product.isNew ? <span className="ivy-badge ivy-badge-new">Mới</span> : null}
          {product.isBestSeller ? (
            <span className="ivy-badge ivy-badge-hot">Bán chạy</span>
          ) : null}
          {discount > 0 ? (
            <span className="ivy-badge ivy-badge-sale">-{discount}%</span>
          ) : null}
        </div>

        <button
          className={`ivy-wishlist-btn ${wishlisted ? 'active' : ''}`}
          onClick={handleWishlist}
          type="button"
          aria-pressed={wishlisted}
          aria-label={wishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}>
          {wishlisted ? (
            <PiHeartStraightFill aria-hidden="true" />
          ) : (
            <PiHeartStraight aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="ivy-card-content">
        {visibleColors.length > 0 ? (
          <div className="ivy-color-dots" aria-label="Màu hiện có">
            {visibleColors.map((color) => (
              <span
                key={color}
                className="ivy-color-dot"
                style={{ background: mapColor(color) }}
                title={color}
                aria-label={color}
              />
            ))}
            {(product.colors?.length || 0) > visibleColors.length ? (
              <span className="ivy-more-colors">
                +{(product.colors?.length || 0) - visibleColors.length}
              </span>
            ) : null}
          </div>
        ) : null}

        <Link to={`/product/${product.id}`} className="ivy-card-name">
          {product.name}
        </Link>

        {product.rating > 0 || product.soldCount > 0 ? (
          <div className="ivy-card-meta">
            {product.rating > 0 ? (
              <span className="ivy-card-rating">
                <PiStarFill aria-hidden="true" />
                {product.rating.toFixed(1)}
              </span>
            ) : null}
            {product.soldCount > 0 ? (
              <span>{product.soldCount} đã bán</span>
            ) : null}
          </div>
        ) : null}

        <div className="ivy-card-bottom">
          <div className="ivy-card-price">
            <span className="ivy-price-current">{formatCurrency(product.price)}</span>
            {hasOldPrice ? (
              <span className="ivy-price-old">{formatCurrency(product.oldPrice || 0)}</span>
            ) : null}
          </div>
          <button
            className="ivy-cart-btn"
            onClick={() => setVariantModalOpen(true)}
            type="button"
            aria-label={`Chọn biến thể và thêm ${product.name} vào giỏ`}>
            <PiShoppingBagOpen aria-hidden="true" />
          </button>
        </div>
      </div>

      <ProductVariantModal
        product={product}
        open={variantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        onConfirm={handleConfirmAddCart}
      />
    </article>
  );
}

function mapColor(color: string): string {
  const normalized = color.trim().toLowerCase();
  const map: Record<string, string> = {
    đen: '#111827',
    trắng: '#f8fafc',
    đỏ: '#dc2626',
    xanh: '#2563eb',
    'xanh dương': '#2563eb',
    'xanh lá': '#16a34a',
    vàng: '#eab308',
    hồng: '#ec4899',
    tím: '#7c3aed',
    cam: '#f97316',
    nâu: '#78350f',
    xám: '#9ca3af',
    be: '#d6c2a1',
    kem: '#f5e6ca',
    navy: '#1e3a8a',
    'xanh navy': '#1e3a8a',
  };
  return map[normalized] || '#cbd5e1';
}
