# spaCy NER Service

This folder contains a small FastAPI microservice that exposes spaCy-based NER endpoints used by the TypeScript server.

Quick start (local):

1. Create a virtual env and activate it

```powershell
python -m venv .venv
. .venv\Scripts\Activate.ps1
```

2. Install requirements

```powershell
pip install -r requirements.txt
```

3. Install at least one spaCy model (recommended `en_core_web_sm`):

```powershell
python -m spacy download en_core_web_sm
```

4. Run the service

```powershell
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Configuration

- `SPACY_ALLOWED_ORIGINS` - comma-separated origins allowed by CORS (defaults to `http://localhost:3000,http://127.0.0.1:3000`)
- `SPACY_API_KEY` - optional API key. If set, calls to `/ner` and `/ner/batch` must include header `x-api-key: <key>`.

Usage from Node

Set `SPACY_SERVICE_URL` and optionally `SPACY_API_KEY` in your server env and use the provided TypeScript proxy `server/src/services/nerProxy.ts`.
