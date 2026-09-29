"use client";

/**
 * The two ways to add something to scan without installing the GitHub App:
 * a public GitHub repository by name, or an AWS account (KMS keys, ACM
 * certificates and optionally CodeCommit/S3 code). Both scan straight away.
 */
import { useState } from "react";
import { Cloud, Loader2 } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Controls";
import { Notice } from "@/components/ui/States";

interface Done {
  onClose: () => void;
  /** Called with the new repository id and, if one started, the scan id. */
  onAdded: (repositoryId: string, scanId?: string) => void;
}

async function startScan(repositoryId: string): Promise<string | undefined> {
  const res = await fetch(`/api/repositories/${repositoryId}/scan`, { method: "POST" });
  if (!res.ok) return undefined;
  const data = await res.json().catch(() => null);
  return data?.scanId;
}

/** Accepts "owner/repo" or a pasted GitHub URL. */
function toFullName(input: string): string {
  const s = input
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const m = s.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  return m ? `${m[1]}/${m[2]}` : s;
}

export function AddGithubRepoDialog({ open, onClose, onAdded }: Done & { open: boolean }) {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "GITHUB",
          fullName: toFullName(repo),
          defaultBranch: branch.trim() || "main",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That repository couldn't be added.");
      const scanId = await startScan(data.id);
      setRepo("");
      onAdded(data.id, scanId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<GithubIcon size={20} />}
      title="Add a public GitHub repository"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-github" variant="primary" disabled={busy || !repo.trim()}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Adding…" : "Add and scan"}
          </Button>
        </>
      }
      description="We download the code, look for cryptography and start the first scan right away. Private repositories need the GitHub App."
    >
      <form id="add-github" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Repository" hint="Owner and name, or paste the GitHub link.">
          <input
            required
            autoFocus
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="e.g. octocat/hello-world"
            className={inputClass}
          />
        </Field>
        <Field label="Branch to scan">
          <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className={inputClass} />
        </Field>
        {error && <Notice tone="critical">{error}</Notice>}
      </form>
    </Modal>
  );
}

export function ConnectAwsDialog({ open, onClose, onAdded }: Done & { open: boolean }) {
  const empty = { name: "", accessKeyId: "", secretAccessKey: "", region: "us-east-1" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "AWS", ...form, region: form.region.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The AWS account couldn't be connected.");
      const scanId = await startScan(data.id);
      setForm(empty);
      onAdded(data.id, scanId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Cloud size={20} />}
      title="Connect an AWS account"
      width="520px"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="connect-aws" variant="primary" disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Connecting…" : "Connect and scan"}
          </Button>
        </>
      }
      description="We read your KMS keys and ACM certificates, and code in CodeCommit or S3 if you name it. Use a read-only IAM user; nothing is changed in your account."
    >
      <form id="connect-aws" onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Name"
          hint="A CodeCommit repository name, an s3://bucket/archive.tar.gz path, or any label for key and certificate checks only."
        >
          <input
            required
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. production"
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Access key ID">
            <input
              required
              value={form.accessKeyId}
              onChange={set("accessKeyId")}
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field label="Region">
            <input
              required
              value={form.region}
              onChange={set("region")}
              placeholder="us-east-1"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Secret access key" hint="Encrypted before it's stored, and never shown again.">
          <input
            required
            type="password"
            value={form.secretAccessKey}
            onChange={set("secretAccessKey")}
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="critical">{error}</Notice>}
      </form>
    </Modal>
  );
}
