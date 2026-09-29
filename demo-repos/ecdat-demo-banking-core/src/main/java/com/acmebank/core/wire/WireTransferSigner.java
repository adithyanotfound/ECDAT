package com.acmebank.core.wire;

import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Wire-transfer instruction integrity check — SWIFT gateway bridge. */
public class WireTransferSigner {

    public byte[] instructionDigest(byte[] instruction) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(instruction);
    }

    public byte[] encryptInstruction(byte[] instruction, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "DES"));
        return cipher.doFinal(instruction);
    }
}
