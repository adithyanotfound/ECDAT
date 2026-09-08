// Post-quantum key encapsulation for the gateway's internal service mesh —
// ML-KEM-768 via Cloudflare's CIRCL, ahead of Go's stdlib support landing.
package tlsconfig

import (
	"github.com/cloudflare/circl/kem/mlkem768"
)

func GenerateKEMKeypair() (mlkem768.PublicKey, mlkem768.PrivateKey, error) {
	return mlkem768.GenerateKeyPair(nil)
}
