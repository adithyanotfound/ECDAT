// Request-signing for service-to-service calls — Ed25519, with ML-DSA-65
// planned as the PQC upgrade path once client libraries stabilise.
package tlsconfig

import (
	"github.com/cloudflare/circl/sign/ed25519"
)

func NewSigningKeypair() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	pub, priv, err := ed25519.GenerateKey(nil)
	return pub, priv, err
}
