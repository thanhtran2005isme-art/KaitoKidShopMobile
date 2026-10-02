import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PiCaretDownBold,
  PiFunnelBold,
  PiGridFour,
  PiList,
  PiSortAscendingBold,
  PiSquaresFour,
  PiX,
} from 'react-icons/pi';
import { productApi, type GetProductsParams } from '../services/api';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import ProductCard from './product/ProductCard';
import '../styles/catalog-page.css';

export interface ProductListPageProps {
  title: string;
  subtitle?: string;
  bannerImage?: string;
  fixedFilters?: Partial<GetProductsParams>;
  showCategoryFilter?: boolean;
}

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';
type ViewMode = 'grid-4' | 'grid-3' | 'list';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'bestseller', label: 'Bán chạy' },
  { key: 'price-asc', label: 'Giá tăng dần' },
  { key: 'price-desc', label: 'Giá giảm dần' },
  { key: 'rating', label: 'Đánh giá cao' },
];

const PRICE_BUCKETS = [
  { label: 'Dưới 200k', min: 0, max: 200_000 },
  { label: '200k – 500k', min: 200_000, max: 500_000 },
  { label: '500k – 1tr', min: 500_000, max: 1_000_000 },
  { label: '1tr – 2tr', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2tr', min: 2_000_000, max: 999_999_999 },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export default function ProductListPage({
  title,
  subtitle,
  bannerImage,
  fixedFilters,
  showCategoryFilter = true,
}: ProductListPageProps) {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page')) || 1));
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    const fromQuery = Number(params.get('pageSize'));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(fromQuery)
      ? (fromQuery as PageSize)
      : 24;
  });
  const [sort, setSort] = useState<SortKey>(() => {
    const fromQuery = params.get('sort') as SortKey | null;
    return SORT_OPTIONS.some((item) => item.key === fromQuery) ? fromQuery! : 'newest';
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const fromQuery = params.get('view') as ViewMode | null;
    return fromQuery === 'grid-3' || fromQuery === 'list' ? fromQuery : 'grid-4';
  });

  const [activeCategory, setActiveCategory] = useState(() => params.get('category') || '');
  const [activePriceIdx, setActivePriceIdx] = useState<number | null>(null);
  const [activeSizes, setActiveSizes] = useState<Set<string>>(new Set());
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    void productApi.getAll({ pageSize: 200, ...fixedFilters }).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      const source = result.data.products;
      setCategories(
        Array.from(new Set(source.map((product) => product.category).filter(Boolean))).slice(0, 20),
      );
      setAvailableSizes(
        Array.from(
          new Set(source.flatMap((product) => product.sizes || []).map((size) => size.trim()).filter(Boolean)),
        ),
      );
      setAvailableColors(
        Array.from(
          new Set(source.flatMap((product) => product.colors || []).map((color) => color.trim()).filter(Boolean)),
        ),
      );
    });

    return () => {
      cancelled = true;
    };
    // fixedFilters represents route-level constraints and is intentionally loaded as one facet source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const priceRange = activePriceIdx !== null ? PRICE_BUCKETS[activePriceIdx] : null;
    const apiParams: GetProductsParams = {
      ...fixedFilters,
      category: activeCategory || fixedFilters?.category,
      gender: fixedFilters?.gender || params.get('gender') || undefined,
      subcategory: fixedFilters?.subcategory || params.get('subcategory') || undefined,
      style: fixedFilters?.style || params.get('style') || undefined,
      ageGroup: fixedFilters?.ageGroup || params.get('ageGroup') || undefined,
      collection: fixedFilters?.collection || params.get('collection') || undefined,
      search: fixedFilters?.search || params.get('search') || undefined,
      sortBy: sort,
      page,
      pageSize,
    };

    if (priceRange) {
      apiParams.minPrice = priceRange.min;
      apiParams.maxPrice = priceRange.max;
    }
    if (minRating > 0) apiParams.minRating = minRating;
    if (activeSizes.size > 0) apiParams.sizes = Array.from(activeSizes).join(',');
    if (activeColors.size > 0) apiParams.colors = Array.from(activeColors).join(',');

    void productApi
      .getAll(apiParams)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setProducts(result.data.products);
          setTotal(result.data.total);
          return;
        }
        setProducts([]);
        setTotal(0);
        setLoadError(result.error || 'Không thể tải sản phẩm.');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProducts([]);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : 'Không thể tải sản phẩm.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // URL params are included so deep-link filters stay authoritative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activePriceIdx, activeSizes, activeColors, minRating, sort, page, pageSize, params]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set('sort', sort);
    next.set('view', viewMode);
    next.set('pageSize', String(pageSize));
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    if (activeCategory) next.set('category', activeCategory);
    else next.delete('category');

    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
  }, [activeCategory, page, pageSize, params, setParams, sort, viewMode]);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFilterOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileFilterOpen]);

  const toggleSet = (
    source: Set<string>,
    value: string,
    setter: (next: Set<string>) => void,
  ) => {
    const next = new Set(source);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
    setPage(1);
  };

  const resetFilters = useCallback(() => {
    setActiveCategory('');
    setActivePriceIdx(null);
    setActiveSizes(new Set());
    setActiveColors(new Set());
    setMinRating(0);
    setPage(1);
  }, []);

  const filterCount =
    (activeCategory ? 1 : 0) +
    (activePriceIdx !== null ? 1 : 0) +
    activeSizes.size +
    activeColors.size +
    (minRating > 0 ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagination = useMemo(() => {
    const visible = Math.min(5, totalPages);
    const start = Math.max(1, Math.min(page - 2, totalPages - visible + 1));
    return Array.from({ length: visible }, (_, index) => start + index);
  }, [page, totalPages]);

  const gridClass =
    viewMode === 'grid-4'
      ? 'catalog-grid catalog-grid--4'
      : viewMode === 'grid-3'
        ? 'catalog-grid catalog-grid--3'
        : 'catalog-grid catalog-grid--list';

  return (
    <div className="catalog-page">
      {bannerImage ? (
        <section className="catalog-banner" aria-labelledby="catalog-title">
          <img src={bannerImage} alt="" aria-hidden="true" />
          <div className="catalog-banner-copy">
            <p className="catalog-kicker">KaitoKid Fashion</p>
            <h1 className="catalog-title" id="catalog-title">{title}</h1>
            {subtitle ? <p className="catalog-subtitle">{subtitle}</p> : null}
          </div>
        </section>
      ) : (
        <header className="catalog-heading">
          <div className="catalog-heading-copy">
            <p className="catalog-kicker">KaitoKid Fashion</p>
            <h1 className="catalog-title">{title}</h1>
            {subtitle ? <p className="catalog-subtitle">{subtitle}</p> : null}
          </div>
        </header>
      )}

      <section className="catalog-toolbar" aria-label="Điều khiển danh sách sản phẩm">
        <div>
          <p className="catalog-result-count" aria-live="polite">
            {loading ? 'Đang tải sản phẩm…' : <>Tìm thấy <strong>{total}</strong> sản phẩm</>}
          </p>
        </div>

        <div className="catalog-toolbar-actions">
          <button
            className="catalog-filter-mobile"
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            aria-expanded={mobileFilterOpen}
            aria-controls="catalog-filter-panel">
            <PiFunnelBold aria-hidden="true" />
            Bộ lọc {filterCount > 0 ? `(${filterCount})` : ''}
          </button>

          <div className="catalog-view-toggle" role="group" aria-label="Kiểu hiển thị">
            {([
              ['grid-4', PiSquaresFour, '4 cột'],
              ['grid-3', PiGridFour, '3 cột'],
              ['list', PiList, 'Dạng danh sách'],
            ] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                className={`catalog-icon-button ${viewMode === mode ? 'is-active' : ''}`}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}>
                <Icon aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="catalog-sort-group">
            <PiSortAscendingBold aria-hidden="true" />
            <span className="catalog-sort-label">Sắp xếp</span>
            <select
              className="catalog-control"
              value={sort}
              aria-label="Sắp xếp sản phẩm"
              onChange={(event) => {
                setSort(event.target.value as SortKey);
                setPage(1);
              }}>
              {SORT_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
            <select
              className="catalog-control"
              value={pageSize}
              aria-label="Số sản phẩm mỗi trang"
              onChange={(event) => {
                setPageSize(Number(event.target.value) as PageSize);
                setPage(1);
              }}>
              {PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value} / trang</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {mobileFilterOpen ? (
        <button
          className="catalog-drawer-backdrop"
          type="button"
          aria-label="Đóng bộ lọc"
          onClick={() => setMobileFilterOpen(false)}
        />
      ) : null}

      <div className="catalog-layout">
        <aside
          className={`catalog-sidebar ${mobileFilterOpen ? 'is-open' : ''}`}
          id="catalog-filter-panel"
          aria-label="Bộ lọc sản phẩm">
          <div className="catalog-sidebar-panel">
            <div className="catalog-sidebar-header">
              <h2 className="catalog-sidebar-title">
                <PiFunnelBold aria-hidden="true" />
                Bộ lọc
                {filterCount > 0 ? <span className="catalog-filter-count">{filterCount}</span> : null}
              </h2>
              {filterCount > 0 ? (
                <button className="catalog-reset" type="button" onClick={resetFilters}>
                  Xóa lọc
                </button>
              ) : null}
              <button
                className="catalog-icon-button catalog-mobile-close"
                type="button"
                aria-label="Đóng bộ lọc"
                onClick={() => setMobileFilterOpen(false)}>
                <PiX aria-hidden="true" />
              </button>
            </div>

            {showCategoryFilter && categories.length > 0 ? (
              <FilterGroup title="Danh mục">
                <div className="catalog-radio-list">
                  <Radio
                    checked={!activeCategory}
                    onChange={() => {
                      setActiveCategory('');
                      setPage(1);
                    }}>
                    Tất cả
                  </Radio>
                  {categories.map((category) => (
                    <Radio
                      key={category}
                      checked={activeCategory === category}
                      onChange={() => {
                        setActiveCategory(category);
                        setPage(1);
                      }}>
                      {category}
                    </Radio>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            <FilterGroup title="Khoảng giá">
              <div className="catalog-radio-list">
                <Radio
                  checked={activePriceIdx === null}
                  onChange={() => {
                    setActivePriceIdx(null);
                    setPage(1);
                  }}>
                  Tất cả
                </Radio>
                {PRICE_BUCKETS.map((bucket, index) => (
                  <Radio
                    key={bucket.label}
                    checked={activePriceIdx === index}
                    onChange={() => {
                      setActivePriceIdx(index);
                      setPage(1);
                    }}>
                    {bucket.label}
                  </Radio>
                ))}
              </div>
            </FilterGroup>

            {availableSizes.length > 0 ? (
              <FilterGroup title="Kích cỡ">
                <div className="catalog-chip-list">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      className={`catalog-chip ${activeSizes.has(size) ? 'is-active' : ''}`}
                      type="button"
                      aria-pressed={activeSizes.has(size)}
                      onClick={() => toggleSet(activeSizes, size, setActiveSizes)}>
                      {size}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            {availableColors.length > 0 ? (
              <FilterGroup title="Màu sắc">
                <div className="catalog-chip-list">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      className={`catalog-chip ${activeColors.has(color) ? 'is-active' : ''}`}
                      type="button"
                      aria-pressed={activeColors.has(color)}
                      onClick={() => toggleSet(activeColors, color, setActiveColors)}>
                      {color}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            <FilterGroup title="Đánh giá tối thiểu">
              <div className="catalog-radio-list">
                {[5, 4, 3, 0].map((rating) => (
                  <Radio
                    key={rating}
                    checked={minRating === rating}
                    onChange={() => {
                      setMinRating(rating);
                      setPage(1);
                    }}>
                    {rating === 0 ? (
                      'Tất cả'
                    ) : (
                      <>
                        <span className="catalog-rating">{'★'.repeat(rating)}</span>{' '}
                        {rating} sao trở lên
                      </>
                    )}
                  </Radio>
                ))}
              </div>
            </FilterGroup>
          </div>
        </aside>

        <main className="catalog-main">
          {loading ? (
            <div className={gridClass} aria-label="Đang tải sản phẩm">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="catalog-skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : loadError ? (
            <div className="catalog-state" role="alert">
              <span className="catalog-state-icon"><PiX aria-hidden="true" /></span>
              <h2>Chưa tải được sản phẩm</h2>
              <p>{loadError}</p>
              <button
                className="catalog-primary-action"
                type="button"
                onClick={() => setPage((current) => current)}>
                Tải lại trang
              </button>
            </div>
          ) : products.length > 0 ? (
            <div className={gridClass}>
              {viewMode === 'list'
                ? products.map((product) => <ListItem key={product.id} product={product} />)
                : products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="catalog-state">
              <span className="catalog-state-icon"><PiFunnelBold aria-hidden="true" /></span>
              <h2>Không có sản phẩm phù hợp</h2>
              <p>Thử bỏ một vài bộ lọc để xem nhiều sản phẩm hơn.</p>
              {filterCount > 0 ? (
                <button className="catalog-primary-action" type="button" onClick={resetFilters}>
                  Xóa toàn bộ bộ lọc
                </button>
              ) : null}
            </div>
          )}

          {totalPages > 1 && !loading && !loadError ? (
            <nav className="catalog-pagination" aria-label="Phân trang sản phẩm">
              <button
                className="catalog-page-button"
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label="Trang trước">
                ‹
              </button>
              {pagination.map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={`catalog-page-button ${pageNumber === page ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === page ? 'page' : undefined}>
                  {pageNumber}
                </button>
              ))}
              <button
                className="catalog-page-button"
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                aria-label="Trang sau">
                ›
              </button>
            </nav>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="catalog-filter-group">
      <button
        className="catalog-filter-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}>
        {title}
        <PiCaretDownBold aria-hidden="true" />
      </button>
      {open ? <div className="catalog-filter-content">{children}</div> : null}
    </section>
  );
}

function Radio({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="catalog-radio">
      <input type="radio" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

function ListItem({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.id}`} className="catalog-list-item">
      <div className="catalog-list-media">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        ) : null}
      </div>
      <div className="catalog-list-copy">
        <h3>{product.name}</h3>
        <div className="catalog-list-meta">
          {[product.category, product.gender, product.sku ? `SKU ${product.sku}` : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div className="catalog-list-price">
          <strong>{formatCurrency(product.price)}</strong>
          {product.oldPrice && product.oldPrice > product.price ? (
            <span className="catalog-list-old-price">{formatCurrency(product.oldPrice)}</span>
          ) : null}
        </div>
        {product.shortDescription ? (
          <p className="catalog-list-description">
            {product.shortDescription.length > 120
              ? `${product.shortDescription.slice(0, 120)}…`
              : product.shortDescription}
          </p>
        ) : null}
        <div className="catalog-list-badges" aria-hidden="true">
          {product.isNew ? <span className="catalog-list-badge catalog-list-badge--new">Mới</span> : null}
          {product.isSale ? <span className="catalog-list-badge catalog-list-badge--sale">Sale</span> : null}
          {product.isBestSeller ? <span className="catalog-list-badge catalog-list-badge--best">Bán chạy</span> : null}
        </div>
      </div>
    </Link>
  );
}
