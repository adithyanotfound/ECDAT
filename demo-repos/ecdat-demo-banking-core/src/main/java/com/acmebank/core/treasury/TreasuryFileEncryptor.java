package com.acmebank.core.treasury;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;

/** Encrypts treasury position files exchanged with the central bank gateway. */
public class TreasuryFileEncryptor {

    public byte[] encryptPositionFile(byte[] file, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(file);
    }

    public byte[] positionFileDigest(byte[] file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(file);
    }
}
