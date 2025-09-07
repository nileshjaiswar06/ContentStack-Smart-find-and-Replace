import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Required env vars
const API_HOST = process.env.CONTENTSTACK_API_HOST!;
const DELIVERY_API = process.env.CONTENTSTACK_DELIVERY_API!;
const STACK_API_KEY = process.env.CONTENTSTACK_API_KEY!;
const DELIVERY_TOKEN = process.env.CONTENTSTACK_DELIVERY_TOKEN!;
const MANAGEMENT_TOKEN = process.env.CONTENTSTACK_MANAGEMENT_TOKEN!;
const ENV = process.env.CONTENTSTACK_ENVIRONMENT!;

// Validate envs at startup
[
  "CONTENTSTACK_API_HOST",
  "CONTENTSTACK_DELIVERY_API",
  "CONTENTSTACK_API_KEY",
  "CONTENTSTACK_DELIVERY_TOKEN",
  "CONTENTSTACK_MANAGEMENT_TOKEN",
  "CONTENTSTACK_ENVIRONMENT",
].forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

// Delivery API client (CDA) → used for fetching published entries
const cda = axios.create({
  baseURL: `${DELIVERY_API}/v3`,
  headers: {
    api_key: STACK_API_KEY,
    access_token: DELIVERY_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Management API client (CMA) → used for drafts + updates
const cma = axios.create({
  baseURL: `${API_HOST}/v3`,
  headers: {
    api_key: STACK_API_KEY,
    authorization: MANAGEMENT_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

/**
 * Fetch all entries of a content type
 * @param contentTypeUid - UID of the content type
 * @returns entries[] and count
 */
export async function fetchEntriesOfContentType<T = any>(contentTypeUid: string) {
  const r = await cda.get(`/content_types/${contentTypeUid}/entries`, {
    params: { environment: ENV, include_count: true, limit: 100, skip: 0 },
  });
  return r.data as { entries: T[]; count: number };
}

/**
 * Fetch a single entry (draft or published)
 * @param contentTypeUid - UID of the content type
 * @param entryUid - UID of the entry
 * @returns entry object
 */
export async function fetchEntryDraft(contentTypeUid: string, entryUid: string) {
  const r = await cma.get(`/content_types/${contentTypeUid}/entries/${entryUid}`);
  return r.data.entry;
}

/**
 * Update an entry with new payload
 * @param contentTypeUid - UID of the content type
 * @param entryUid - UID of the entry
 * @param entryPayload - new data for the entry
 * @returns updated entry
 */
export async function updateEntry(contentTypeUid: string, entryUid: string, entryPayload: any) {
  const r = await cma.put(`/content_types/${contentTypeUid}/entries/${entryUid}`, {
    entry: entryPayload, // CMA requires { entry: {...} }
  });
  return r.data.entry;
}
