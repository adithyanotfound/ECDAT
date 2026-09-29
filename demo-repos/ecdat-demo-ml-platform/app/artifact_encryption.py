"""
At-rest encryption for model artefacts using Fernet (a good choice — AES-128
in CBC mode with an HMAC, key-rotatable). Included as the "not everything
here is broken" contrast case within an otherwise weak repository.
"""
from cryptography.fernet import Fernet


def new_artifact_key() -> bytes:
    return Fernet.generate_key()


def encrypt_artifact(key: bytes, data: bytes) -> bytes:
    return Fernet(key).encrypt(data)
