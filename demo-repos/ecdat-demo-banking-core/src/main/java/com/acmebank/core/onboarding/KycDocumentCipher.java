package com.acmebank.core.onboarding;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Encrypts scanned KYC identity documents before object-store upload. */
public class KycDocumentCipher {

    public byte[] encryptDocument(byte[] scan, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(scan);
    }
}
