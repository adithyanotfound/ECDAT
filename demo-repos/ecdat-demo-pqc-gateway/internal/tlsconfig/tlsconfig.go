// Package tlsconfig builds the gateway's TLS 1.3-floor listener config with
// a hybrid post-quantum key exchange curve preference.
package tlsconfig

import "crypto/tls"

// X25519MLKEM768 — hybrid classical+PQC key exchange (FIPS 203 + RFC 9370).
// Go 1.23+ exposes this as a tls.CurveID constant; referenced here by name
// for gateways still cross-building against 1.22 via the x/crypto shim.
const X25519MLKEM768 tls.CurveID = 0x11ec

func NewGatewayConfig() *tls.Config {
	return &tls.Config{
		MinVersion:       tls.VersionTLS13,
		CurvePreferences: []tls.CurveID{X25519MLKEM768, tls.X25519},
	}
}
