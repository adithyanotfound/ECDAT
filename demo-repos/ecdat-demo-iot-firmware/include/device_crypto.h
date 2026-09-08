#ifndef DEVICE_CRYPTO_H
#define DEVICE_CRYPTO_H

#include <stddef.h>
#include <stdint.h>

void xor_obfuscate(uint8_t *data, size_t len);
void device_encrypt_telemetry(const uint8_t *plaintext, size_t len, uint8_t *out);
int device_verify_manifest(const uint8_t *manifest, size_t len, const uint8_t *signature);

#endif /* DEVICE_CRYPTO_H */
