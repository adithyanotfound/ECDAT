import type { DashboardAggregates } from "./types";

export const dashboardAggregates: DashboardAggregates = {
  quantumReadinessScore: 5,
  cryptographicAssetsCount: 1290,
  repositoriesScanned: 45,
  vulnerableAssetsPercent: 53,
  highRiskAssets: 47,
  vulnerabilitiesBySource: [
    { source: "Hosts", critical: 10, high: 5, moderate: 5, low: 8 },
    { source: "Network", critical: 10, high: 7, moderate: 2, low: 9 },
    { source: "KMS", critical: 15, high: 7, moderate: 5, low: 5 },
    { source: "Database", critical: 8, high: 5, moderate: 3, low: 5 },
    { source: "Code Repo", critical: 10, high: 2, moderate: 1, low: 5 },
    { source: "File Systems", critical: 5, high: 7, moderate: 5, low: 4 },
    { source: "Database", critical: 10, high: 7, moderate: 2, low: 5 },
  ],
  cryptographicPosture: {
    high: 30,
    medium: 25,
    low: 20,
    compliant: 25,
  },
  assetsByType: [
    { type: "Keys", count: 100 },
    { type: "Certificates", count: 85 },
    { type: "Cipher Suites", count: 50 },
    { type: "Keystores", count: 40 },
    { type: "Protocols", count: 35 },
    { type: "Libraries", count: 28 },
  ],
  symmetricKeyDistribution: [
    { name: "DES-CBC 56", percent: 10 },
    { name: "AES-CBC 256", percent: 19 },
    { name: "Symmetric", percent: 21 },
    { name: "3Key-DES-EDE-CBC 1...", percent: 10 },
    { name: "AES-GCM 128", percent: 15 },
    { name: "Other", percent: 25 },
  ],
  asymmetricKeyDistribution: [
    { name: "RSA 512", percent: 10 },
    { name: "DSA 1024", percent: 19 },
    { name: "RSA 1024", percent: 21 },
    { name: "RSA 2048", percent: 10 },
    { name: "ECDSA P-256", percent: 22 },
    { name: "Other", percent: 18 },
  ],
};
