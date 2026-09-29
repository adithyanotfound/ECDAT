import express from "express";
import https from "https";
import { readFileSync } from "fs";
import { join } from "path";
import { tokenizeCard } from "./crypto/cardTokenizer";
import { deriveIdempotencyKey } from "./crypto/idempotency";
import { issueSessionToken } from "./auth/tokens";
import { hashPassword } from "./auth/passwords";

const app = express();
app.use(express.json());

app.post("/v1/payment-intents", async (req, res) => {
  const key = deriveIdempotencyKey(req.body.merchantId, JSON.stringify(req.body));
  const token = tokenizeCard(req.body.pan);
  res.json({ idempotencyKey: key, tokenizedPan: token });
});

app.post("/v1/sessions", async (req, res) => {
  const passwordHash = await hashPassword(req.body.password);
  const sessionToken = issueSessionToken(req.body.userId);
  res.json({ passwordHash, sessionToken });
});

// TLS server cert — self-signed demo fixture, see certs/server.crt
const tlsOptions = {
  key: readFileSync(join(__dirname, "../keys/rsa_private.pem")),
  cert: readFileSync(join(__dirname, "../certs/server.crt")),
};

https.createServer(tlsOptions, app).listen(8443, () => {
  console.log("ecdat-demo-payments-api listening on https://localhost:8443");
});
