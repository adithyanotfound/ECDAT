from fastapi import FastAPI

from app.cache import feature_cache_key
from app.model_registry_client import fetch_model_metadata

app = FastAPI(title="ecdat-demo-ml-platform")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/features/{model_id}")
def get_features(model_id: str) -> dict:
    key = feature_cache_key(model_id, b"")
    return {"cacheKey": key}
