import axios,{ type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import dotenv from "dotenv";
import { contentstackErrorHandler } from "../middlewares/errorHandler.js";

dotenv.config();

// Required env vars
const API_HOST = process.env.CONTENTSTACK_API_HOST!;
const DELIVERY_API = process.env.CONTENTSTACK_DELIVERY_API!;
const STACK_API_KEY = process.env.CONTENTSTACK_API_KEY!;
const DELIVERY_TOKEN = process.env.CONTENTSTACK_DELIVERY_TOKEN!;
const MANAGEMENT_TOKEN = process.env.CONTENTSTACK_MANAGEMENT_TOKEN!;
const ENV = process.env.CONTENTSTACK_ENVIRONMENT!;

// Retry defaults (override via env)
const DEFAULT_RETRIES = Number(process.env.CONTENTSTACK_RETRIES ?? 3);

// CDA (Delivery API) client
const cda: AxiosInstance = axios.create({
  baseURL: `${DELIVERY_API}/v3`,
  headers: {
    api_key: STACK_API_KEY,
    access_token: DELIVERY_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

axiosRetry(cda, {
  retries: Number(process.env.CONTENTSTACK_CDA_RETRIES ?? DEFAULT_RETRIES),
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.response?.status === 429,
});

// ===== CMA (Management API) client =====
const cma: AxiosInstance = axios.create({
  baseURL: `${API_HOST}/v3`,
  headers: {
    api_key: STACK_API_KEY,
    authorization: MANAGEMENT_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

axiosRetry(cma, {
  retries: Number(process.env.CONTENTSTACK_CMA_RETRIES ?? DEFAULT_RETRIES),
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.response?.status === 429,
});

// Fetch entries of a content type (with optional pagination + locale)
export async function fetchEntriesOfContentType<T = any>(
  contentTypeUid: string,
  options: {
    environment?: string;
    locale?: string;
    limit?: number;
    skip?: number;
    fetchAll?: boolean;
  } = {}
): Promise<{ entries: T[]; count: number }>
{
  try {
    const environment = options.environment ?? ENV;
    const limit = options.limit ?? 100;
    const locale = options.locale;

    if (options.fetchAll) {
      // handle pagination and preserve server-reported count when available
      let allEntries: T[] = [];
      let skip = 0;
      let totalCount: number | undefined;
      while (true) {
        const resp = await cda.get(
          `/content_types/${encodeURIComponent(contentTypeUid)}/entries`,
          {
            params: { environment, include_count: true, limit, skip, locale },
          }
        );
        const data = resp.data;
        totalCount = totalCount ?? data.count;
        allEntries = allEntries.concat(data.entries || []);
        if (!data.entries || data.entries.length < limit) break;
        skip += limit;
      }
      return { entries: allEntries, count: totalCount ?? allEntries.length };
    } else {
      const resp = await cda.get(
        `/content_types/${encodeURIComponent(contentTypeUid)}/entries`,
        {
          params: {
            environment,
            include_count: true,
            limit,
            skip: options.skip ?? 0,
            locale,
          },
        }
      );
      return resp.data as { entries: T[]; count: number };
    }
  } catch (err: any) {
    throw contentstackErrorHandler(err);
  }
}

// Fetch a single entry (draft or published)
export async function fetchEntryDraft(
  contentTypeUid: string,
  entryUid: string,
  options: {
    environment?: string;
    locale?: string;
    include_unpublished?: boolean;
  } = {}
): Promise<any> {
  try {
    const environment = options.environment ?? ENV;
    const params: any = { environment };
    if (options.locale) params.locale = options.locale;
    if (options.include_unpublished)
      params.include_unpublished = options.include_unpublished;

    const resp = await cma.get(
      `/content_types/${encodeURIComponent(contentTypeUid)}/entries/${encodeURIComponent(entryUid)}`,
      { params }
    );
    return resp.data.entry;
  } catch (err: any) {
    throw contentstackErrorHandler(err);
  }
}

// Update an entry with new payload (optimistic concurrency via _version)
export async function updateEntry(
  contentTypeUid: string,
  entryUid: string,
  entryPayload: any
): Promise<any> {
  try {
    // preserve _version if provided
    const payload: any = { ...entryPayload };
    if (entryPayload._version) {
      payload._version = entryPayload._version;
    }

    const resp = await cma.put(
      `/content_types/${encodeURIComponent(contentTypeUid)}/entries/${encodeURIComponent(entryUid)}`,
      { entry: payload }
    );
    return resp.data.entry;
  } catch (err: any) {
    throw contentstackErrorHandler(err);
  }
}
