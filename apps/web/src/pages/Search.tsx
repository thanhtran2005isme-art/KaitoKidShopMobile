import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PiCameraBold,
  PiCaretDownBold,
  PiClockCounterClockwiseBold,
  PiFunnelBold,
  PiImageBold,
  PiMagnifyingGlassBold,
  PiMicrophoneBold,
  PiMicrophoneFill,
  PiSortAscendingBold,
  PiTrendUpBold,
  PiX,
} from 'react-icons/pi';

import ProductCard from '../components/product/ProductCard';
import { useImageSearch } from '../hooks/useImageSearch';
import { useVoiceSearch } from '../hooks/useVoiceSearch';
import {
  productApi,
  searchApi,
  type SearchFacets,
  type SuggestionResponse,
} from '../services/api';
import '../styles/search-page.css';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { highlightText } from '../utils/highlight';
import {
  clearSearchHistory,
  getSearchHistory,
  removeSearchEntry,
  trackSearch,
} from '../utils/viewedTracker';

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'price-asc', label: 'Giá thấp → cao' },
  { key: 'price-desc', label: 'Giá cao → thấp' },
  { key: 'bestseller', label: 'Bán chạy' },
  { key: 'rating', label: 'Đánh giá cao' },
];

const PRICE_RANGES = [
  { label: 'Dưới 200k', min: 0, max: 200_000 },
  { label: '200k - 500k', min: 200_000, max: 500_000 },
  { label: '500k - 1tr', min: 500_000, max: 1_000_000 },
  { label: '1tr - 2tr', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2tr', min: 2_000_000, max: 999_999_999 },
];

const EMPTY_FACETS: SearchFacets = {
  categories: {},
  sizes: {},
  colors: {},
  priceRanges: {},
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgParamHandled = useRef(false);

  const queryParam = searchParams.get('q') || '';
  const activeCategory = searchParams.get('category') || '';
  const activeSizes = useMemo(() => {
    const value = searchParams.get('sizes');
    return new Set(value ? value.split(',').filter(Boolean) : []);
  }, [searchParams]);
  const activeColors = useMemo(() => {
    const value = searchParams.get('colors');
    return new Set(value ? value.split(',').filter(Boolean) : []);
  }, [searchParams]);
  const minRating = Number(searchParams.get('rating')) || 0;
  const sort = (searchParams.get('sort') as SortKey) || 'newest';
  const minPrice = searchParams.get('min')
    ? Number(searchParams.get('min'))
    : undefined;
  const maxPrice = searchParams.get('max')
    ? Number(searchParams.get('max'))
    : undefined;
  const activePriceIdx = useMemo(() => {
    if (minPrice === undefined && maxPrice === undefined) return null;
    const index = PRICE_RANGES.findIndex(
      (range) => range.min === minPrice && range.max === maxPrice,
    );
    return index >= 0 ? index : null;
  }, [maxPrice, minPrice]);

  const [keyword, setKeyword] = useState(queryParam);
  const [debounced, setDebounced] = useState(queryParam);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<
    { keyword: string; count: number; searchedAt: number }[]
  >([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [autocomplete, setAutocomplete] = useState<SuggestionResponse>({
    suggestions: [],
    products: [],
  });
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<SearchFacets>(EMPTY_FACETS);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const voice = useVoiceSearch({
    onInterim: (text) => setKeyword(text),
    onResult: (text) => setKeyword(text),
  });
  const image = useImageSearch(48);

  useEffect(() => {
    setKeyword(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setHistory(getSearchHistory());
    void productApi.getBestSellers(6).then((result) => {
      if (result.success && result.data) setTrending(result.data);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (debounced) next.set('q', debounced);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [debounced, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    if (keyword.trim().length < 2) {
      setAutocomplete({ suggestions: [], products: [] });
      return;
    }

    const timer = window.setTimeout(() => {
      void searchApi.suggestions(keyword.trim(), 5).then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setAutocomplete(result.data);
        else setAutocomplete({ suggestions: [], products: [] });
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  useEffect(() => {
    if (imgParamHandled.current) return;
    if (searchParams.get('img') === '1' && image.available) {
      imgParamHandled.current = true;
      fileInputRef.current?.click();
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('img');
        return next;
      }, { replace: true });
    }
  }, [image.available, searchParams, setSearchParams]);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFilterOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileFilterOpen]);

  const updateParams = useCallback(
    (mutator: (next: URLSearchParams) => void) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        mutator(next);
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const query = debounced;
    const hasFilter =
      Boolean(activeCategory) ||
      activeSizes.size > 0 ||
      activeColors.size > 0 ||
      minRating > 0 ||
      minPrice !== undefined;

    if (query.length < 2 && !hasFilter) {
      setResults([]);
      setTotal(0);
      setDidYouMean(null);
      setFacets(EMPTY_FACETS);
      setSearchError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError(null);

    void (async () => {
      try {
        const result = await searchApi.search({
          query,
          category: activeCategory || undefined,
          sizes: activeSizes.size ? Array.from(activeSizes).join(',') : undefined,
          colors: activeColors.size ? Array.from(activeColors).join(',') : undefined,
          minRating: minRating > 0 ? minRating : undefined,
          minPrice,
          maxPrice,
          sortBy: sort,
          page: 1,
          pageSize: 60,
        });

        if (cancelled) return;

        if (result.success && result.data) {
          setResults(result.data.items);
          setTotal(result.data.total);
          setFacets(result.data.facets || EMPTY_FACETS);
          setDidYouMean(result.data.didYouMean || null);
          if (query.length >= 2 && result.data.items.length > 0) trackSearch(query);
        } else {
          setResults([]);
          setTotal(0);
          setFacets(EMPTY_FACETS);
          setDidYouMean(null);
          setSearchError(result.error || 'Không thể tìm sản phẩm lúc này.');
        }
      } catch (error) {
        if (cancelled) return;
        setResults([]);
        setTotal(0);
        setFacets(EMPTY_FACETS);
        setDidYouMean(null);
        setSearchError(
          error instanceof Error ? error.message : 'Không thể tìm sản phẩm lúc này.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    activeColors,
    activeSizes,
    debounced,
    maxPrice,
    minPrice,
    minRating,
    sort,
  ]);

  const setCategory = (category: string) =>
    updateParams((params) => {
      if (category) params.set('category', category);
      else params.delete('category');
    });

  const togglePrice = (index: number) =>
    updateParams((params) => {
      if (activePriceIdx === index) {
        params.delete('min');
        params.delete('max');
        return;
      }
      const range = PRICE_RANGES[index];
      params.set('min', String(range.min));
      params.set('max', String(range.max));
    });

  const toggleSize = (size: string) =>
    updateParams((params) => {
      const next = new Set(activeSizes);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      if (next.size) params.set('sizes', Array.from(next).join(','));
      else params.delete('sizes');
    });

  const toggleColor = (color: string) =>
    updateParams((params) => {
      const next = new Set(activeColors);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      if (next.size) params.set('colors', Array.from(next).join(','));
      else params.delete('colors');
    });

  const setRating = (rating: number) =>
    updateParams((params) => {
      if (rating > 0) params.set('rating', String(rating));
      else params.delete('rating');
    });

  const setSortKey = (nextSort: SortKey) =>
    updateParams((params) => {
      if (nextSort === 'newest') params.delete('sort');
      else params.set('sort', nextSort);
    });

  const resetFilters = useCallback(() => {
    updateParams((params) => {
      ['category', 'sizes', 'colors', 'rating', 'min', 'max', 'sort'].forEach((key) =>
        params.delete(key),
      );
    });
  }, [updateParams]);

  const sizeOptions = useMemo(
    () => Array.from(new Set([...Object.keys(facets.sizes), ...activeSizes])),
    [activeSizes, facets.sizes],
  );
  const colorOptions = useMemo(
    () => Array.from(new Set([...Object.keys(facets.colors), ...activeColors])),
    [activeColors, facets.colors],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(facets.categories),
          ...(activeCategory ? [activeCategory] : []),
        ]),
      ),
    [activeCategory, facets.categories],
  );

  const filterCount =
    (activeCategory ? 1 : 0) +
    (activePriceIdx !== null ? 1 : 0) +
    activeSizes.size +
    activeColors.size +
    (minRating > 0 ? 1 : 0);

  const onPickImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void image.searchFile(file);
    event.target.value = '';
  };

  return (
    <div className="search-page">
      <header className="search-heading">
        <p className="search-kicker">KaitoKid Fashion</p>
        <h1 className="search-title">Tìm kiếm sản phẩm</h1>

        <div className="search-box">
          <div className="search-box-main">
            <PiMagnifyingGlassBold className="search-box-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              className="search-box-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 160)}
              placeholder="Tìm áo sơ mi, quần jeans, váy..."
              aria-label="Tìm kiếm sản phẩm"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={onPickImage}
              hidden
            />

            <div className="search-box-actions">
              {keyword ? (
                <button
                  className="search-icon-action is-clear"
                  type="button"
                  aria-label="Xóa từ khóa"
                  onClick={() => {
                    setKeyword('');
                    inputRef.current?.focus();
                  }}>
                  <PiX aria-hidden="true" />
                </button>
              ) : null}

              {voice.supported ? (
                <button
                  className={`search-icon-action ${voice.listening ? 'is-listening' : ''}`}
                  type="button"
                  aria-label={voice.listening ? 'Dừng tìm bằng giọng nói' : 'Tìm bằng giọng nói'}
                  onClick={() => (voice.listening ? voice.stop() : voice.start())}>
                  {voice.listening ? (
                    <PiMicrophoneFill aria-hidden="true" />
                  ) : (
                    <PiMicrophoneBold aria-hidden="true" />
                  )}
                </button>
              ) : null}

              {image.available ? (
                <button
                  className="search-icon-action"
                  type="button"
                  aria-label="Tìm bằng hình ảnh"
                  onClick={() => fileInputRef.current?.click()}>
                  <PiCameraBold aria-hidden="true" />
                </button>
              ) : null}

              <button
                className="search-icon-action is-primary"
                type="button"
                aria-label="Tìm kiếm"
                onClick={() => {
                  setDebounced(keyword.trim());
                  setShowSuggestions(false);
                }}>
                <PiMagnifyingGlassBold aria-hidden="true" />
              </button>
            </div>
          </div>

          {showSuggestions ? (
            <div className="search-suggestions" role="listbox">
              {keyword.trim().length >= 2 && autocomplete.suggestions.length > 0 ? (
                <div>
                  <div className="search-suggestion-head">Gợi ý từ khóa</div>
                  {autocomplete.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="search-suggestion-row"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setKeyword(suggestion);
                        setShowSuggestions(false);
                      }}>
                      <PiMagnifyingGlassBold aria-hidden="true" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {keyword.trim().length >= 2 && autocomplete.products.length > 0 ? (
                <div>
                  <div className="search-suggestion-head">Sản phẩm gợi ý</div>
                  {autocomplete.products.map((product) => (
                    <button
                      key={product.id}
                      className="search-suggestion-row"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        navigate(`/product/${product.id}`);
                      }}>
                      <img
                        className="search-suggestion-product-image"
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="search-suggestion-copy">
                        <span className="search-suggestion-name">
                          {highlightText(product.name, keyword)}
                        </span>
                        <span className="search-suggestion-price">
                          {formatCurrency(product.price)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {keyword.trim().length < 2 && history.length > 0 ? (
                <div>
                  <div className="search-suggestion-head">
                    <span>Tìm kiếm gần đây</span>
                    <button
                      className="search-suggestion-clear"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        clearSearchHistory();
                        setHistory([]);
                      }}>
                      Xóa tất cả
                    </button>
                  </div>
                  {history.slice(0, 6).map((item) => (
                    <div key={item.keyword} className="search-suggestion-row">
                      <PiClockCounterClockwiseBold aria-hidden="true" />
                      <button
                        type="button"
                        className="search-suggestion-clear"
                        style={{ flex: 1, textAlign: 'left', color: 'inherit' }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setKeyword(item.keyword);
                        }}>
                        {item.keyword}
                      </button>
                      <button
                        type="button"
                        className="search-suggestion-clear"
                        aria-label={`Xóa ${item.keyword}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          removeSearchEntry(item.keyword);
                          setHistory(getSearchHistory());
                        }}>
                        <PiX aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {keyword.trim().length < 2 && trending.length > 0 ? (
                <div>
                  <div className="search-suggestion-head">
                    <span><PiTrendUpBold aria-hidden="true" /> Sản phẩm đang được quan tâm</span>
                  </div>
                  {trending.map((product) => (
                    <button
                      key={product.id}
                      className="search-suggestion-row"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        navigate(`/product/${product.id}`);
                      }}>
                      <img
                        className="search-suggestion-product-image"
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="search-suggestion-copy">
                        <span className="search-suggestion-name">{product.name}</span>
                        <span className="search-suggestion-price">
                          {formatCurrency(product.price)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {mobileFilterOpen ? (
        <button
          className="search-drawer-backdrop"
          type="button"
          aria-label="Đóng bộ lọc"
          onClick={() => setMobileFilterOpen(false)}
        />
      ) : null}

      <div className="search-layout">
        <aside
          className={`search-sidebar ${mobileFilterOpen ? 'is-open' : ''}`}
          aria-label="Bộ lọc tìm kiếm"
          role={mobileFilterOpen ? 'dialog' : undefined}
          aria-modal={mobileFilterOpen ? true : undefined}>
          <div className="search-filter-panel">
            <div className="search-filter-head">
              <h2 className="search-filter-title">
                <PiFunnelBold aria-hidden="true" />
                Bộ lọc
                {filterCount ? <span className="search-filter-count">{filterCount}</span> : null}
              </h2>
              {filterCount ? (
                <button className="search-reset" type="button" onClick={resetFilters}>
                  Xóa lọc
                </button>
              ) : null}
              <button
                className="search-filter-close"
                type="button"
                aria-label="Đóng bộ lọc"
                onClick={() => setMobileFilterOpen(false)}>
                <PiX aria-hidden="true" />
              </button>
            </div>

            {categoryOptions.length ? (
              <FilterGroup title="Danh mục">
                <div className="search-radio-list">
                  <Radio checked={!activeCategory} onChange={() => setCategory('')}>
                    Tất cả
                  </Radio>
                  {categoryOptions.slice(0, 10).map((category) => (
                    <Radio
                      key={category}
                      checked={activeCategory === category}
                      onChange={() => setCategory(category)}>
                      {category}
                      <span className="search-facet-count">
                        {facets.categories[category] ?? 0}
                      </span>
                    </Radio>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            <FilterGroup title="Khoảng giá">
              <div className="search-radio-list">
                {PRICE_RANGES.map((range, index) => (
                  <Radio
                    key={range.label}
                    checked={activePriceIdx === index}
                    onChange={() => togglePrice(index)}>
                    {range.label}
                    {facets.priceRanges[range.label] !== undefined ? (
                      <span className="search-facet-count">
                        {facets.priceRanges[range.label]}
                      </span>
                    ) : null}
                  </Radio>
                ))}
              </div>
            </FilterGroup>

            {sizeOptions.length ? (
              <FilterGroup title="Kích cỡ">
                <div className="search-chip-list">
                  {sizeOptions.map((size) => (
                    <button
                      key={size}
                      className={`search-chip ${activeSizes.has(size) ? 'is-active' : ''}`}
                      type="button"
                      aria-pressed={activeSizes.has(size)}
                      onClick={() => toggleSize(size)}>
                      {size}
                      {facets.sizes[size] !== undefined ? ` · ${facets.sizes[size]}` : ''}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            {colorOptions.length ? (
              <FilterGroup title="Màu sắc">
                <div className="search-chip-list">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={`search-chip ${activeColors.has(color) ? 'is-active' : ''}`}
                      type="button"
                      aria-pressed={activeColors.has(color)}
                      onClick={() => toggleColor(color)}>
                      {color}
                      {facets.colors[color] !== undefined ? ` · ${facets.colors[color]}` : ''}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            <FilterGroup title="Đánh giá tối thiểu">
              <div className="search-radio-list">
                {[5, 4, 3, 0].map((rating) => (
                  <Radio
                    key={rating}
                    checked={minRating === rating}
                    onChange={() => setRating(rating)}>
                    {rating === 0 ? 'Tất cả' : `${'★'.repeat(rating)} ${rating} sao trở lên`}
                  </Radio>
                ))}
              </div>
            </FilterGroup>
          </div>
        </aside>

        <main className="search-main">
          {image.hasSearched ? (
            <section className="search-image-panel" aria-label="Kết quả tìm bằng hình ảnh">
              <div className="search-image-head">
                {image.previewUrl ? (
                  <img
                    className="search-image-preview"
                    src={image.previewUrl}
                    alt="Ảnh dùng để tìm kiếm"
                  />
                ) : null}
                <div className="search-image-copy">
                  <div className="search-image-title">
                    <PiImageBold aria-hidden="true" /> Tìm theo hình ảnh
                  </div>
                  <div className={`search-image-description ${image.error ? 'search-state-error' : ''}`}>
                    {image.loading
                      ? 'Đang phân tích ảnh và tìm sản phẩm tương đồng…'
                      : image.error
                        ? image.error
                        : `Tìm thấy ${image.results.length} sản phẩm tương đồng`}
                  </div>
                </div>
                <div className="search-image-actions">
                  <button
                    className="search-secondary-action"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}>
                    <PiCameraBold aria-hidden="true" /> Đổi ảnh
                  </button>
                  <button
                    className="search-secondary-action"
                    type="button"
                    onClick={image.reset}>
                    <PiX aria-hidden="true" /> Thoát
                  </button>
                </div>
              </div>

              {image.loading ? (
                <SkeletonGrid />
              ) : image.results.length ? (
                <div className="search-products-grid">
                  {image.results.map(({ product, similarity }) => (
                    <div key={product.id} style={{ position: 'relative' }}>
                      <span className="search-similarity">
                        {Math.round(similarity * 100)}% giống
                      </span>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              ) : !image.error ? (
                <StateCard
                  title="Chưa tìm thấy sản phẩm tương đồng"
                  description="Hãy thử một ảnh rõ sản phẩm hơn, đủ sáng và ít vật thể nền."
                  icon={<PiImageBold aria-hidden="true" />}
                />
              ) : null}
            </section>
          ) : (
            <>
              <div className="search-toolbar">
                <div className="search-result-copy" aria-live="polite">
                  {loading ? (
                    'Đang tìm sản phẩm…'
                  ) : debounced ? (
                    <>
                      Tìm thấy <strong>{total}</strong> sản phẩm cho “<strong>{debounced}</strong>”
                    </>
                  ) : filterCount ? (
                    <>Tìm thấy <strong>{total}</strong> sản phẩm theo bộ lọc</>
                  ) : (
                    'Nhập tối thiểu 2 ký tự để bắt đầu tìm'
                  )}
                </div>

                <button
                  className="search-mobile-filter"
                  type="button"
                  aria-expanded={mobileFilterOpen}
                  onClick={() => setMobileFilterOpen(true)}>
                  <PiFunnelBold aria-hidden="true" />
                  Bộ lọc {filterCount ? `(${filterCount})` : ''}
                </button>

                <div className="search-sort">
                  <PiSortAscendingBold aria-hidden="true" />
                  <select
                    aria-label="Sắp xếp kết quả"
                    value={sort}
                    onChange={(event) => setSortKey(event.target.value as SortKey)}>
                    {SORTS.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {didYouMean ? (
                <div className="search-did-you-mean">
                  Bạn có ý là{' '}
                  <button type="button" onClick={() => setKeyword(didYouMean)}>
                    {didYouMean}
                  </button>
                  ?
                </div>
              ) : null}

              {loading ? (
                <SkeletonGrid />
              ) : searchError ? (
                <StateCard
                  title="Chưa tìm được sản phẩm"
                  description={searchError}
                  icon={<PiX aria-hidden="true" />}
                  error
                  actionLabel="Thử lại"
                  onAction={() => setDebounced(`${keyword.trim()} ` .trim())}
                />
              ) : results.length ? (
                <div className="search-products-grid">
                  {results.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : debounced.length >= 2 || filterCount > 0 ? (
                <StateCard
                  title="Không tìm thấy sản phẩm phù hợp"
                  description="Thử từ khóa khác hoặc bỏ bớt bộ lọc để mở rộng kết quả."
                  icon={<PiMagnifyingGlassBold aria-hidden="true" />}>
                  {trending.length ? (
                    <div className="search-suggestions-grid">
                      {trending.slice(0, 4).map((product) => (
                        <Link key={product.id} to={`/product/${product.id}`}>
                          <img
                            src={product.image}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="search-suggestion-card-copy">
                            <div className="search-suggestion-card-name">{product.name}</div>
                            <div className="search-suggestion-card-price">
                              {formatCurrency(product.price)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </StateCard>
              ) : (
                <StateCard
                  title="Bạn đang tìm món đồ nào?"
                  description="Tìm theo tên sản phẩm, danh mục, màu sắc hoặc kích cỡ."
                  icon={<PiMagnifyingGlassBold aria-hidden="true" />}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="search-filter-group">
      <button
        className="search-filter-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        {title}
        <PiCaretDownBold aria-hidden="true" />
      </button>
      {open ? <div className="search-filter-content">{children}</div> : null}
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
    <label className="search-radio">
      <input type="radio" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function SkeletonGrid() {
  return (
    <div className="search-products-grid" aria-label="Đang tải sản phẩm">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="search-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

function StateCard({
  title,
  description,
  icon,
  error = false,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  error?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="search-state" role={error ? 'alert' : undefined}>
      <div className="search-state-icon">{icon}</div>
      <h2>{title}</h2>
      <p className={error ? 'search-state-error' : undefined}>{description}</p>
      {actionLabel && onAction ? (
        <button className="search-secondary-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}
