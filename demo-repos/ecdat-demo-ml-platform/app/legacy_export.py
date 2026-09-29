"""
Encrypted export of model artefacts to the shared data-science drive.

ECDAT fixture note: Triple DES via PyCryptodome, carried over from a 2019
compliance requirement that has since been superseded — nobody has revisited
it since.
"""
from Crypto.Cipher import DES3
from Crypto.Util.Padding import pad


def encrypt_export(key: bytes, payload: bytes) -> bytes:
    cipher = DES3.new(key, DES3.MODE_CBC)
    return cipher.iv + cipher.encrypt(pad(payload, DES3.block_size))
