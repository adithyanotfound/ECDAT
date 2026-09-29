package com.acmebank.core.compliance;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/** Encrypts quarterly compliance exports for the regulator drop box. */
public class ComplianceExportCipher {

    public byte[] encryptExport(byte[] data, byte[] keyBytes) throws Exception {
        Cipher cipher = Cipher.getInstance("Blowfish/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "Blowfish"));
        return cipher.doFinal(data);
    }
}
