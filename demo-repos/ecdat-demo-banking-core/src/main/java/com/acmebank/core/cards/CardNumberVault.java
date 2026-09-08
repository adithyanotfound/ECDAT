package com.acmebank.core.cards;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;

/** Legacy PAN vault — pre-dates the tokenization migration. */
public class CardNumberVault {

    public byte[] vaultEncrypt(byte[] pan, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(pan);
    }

    public byte[] checksumPan(byte[] pan) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(pan);
    }
}
