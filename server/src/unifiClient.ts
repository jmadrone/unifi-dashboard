import { request } from "undici";
import { getCached, setCached } from "./cache.js";

const DEFAULT_BASE = "https://api.ui.com";

export class UnifiApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `UniFi API error (${status})`);
    this.status = status;
    this.body = body;
  }
}

export type UnifiClientOptions = {
  apiKey: string;
  baseUrl?: string;
  cacheTtlSeconds?: number;
};

export class UnifiClient {
  private apiKey: string;
  private baseUrl: string;
  private cacheTtlSeconds: number;

  constructor(opts: UnifiClientOptions) {
    if (!opts.apiKey) throw new Error("UNIFI_API_KEY is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 20;
  }

  async get<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
    options?: { ttlSeconds?: number; skipCache?: boolean },
  ): Promise<T> {
    const search = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        search.set(k, String(v));
      }
    }
    const qs = search.toString();
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const cacheKey = `GET ${url}`;

    if (!options?.skipCache) {
      const cached = getCached<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    const res = await request(url, {
      method: "GET",
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: "application/json",
        "User-Agent": "unifi-dashboard/0.1 (+https://github.com/)",
      },
    });

    const text = await res.body.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new UnifiApiError(res.statusCode, body);
    }

    const ttl = options?.ttlSeconds ?? this.cacheTtlSeconds;
    if (ttl > 0) setCached(cacheKey, body, ttl);
    return body as T;
  }

  /**
   * Fetch all pages of a paginated UniFi Site Manager endpoint, following
   * `nextToken`. Returns a synthetic envelope `{ data, httpStatusCode, traceId }`
   * with `data` concatenated across pages so existing `unwrap()` callers still work.
   */
  async getAllPages<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
    options?: { ttlSeconds?: number; pageSize?: number; maxPages?: number },
  ): Promise<{ data: T[]; httpStatusCode: number; traceId?: string; pages: number }> {
    const pageSize = options?.pageSize ?? Number(query?.pageSize ?? 200);
    const maxPages = options?.maxPages ?? 50;
    const out: T[] = [];
    let nextToken: string | undefined;
    let pages = 0;
    let lastStatus = 200;
    let lastTrace: string | undefined;

    do {
      const page = await this.get<any>(
        path,
        { ...query, pageSize, nextToken },
        { ttlSeconds: options?.ttlSeconds },
      );
      const chunk: T[] = Array.isArray(page?.data) ? page.data : Array.isArray(page) ? page : [];
      out.push(...chunk);
      lastStatus = Number(page?.httpStatusCode ?? 200);
      lastTrace = page?.traceId;
      nextToken = page?.nextToken || page?.pageToken || undefined;
      pages++;
      if (pages >= maxPages) break;
    } while (nextToken);

    return { data: out, httpStatusCode: lastStatus, traceId: lastTrace, pages };
  }
}

/**
 * UniFi Site Manager often wraps payloads as { data: [...], httpStatusCode, traceId }.
 * Normalize so callers always get the array.
 */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
