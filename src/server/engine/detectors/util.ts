export function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function snippet(content: string, index: number, matchLen: number, pad = 40): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(content.length, index + matchLen + pad);
  return content.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Shannon entropy in bits/char — used to gate secret detection. */
export function shannonEntropy(s: string): number {
  if (!s.length) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const MODES = ["gcm", "cbc", "ecb", "ctr", "cfb", "ofb", "ccm", "xts", "poly1305"];

/** Splits an OpenSSL-style cipher name ("aes-256-cbc", "des-ede3-cbc") into algorithm + mode. */
export function splitCipherMode(name: string): { algo: string; mode?: string } {
  const lower = name.toLowerCase();
  for (const mode of MODES) {
    if (lower.endsWith(`-${mode}`) || lower.endsWith(`_${mode}`)) {
      return { algo: name.slice(0, name.length - mode.length - 1), mode: mode.toUpperCase() };
    }
  }
  return { algo: name };
}

/** Extracts a key length in bits embedded in a cipher/name string, e.g. "aes-256-cbc" -> 256. */
export function extractKeyLength(name: string): number | undefined {
  const m = name.match(/(?:^|[^0-9])(1024|2048|3072|4096|128|192|256|160|224|384|512)(?:[^0-9]|$)/);
  return m ? Number(m[1]) : undefined;
}

/** Iterate every regex match in content, yielding index + groups, without infinite loop on zero-length matches. */
export function* iterMatches(re: RegExp, content: string): Generator<RegExpExecArray> {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const global = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = global.exec(content))) {
    yield m;
    if (m[0].length === 0) global.lastIndex++;
  }
}
