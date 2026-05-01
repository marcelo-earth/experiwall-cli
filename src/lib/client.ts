/**
 * Shared HTTP client for the Experiwall Management API.
 */

const DEFAULT_BASE_URL = "https://experiwall.com";
const TIMEOUT_MS = 30_000;
const CANONICAL_HOSTS = new Set(["experiwall.com", "www.experiwall.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

let baseUrl: string = DEFAULT_BASE_URL;
let apiKey: string = "";

export interface UrlCheck {
  ok: boolean;
  error?: string;
  canonical: boolean;
}

/**
 * Validate that an API base URL is safe to send a secret API key to.
 * Rejects non-https URLs (except http://localhost) so a single typo or
 * copy-pasted command can't exfiltrate credentials.
 */
export function checkApiUrl(url: string): UrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: `Invalid API URL: ${url}`, canonical: false };
  }
  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol === "http:" && !isLocal) {
    return {
      ok: false,
      canonical: false,
      error: `API URL must use https:// (got http://${parsed.hostname}). Plaintext would expose your API key.`,
    };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      canonical: false,
      error: `API URL must be http(s)://, got ${parsed.protocol}`,
    };
  }
  const canonical =
    CANONICAL_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".experiwall.com");
  return { ok: true, canonical };
}

export function initClient(options: { apiKey: string; baseUrl?: string }): void {
  apiKey = options.apiKey;
  baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params } = options;

  let url = `${baseUrl}/api/v1${path}`;

  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) search.set(k, String(v));
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (json.error as string) ?? `API returned ${res.status}`,
      };
    }

    return { ok: true, status: res.status, data: (json.data ?? json) as T };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, status: 0, error: "Request timed out after 30 seconds. Try again." };
    }
    return {
      ok: false,
      status: 0,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function httpErrorMessage(res: ApiResponse): string {
  switch (res.status) {
    case 401:
      return "Unauthorized. Check that your API key is valid (ew_sec_*) and has not been revoked.";
    case 403:
      return `Forbidden. ${res.error ?? "You don't have access to this resource or hit a plan limit."}`;
    case 404:
      return `Not found. ${res.error ?? "The resource does not exist or belongs to a different project."}`;
    case 409:
      return `Conflict. ${res.error ?? "A resource with this identifier already exists."}`;
    case 429:
      return "Rate limit exceeded (60 requests/minute). Wait a moment and retry.";
    default:
      return res.error ?? `Unexpected status ${res.status}`;
  }
}
