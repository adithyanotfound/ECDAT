package com.acmebank.core.statements;

import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Archives monthly statement PDFs to cold storage. */
public class StatementArchiver {

    public byte[] archiveChecksum(byte[] pdf) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(pdf);
    }

    public byte[] encryptForArchive(byte[] pdf, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("Blowfish/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "Blowfish"));
        return cipher.doFinal(pdf);
    }
}
