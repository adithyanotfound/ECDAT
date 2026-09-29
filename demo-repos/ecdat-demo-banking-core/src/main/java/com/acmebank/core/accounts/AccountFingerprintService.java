package com.acmebank.core.accounts;

import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Derives account fingerprints and encrypts account numbers for archival. */
public class AccountFingerprintService {

    public byte[] fingerprint(byte[] accountNumber) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(accountNumber);
    }

    public byte[] archiveEncrypt(byte[] data, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("Blowfish/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "Blowfish"));
        return cipher.doFinal(data);
    }
}
