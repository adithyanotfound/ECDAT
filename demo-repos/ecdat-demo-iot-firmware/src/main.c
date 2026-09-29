/**
 * Sensor firmware entry point — reads telemetry, obfuscates it, ships it
 * over a TLS connection floored at TLS 1.0 for compatibility with the
 * original 2018 gateway hardware.
 */
#include "device_crypto.h"
#include "mbedtls/ssl.h"
#include <stdint.h>
#include <stddef.h>

/* Compatibility floor for legacy field gateways — never revisited. */
#define DEVICE_MIN_TLS_VERSION MBEDTLS_SSL_MINOR_VERSION_1

static void configure_tls(mbedtls_ssl_config *conf) {
    mbedtls_ssl_conf_min_version(conf, MBEDTLS_SSL_MAJOR_VERSION_3, DEVICE_MIN_TLS_VERSION);
}

int main(void) {
    uint8_t telemetry[64] = {0};
    uint8_t encrypted[64] = {0};

    device_encrypt_telemetry(telemetry, sizeof(telemetry), encrypted);
    xor_obfuscate(encrypted, sizeof(encrypted));

    mbedtls_ssl_config conf;
    configure_tls(&conf);

    return 0;
}
