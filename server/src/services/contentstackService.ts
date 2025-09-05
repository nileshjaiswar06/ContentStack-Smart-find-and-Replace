import axios, { AxiosError, type AxiosResponse } from "axios";
import dotenv from "dotenv";
dotenv.config();

// Environment variables with validation
const API_HOST = process.env.CONTENTSTACK_API_HOST;
const DELIVERY_API = process.env.CONTENTSTACK_DELIVERY_API;
const STACK_API_KEY = process.env.CONTENTSTACK_API_KEY;
const DELIVERY_TOKEN = process.env.CONTENTSTACK_DELIVERY_TOKEN;
const MANAGEMENT_TOKEN = process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
const ENV = process.env.CONTENTSTACK_ENVIRONMENT;

// Validate required environment variables
const requiredEnvVars = {
  CONTENTSTACK_DELIVERY_API: process.env.CONTENTSTACK_DELIVERY_API,
  CONTENTSTACK_API_KEY: process.env.CONTENTSTACK_API_KEY,
  CONTENTSTACK_DELIVERY_TOKEN: process.env.CONTENTSTACK_DELIVERY_TOKEN,
  CONTENTSTACK_ENVIRONMENT: process.env.CONTENTSTACK_ENVIRONMENT
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Interface for Contentstack API response
interface ContentstackResponse<T> {
  entries: T[];
  content_type: any;
}

/**
 * Fetches entries of a specific content type from Contentstack
 * @param contentTypeUid - The UID of the content type to fetch entries for
 * @returns A promise that resolves to the fetched entries
 * @throws Will throw an error if the request fails or if required environment variables are missing
 */

export async function fetchEntriesOfContentType<T = any>(contentTypeUid: string): Promise<ContentstackResponse<T>> {
  if (!contentTypeUid) {
    throw new Error("Content Type UID is required");
  }

  const url = `${DELIVERY_API}/v3/content_types/${contentTypeUid}/entries?environment=${ENV}`;
  
  const headers = {
    api_key: STACK_API_KEY,
    access_token: DELIVERY_TOKEN,
    'Content-Type': 'application/json'
  };

  try {
    const response: AxiosResponse<ContentstackResponse<T>> = await axios.get(url, { 
      headers,
      timeout: 10000 // 10 seconds timeout
    });
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(`Contentstack API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
    } else if (axiosError.request) {
      // The request was made but no response was received
      throw new Error('No response received from Contentstack API');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`Error setting up request to Contentstack API: ${axiosError.message}`);
    }
  }
}

// Update entry (CMA)
export async function updateEntry(contentTypeUid: string, entryUid: string, payload: any) {
  const url = `${API_HOST}/v3/content_types/${contentTypeUid}/entries/${entryUid}`;
  const headers = {
    api_key: STACK_API_KEY,
    authorization: MANAGEMENT_TOKEN,
    'Content-Type': 'application/json'
  };
  const r = await axios.put(url, payload, { headers });
  return r.data;
}
