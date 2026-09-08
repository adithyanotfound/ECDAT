package com.acmebank.core.crypto;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Card-number encryption carried over from the pre-2015 mainframe migration.
 * ECDAT fixture note: DES/ECB is the single worst planted artefact in this
 * demo set on purpose — this is the "Critical, worst-case" repo.
 */
public class LegacyCardCipher {

    // Hardcoded key constant — planted secret, never reused elsewhere.
    private static final byte[] LEGACY_KEY = {
        (byte) 0x8F, (byte) 0x2A, (byte) 0x91, (byte) 0x3C,
        (byte) 0x77, (byte) 0x0B, (byte) 0xE4, (byte) 0x56
    };

    public byte[] encryptCardNumber(byte[] plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        SecretKey key = new SecretKeySpec(LEGACY_KEY, "DES");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return cipher.doFinal(plaintext);
    }

    public byte[] fingerprintAccount(byte[] accountNumber) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(accountNumber);
    }

    public byte[] generateTransactionNonce() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] nonce = new byte[16];
        random.nextBytes(nonce);
        return nonce;
    }
}
