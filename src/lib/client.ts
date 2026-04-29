/**
 * Shared HTTP client for the Experiwall Management API.
 */

const DEFAULT_BASE_URL = "https://experiwall.com";
const TIMEOUT_MS = 30_000;

let baseUrl: string = DEFAULT_BASE_URL;
let apiKey: string = "";

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
