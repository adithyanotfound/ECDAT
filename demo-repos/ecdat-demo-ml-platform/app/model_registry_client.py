"""
Client for the internal model registry over HTTPS.

ECDAT fixture note: two separate planted TLS weaknesses — an explicit
TLSv1 protocol pin, and certificate verification disabled "temporarily"
during a debugging session that was never reverted.
"""
import ssl
import requests


def make_legacy_context() -> ssl.SSLContext:
    return ssl.SSLContext(ssl.PROTOCOL_TLSv1)


def fetch_model_metadata(url: str) -> dict:
    response = requests.get(url, verify=False, timeout=10)
    return response.json()
