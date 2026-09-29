/**
 * Firmware manifest signature check, run on every OTA update before flashing.
 * ECDAT fixture note: SHA-1 firmware manifest hashing, planted per the
 * scenario table — long device lifetime makes this a Mosca ACT_NOW case.
 */
#include "mbedtls/sha1.h"
#include <string.h>
#include <stdint.h>
#include <stddef.h>

int hash_firmware_manifest(const uint8_t *manifest, size_t len, uint8_t out_digest[20]) {
    mbedtls_sha1_context ctx;
    mbedtls_sha1_init(&ctx);
    mbedtls_sha1_starts(&ctx);
    mbedtls_sha1_update(&ctx, manifest, len);
    mbedtls_sha1_finish(&ctx, out_digest);
    mbedtls_sha1_free(&ctx);
    return 0;
}
