/**
 * Retries only explicitly whitelisted read-only endpoints when transport fails.
 * Never retry POST/PUT/DELETE, including checkout, wallet withdrawal or cancellation.
 * GET /api/payment/instructions can create provider state and is intentionally excluded.
 */
const READ_ONLY_PREFIXES = [
  '/api/banners',
  '/api/categories',
  '/api/products',
  '/api/homepage-blocks',
  '/api/collections',
  '/api/lookbooks',
  '/api/recommendations',
  '/api/search',
  '/api/cart',
  '/api/wishlist',
  '/api/addresses',
  '/api/orders',
  '/api/notifications',
  '/api/wallet',
  '/api/payment/config',
] as const;

export type ApiTransportFailure = 'timeout' | 'network' | 'canceled';

export class ApiTransportError extends Error {
  constructor(
    public readonly kind: ApiTransportFailure,
    public readonly attempts: number,
  ) {
    super(kind === 'timeout' ? 'Node API timeout' : kind === 'canceled' ? 'Yêu cầu đã bị hủy' : 'Node API network error');
    this.name = 'ApiTransportError';
  }
}

export function canRetryReadRequest(path: string, init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || init?.body != null) return false;
  const pathname = path.split('?')[0];
  return READ_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

export async function fetchWithTransportRetry(
  url: string,
  path: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  requester: typeof fetch = fetch,
): Promise<Response> {
  const attempts = canRetryReadRequest(path, init) ? 2 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    let userCanceled = false;
    const signal = init?.signal;
    const abortForCaller = () => {
      userCanceled = true;
      controller.abort();
    };
    if (signal?.aborted) abortForCaller();
    else signal?.addEventListener('abort', abortForCaller, { once: true });

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      // The previous attempt's signal must never be reused by a retry.
      return await requester(url, {
        ...init,
        headers: { Accept: 'application/json', ...init?.headers },
        signal: controller.signal,
      });
    } catch (error) {
      const canceled = userCanceled || signal?.aborted ||
        (!timedOut && error instanceof Error && error.name === 'AbortError');
      if (canceled) throw new ApiTransportError('canceled', attempt);
      if (!timedOut && !(error instanceof TypeError)) throw error;
      if (attempt === attempts) {
        throw new ApiTransportError(timedOut ? 'timeout' : 'network', attempt);
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortForCaller);
    }
    // Small, bounded delay; requests with monetary side effects never reach it.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    if (init?.signal?.aborted) throw new ApiTransportError('canceled', attempt);
  }
  throw new Error('Không thể gửi yêu cầu.');
}
