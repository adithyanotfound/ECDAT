// Critical-path signing (settlement receipts) uses ML-DSA-65 directly —
// Ed25519 in sign.go stays for interop with clients that haven't migrated
// yet, per the hybrid-transition pattern FIPS 204 recommends.
package tlsconfig

import (
	"github.com/cloudflare/circl/sign/dilithium"
)

func NewSettlementSigningKeypair() (dilithium.PublicKey, dilithium.PrivateKey) {
	mode := dilithium.Mode3 // NIST security category 3, ~ML-DSA-65
	return mode.GenerateKey(nil)
}
