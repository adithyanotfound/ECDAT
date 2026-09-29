"""
SSH client used to dispatch training jobs to GPU worker nodes.

ECDAT fixture note: AutoAddPolicy silently trusts any host key on first
connect — the exact "SSH host key verification disabled" scenario named in
IMPLEMENTATION_PLAN.md.
"""
import paramiko


def connect_to_worker(host: str, username: str, key_path: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=username, key_filename=key_path)
    return client
