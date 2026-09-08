package com.acmebank.core.security;

import java.io.FileInputStream;
import java.security.KeyStore;

/**
 * Loads the bank's TLS identity from the bundled JKS keystore.
 * ECDAT fixture note: bankcore.jks is a demo-only self-signed keystore
 * (see src/main/resources/bankcore.jks) — the detector can only flag its
 * presence as an encrypted container without the store password.
 */
public class KeystoreProvider {

    private static final String KEYSTORE_PATH = "src/main/resources/bankcore.jks";
    private static final char[] KEYSTORE_PASSWORD = "demoFixtureOnly123".toCharArray();

    public KeyStore loadKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("JKS");
        try (FileInputStream fis = new FileInputStream(KEYSTORE_PATH)) {
            keyStore.load(fis, KEYSTORE_PASSWORD);
        }
        return keyStore;
    }
}
