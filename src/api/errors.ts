/**
 * Normalized API error. Every failure path in the client throws one of these so
 * screens can branch on `status`/`code` instead of parsing ad-hoc shapes.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable code from the backend body, when present. */
  readonly code?: string;
  /** Field → messages, for form validation errors. */
  readonly fieldErrors?: Record<string, string[]>;
  /** True for network/timeout failures (no HTTP response). */
  readonly isNetwork: boolean;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    fieldErrors?: Record<string, string[]>;
    isNetwork?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.fieldErrors = params.fieldErrors;
    this.isNetwork = params.isNetwork ?? false;
  }
}

/** Shape we try to read out of a backend error body (best-effort, all optional). */
interface ErrorBody {
  message?: string;
  error?: string;
  code?: string;
  errors?: Record<string, string[]>;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Turn a fetch Response (already known to be non-OK) into an ApiError. Reads the
 * body once; tolerates non-JSON bodies.
 */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  let body: ErrorBody | undefined;
  let text = '';
  try {
    text = await res.text();
    if (text) body = JSON.parse(text) as ErrorBody;
  } catch {
    // non-JSON body — keep the raw text as the message
  }

  const message =
    body?.message || body?.error || text || `Request failed with status ${res.status}`;

  return new ApiError({
    message,
    status: res.status,
    code: body?.code,
    fieldErrors: body?.fieldErrors ?? body?.errors,
  });
}

/** Wrap a thrown value (e.g. a fetch network rejection) as an ApiError. */
export function errorFromThrown(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const message = err instanceof Error ? err.message : 'Network request failed';
  return new ApiError({ message, status: 0, isNetwork: true });
}

/** A user-facing sentence for any error (safe fallback included). */
export function userMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return 'No connection. Check your internet and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
