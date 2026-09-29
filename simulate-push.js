const crypto = require("crypto");

// Using the exact secret from your .env
const WEBHOOK_SECRET = "b5279ee69f83c1efec1fa5d32ccd82d7c1c91353";

const payload = {
  ref: "refs/heads/main",
  after: "8fa90b9abcdef1234567890abcdef123456789", // fake commit sha
  repository: {
    id: 1390373281, // matches your Mock-repo
    full_name: "HarshitJain2103/Mock-repo",
    name: "Mock-repo",
    owner: { login: "HarshitJain2103" }
  },
  // We omit installation.id so it falls back to the manual repo logic we just built!
};

const rawBody = JSON.stringify(payload);

// GitHub uses HMAC-SHA256 to sign payloads
const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
const signature = "sha256=" + hmac.update(rawBody).digest("hex");

// Unique delivery ID
const deliveryId = crypto.randomUUID();

fetch("http://localhost:3000/api/github/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-github-event": "push",
    "x-github-delivery": deliveryId,
    "x-hub-signature-256": signature,
    "User-Agent": "GitHub-Hookshot/760256b"
  },
  body: rawBody
})
.then(async res => {
  if (res.ok) {
    console.log("✅ Webhook delivered successfully! (Status 202)");
    console.log("👉 Check your ECDAT Atlas UI to watch the scan start automatically.");
  } else {
    console.error("❌ Failed:", res.status, await res.text());
  }
})
.catch(err => console.error("Error:", err));
