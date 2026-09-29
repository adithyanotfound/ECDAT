# Expected findings — ecdat-demo-ml-platform

Regression fixture for the ECDAT Atlas discovery engine. Each row is a
planted artefact and the detector rule that should catch it.

| Artefact | File | Rule ID | Expected severity |
|---|---|---|---|
| `hashlib.md5()` cache key | `app/cache.py` | `py.hashlib` | High (derived from CRSF risk category) |
| `Crypto.Cipher.DES3` | `app/legacy_export.py` | `py.pycryptodomeCipher` | High (derived) |
| `ssl.PROTOCOL_TLSv1` | `app/model_registry_client.py` | `py.sslProtocol` | Critical |
| `requests.get(..., verify=False)` | `app/model_registry_client.py` | `py.sslVerifyDisabled` | Critical |
| `paramiko.AutoAddPolicy()` | `app/training_node_ssh.py` | `py.paramikoAutoAddPolicy` | High |
| `Fernet` at-rest encryption | `app/artifact_encryption.py` | `py.fernet` | — (inventory only, sound choice) |
| `pycryptodome`, `paramiko`, `cryptography` deps | `pyproject.toml` | `manifest.requirementsTxt` | — (inventory only) |

This is the broadest-coverage demo repository by design — five distinct
rule IDs across three detector families (call-sites, protocols, manifests)
in under 100 lines of application code.
