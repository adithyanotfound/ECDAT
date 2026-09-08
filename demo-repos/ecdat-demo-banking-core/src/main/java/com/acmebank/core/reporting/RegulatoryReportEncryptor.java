package com.acmebank.core.reporting;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;

/** Encrypts nightly regulatory extracts before SFTP delivery. */
public class RegulatoryReportEncryptor {

    public byte[] encryptExtract(byte[] extract, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(extract);
    }

    public byte[] extractDigest(byte[] extract) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(extract);
    }
}
