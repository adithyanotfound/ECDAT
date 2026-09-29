// Command gateway starts the TLS 1.3-floor API gateway.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"log"
	"net/http"

	"github.com/acme-corp/ecdat-demo-pqc-gateway/internal/tlsconfig"
)

func newDataPlaneCipher(key [32]byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func main() {
	cfg := tlsconfig.NewGatewayConfig()

	server := &http.Server{
		Addr:      ":8443",
		TLSConfig: cfg,
	}

	log.Println("ecdat-demo-pqc-gateway listening on :8443 (TLS 1.3, hybrid PQC KEX)")
	log.Fatal(server.ListenAndServeTLS("", ""))
}
