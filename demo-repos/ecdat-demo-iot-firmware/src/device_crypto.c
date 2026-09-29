/**
 * Device-side telemetry obfuscation and manifest signing helpers.
 *
 * ECDAT fixture note: xor_obfuscate() is a hand-rolled "encryption" scheme —
 * XOR against a static key is not encryption at all, planted deliberately
 * as the single worst artefact in this repository alongside the hardcoded
 * AES-128 key below.
 */
#include "device_crypto.h"
#include "mbedtls/aes.h"
#include "mbedtls/sha1.h"
#include <string.h>

/* Hardcoded AES-128 key — committed to source, never rotated. */
static const unsigned char aes_key[16] = {
    0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
    0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
};

void xor_obfuscate(uint8_t *data, size_t len) {
    static const uint8_t obf_key = 0x5A;
    for (size_t i = 0; i < len; i++) {
        data[i] ^= obf_key;
    }
}

void device_encrypt_telemetry(const uint8_t *plaintext, size_t len, uint8_t *out) {
    mbedtls_aes_context ctx;
    mbedtls_aes_setkey_enc(&ctx, aes_key, 128);
    for (size_t offset = 0; offset + 16 <= len; offset += 16) {
        mbedtls_aes_crypt_ecb(&ctx, MBEDTLS_AES_ENCRYPT, plaintext + offset, out + offset);
    }
}

int device_verify_manifest(const uint8_t *manifest, size_t len, const uint8_t *signature) {
    unsigned char digest[20];
    mbedtls_sha1(manifest, len, digest);
    return memcmp(digest, signature, sizeof(digest)) == 0;
}
