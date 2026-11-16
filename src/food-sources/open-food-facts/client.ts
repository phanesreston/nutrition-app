/**
 * Server-side client for the Open Food Facts product API (v3).
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 *
 * Open Food Facts asks every client to identify itself with a User-Agent of
 * the form "AppName/Version (contact)" and to stay under 100 product reads
 * per minute per IP; clients that do not may be blocked.
 */

export const OFF_BASE_URL = "https://world.openfoodfacts.org";

/** Only the fields the mapper reads — keeps responses small. */
export const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "generic_name_en",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "nutrition_data_per",
  "nutriments",
  "ingredients_text",
  "ingredients_text_en",
  "image_front_url",
  "image_front_small_url",
  "categories",
  "lang",
] as const;

/** The parts of an Open Food Facts product that we read. */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
  ingredients_text?: string;
  ingredients_text_en?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  categories?: string;
  lang?: string;
}

export type OffFailure = "timeout" | "rate-limited" | "unavailable";

export type OffResult =
  | { status: "found"; product: OffProduct }
  | { status: "not-found" }
  | { status: "error"; reason: OffFailure };

export interface OffClientOptions {
  userAgent: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export const DEFAULT_USER_AGENT = "Nourish/0.1 (self-hosted nutrition tracker; set OFF_USER_AGENT)";

/** User-Agent from `OFF_USER_AGENT`, e.g. "Nourish/0.1 (you@example.com)". */
export function configuredUserAgent(env: Record<string, string | undefined> = process.env): string {
  return env.OFF_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

/**
 * Fetch one product by barcode. Never throws: network failures, timeouts,
 * rate limiting and malformed responses all come back as an `error` result.
 */
export async function fetchOffProduct(barcode: string, options: OffClientOptions): Promise<OffResult> {
  const { userAgent, timeoutMs = 8000, fetchImpl = fetch, baseUrl = OFF_BASE_URL } = options;
  const url = `${baseUrl}/api/v3/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS.join(",")}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const name = (error as Error)?.name;
    return { status: "error", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable" };
  }

  if (response.status === 429) return { status: "error", reason: "rate-limited" };
  // v3 answers 404 with a JSON body for unknown products; other 4xx/5xx are outages or blocks.
  if (response.status !== 200 && response.status !== 404) return { status: "error", reason: "unavailable" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // e.g. the HTML "temporarily unavailable" page.
    return { status: "error", reason: "unavailable" };
  }

  const data = body as { status?: string; result?: { id?: string }; product?: OffProduct };
  if (data?.result?.id === "product_not_found" || response.status === 404) return { status: "not-found" };
  if (data?.product && typeof data.product === "object") return { status: "found", product: data.product };
  return { status: "error", reason: "unavailable" };
}

/**
 * Sliding-window limiter so a burst of scans can never exceed the API's
 * limit, plus a cool-down after the API itself answers 429.
 */
export class RateLimiter {
  private calls: number[] = [];
  private blockedUntil = 0;

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a call and returns true if one may be made now. */
  tryAcquire(): boolean {
    const t = this.now();
    if (t < this.blockedUntil) return false;
    this.calls = this.calls.filter((c) => t - c < this.windowMs);
    if (this.calls.length >= this.maxPerWindow) return false;
    this.calls.push(t);
    return true;
  }

  /** Stop all calls for a while, e.g. after a 429. */
  coolDown(ms: number): void {
    this.blockedUntil = this.now() + ms;
  }
}
