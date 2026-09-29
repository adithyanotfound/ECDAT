package com.acmebank.core.branch;

import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Authenticates branch teller terminals against the core over a legacy link. */
public class BranchTerminalAuth {

    public byte[] terminalKeyCheck(byte[] challenge, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(challenge);
    }

    public byte[] terminalIdHash(byte[] terminalId) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(terminalId);
    }
}
