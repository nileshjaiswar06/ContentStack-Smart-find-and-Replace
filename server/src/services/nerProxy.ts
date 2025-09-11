import axios from 'axios';

const SPACY_URL = process.env.SPACY_SERVICE_URL || 'http://localhost:8000';
const SPACY_API_KEY = process.env.SPACY_API_KEY || undefined;

export type NerEntity = {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
};

export type NerResponse = {
  entities: NerEntity[];
  model_used: string;
  processing_time_ms: number;
  text_length: number;
  entity_count: number;
};

export async function extractEntities(text: string, model = 'en_core_web_sm', min_confidence = 0.5): Promise<NerResponse> {
  const resp = await axios.post(`${SPACY_URL}/ner`, { text, model, min_confidence }, ( {
    headers: SPACY_API_KEY ? { 'x-api-key': SPACY_API_KEY } : undefined
  } as any));
  return resp.data as NerResponse;
}

export async function extractEntitiesBatch(texts: string[], model = 'en_core_web_sm', min_confidence = 0.5) {
  const resp = await axios.post(`${SPACY_URL}/ner/batch`, { texts, model, min_confidence });
  return resp.data as { results: NerResponse[]; total_processing_time_ms: number; batch_size: number };
}
