cmake_minimum_required(VERSION 3.16)
project(ecdat_demo_iot_firmware C)

set(CMAKE_C_STANDARD 99)

# mbedTLS — pinned to the vendored copy under third_party/, never updated
# since the board's original 2018 SDK drop.
find_path(MBEDTLS_INCLUDE_DIR mbedtls/ssl.h)

add_executable(firmware
    src/main.c
    src/device_crypto.c
    src/manifest_verify.c
)

target_include_directories(firmware PRIVATE include ${MBEDTLS_INCLUDE_DIR})
target_link_libraries(firmware mbedtls mbedcrypto mbedx509)
