"""
Feature-cache key derivation.

ECDAT fixture note: MD5 planted here as a cache key hash — a common,
low-stakes-looking mistake that still shows up in a crypto inventory scan
because the function is broken regardless of context.
"""
import hashlib


def feature_cache_key(model_id: str, feature_vector: bytes) -> str:
    return hashlib.md5(model_id.encode() + feature_vector).hexdigest()
