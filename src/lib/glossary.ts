/**
 * Plain-language explanations of the terms ECDAT Atlas uses, shown in the ⓘ
 * hints across the app. Each one says what the thing is, then how to read it.
 * Written for someone who is not a cryptographer.
 */
export const GLOSSARY = {
  asset:
    "Anything cryptographic we found: an algorithm in code, a key, a certificate, a protocol setting or a crypto library.",
  quantumReadiness:
    "How ready your cryptography is for quantum computers, from 0 to 10. It averages how safe each algorithm, key and certificate is. 10 means everything already uses quantum-safe methods.",
  quantumSafe:
    "Quantum-safe means a large quantum computer still couldn't break it. Most of today's public-key cryptography (RSA, elliptic curves) is not quantum-safe.",
  crsf: "Risk score from 0 to 100. It combines how weak the algorithm is, how widely it's used and how sensitive the repository is. 70 or more needs action now; below 20 is fine.",
  cis: "Crypto Integrity Score: the opposite of the risk score (100 minus risk). Higher is better.",
  pqcScore:
    "Post-quantum safety from 0 to 10. 0 means a quantum computer breaks it outright; 10 means it's already a post-quantum standard.",
  mosca:
    "Mosca's rule: if your data must stay secret for X years, and moving to new cryptography takes Y years, you must start before a quantum computer arrives in Z years. When X + Y is more than Z, you're already late.",
  crqc: "A cryptographically relevant quantum computer: one big enough to break RSA and elliptic-curve cryptography. Estimates put it roughly 7 to 15 years away.",
  harvestNow:
    "Harvest now, decrypt later: attackers can record encrypted traffic today and read it once a quantum computer exists. Long-lived secrets are at risk before that day.",
  vulnerable: "Share of assets with a risk score above zero, meaning there is at least one reason to review them.",
  highRisk: "Assets with a risk score of 70 or more. These are the ones to fix first.",
  severity:
    "How serious a finding is if left alone. Critical and High need action soon; Moderate should be planned; Low is worth knowing about.",
  finding:
    "A specific problem we found, such as a weak algorithm, an expired certificate or a key stored in the code. Each finding points to the file it came from.",
  recommendation:
    "A suggested replacement: what to move from, what to move to, the standard behind it and roughly how much work it is.",
  effort:
    "Roughly how much work a change is. Low is a setting or a drop-in library swap; High means redesigning part of the system.",
  cbom: "Cryptography Bill of Materials: a standard list (CycloneDX 1.6) of every cryptographic asset in a system. Auditors and other tools can read it.",
  scan: "One pass over a repository's code, or over an AWS account, looking for cryptography.",
  criticality:
    "How important the repository is to the business. More critical repositories raise the risk score of what's found in them.",
  dataLifetime:
    "How many years the data this system protects must stay secret. Longer lifetimes mean quantum risk arrives sooner.",
  trigger:
    "What started the scan: Initial when the repository was connected, Push after new code arrived, Manual when someone pressed Scan now.",
  keyLength:
    "Key size in bits. Bigger is stronger against today's computers, but a bigger RSA or elliptic-curve key does not make it quantum-safe.",
  diff: "What changed since the previous scan: assets and findings that appeared, disappeared or stayed the same.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
