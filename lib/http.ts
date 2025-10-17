export interface PostJsonOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly response: Response;

  constructor(status: number, statusText: string, body: string, response: Response) {
    const label = statusText?.trim().length ? `${status} ${statusText.trim()}` : `${status}`;
    super(`HTTP ${label}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.response = response;
  }
}

export class JsonParseError extends Error {
  readonly responseText: string;

  constructor(responseText: string, cause?: unknown) {
    super("Réponse invalide du serveur");
    this.name = 'JsonParseError';
    this.responseText = responseText;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    (this as Error & { isUserFacing?: boolean }).isUserFacing = true;
  }
}

const isDomAbortError = (error: unknown): boolean => {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  );
};

export const isAbortError = (error: unknown): boolean => {
  return isDomAbortError(error) || (error instanceof Error && error.name === 'AbortError');
};

export const isNetworkError = (error: unknown): boolean => {
  return error instanceof TypeError && error.message === 'Network request failed';
};

export async function postJson<T>(
  url: string,
  body: unknown,
  options: PostJsonOptions = {}
): Promise<T> {
  const { timeoutMs = 45_000, headers = {} } = options;
  const effectiveTimeout = Math.min(timeoutMs, 5 * 60 * 1000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const isDev = (() => {
    if (typeof __DEV__ !== 'undefined') {
      return __DEV__;
    }
    if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
      return process.env.NODE_ENV !== 'production';
    }
    return false;
  })();

  const debugLog = (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  };

  try {
    debugLog('Appel API sortant :', {
      method: 'POST',
      url,
      headers: requestHeaders,
      body,
      timeoutMs: effectiveTimeout,
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();

    const responseHeaders = Object.fromEntries(response.headers.entries());

    debugLog('Réponse API entrante :', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: rawText,
    });

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, rawText, response);
    }

    if (!rawText.trim().length) {
      return {} as T;
    }

    try {
      return JSON.parse(rawText) as T;
    } catch (error) {
      throw new JsonParseError(rawText, error);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
