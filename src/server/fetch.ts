const UPSTREAM_TIMEOUT_MS = 8_000;
const UPSTREAM_MAX_ATTEMPTS = 2;
const UPSTREAM_RETRY_DELAY_MS = 250;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Sleeper = (milliseconds: number, signal?: AbortSignal | null) => Promise<void>;

type RetryEvent = {
  url: string;
  attempt: number;
  nextAttempt: number;
  errorType: string;
  errorMessage: string;
  status?: number;
};

type FetchWithTimeoutOptions = {
  fetcher?: Fetcher;
  sleep?: Sleeper;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  onRetry?: (event: RetryEvent) => void;
};

function sleep(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function errorDetails(error: unknown): { errorType: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorType: error.name || "Error", errorMessage: error.message };
  }
  return { errorType: typeof error, errorMessage: String(error) };
}

function isRetryableError(error: unknown, timeout: AbortSignal): boolean {
  if (timeout.aborted) return true;
  if (error instanceof TypeError) return true;
  return error instanceof DOMException
    && (error.name === "AbortError" || error.name === "TimeoutError");
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function logRetry(event: RetryEvent): void {
  console.warn(JSON.stringify({ message: "upstream request retry", ...event }));
}

export function createFetchWithTimeout(options: FetchWithTimeoutOptions = {}): Fetcher {
  // Resolve the global at request time so tests and compatible runtimes can
  // install their request-scoped fetch implementation after module loading.
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const wait = options.sleep ?? sleep;
  const timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? UPSTREAM_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? UPSTREAM_RETRY_DELAY_MS;
  const onRetry = options.onRetry ?? logRetry;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("timeoutMs must be positive");
  }

  return async (input, init = {}) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (init.signal?.aborted) throw init.signal.reason;

      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

      try {
        const response = await fetcher(input, { ...init, signal });
        if (!isRetryableStatus(response.status) || attempt === maxAttempts) return response;

        await response.body?.cancel().catch(() => undefined);
        onRetry({
          url: requestUrl(input),
          attempt,
          nextAttempt: attempt + 1,
          errorType: `HTTP ${response.status}`,
          errorMessage: `Upstream returned HTTP ${response.status}`,
          status: response.status,
        });
      } catch (error) {
        if (init.signal?.aborted || attempt === maxAttempts || !isRetryableError(error, timeout)) {
          throw error;
        }

        onRetry({
          url: requestUrl(input),
          attempt,
          nextAttempt: attempt + 1,
          ...errorDetails(error),
        });
      }

      await wait(retryDelayMs, init.signal);
    }

    throw new Error("Upstream request exhausted all attempts");
  };
}

export const fetchWithTimeout = createFetchWithTimeout();
