/**
 * Machine-readable codes the backend attaches to a refusal (see
 * `GlobalExceptionHandler`). Screens branch on these rather than on message
 * text, because each one has a different way out:
 *
 * - `SUBSCRIPTION_REQUIRED` — the shop's plan has lapsed; work is gated.
 * - `IMAGE_LIMIT_REACHED`  — the monthly image allowance is spent.
 * - `AUTO_MASK_UNAVAILABLE` — no AI wall-detection credits; marking walls by
 *   hand is free on every tier, so steer there instead of to a payment.
 * - `ASK_RETAILER` — a shop-onboarded customer is out of projects. Their shop
 *   assigned and paid for them, so the app asks the shop rather than selling.
 * - `VERIFICATION_REQUIRED` — e-mail/phone needs verifying first.
 */
export const API_CODES = {
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  IMAGE_LIMIT_REACHED: 'IMAGE_LIMIT_REACHED',
  AUTO_MASK_UNAVAILABLE: 'AUTO_MASK_UNAVAILABLE',
  ASK_RETAILER: 'ASK_RETAILER',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
} as const;

export type ApiCode = (typeof API_CODES)[keyof typeof API_CODES];

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

/** True when `err` is an ApiError carrying exactly this backend code. */
export function hasCode(err: unknown, code: ApiCode): boolean {
  return err instanceof ApiError && err.code === code;
}

/** A user-facing sentence for any error (safe fallback included). */
export function userMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return 'No connection. Check your internet and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
