package com.acmebank.core.audit;

import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Signs audit log batches before shipping them to the compliance archive. */
public class AuditTrailSigner {

    public byte[] hashBatch(byte[] batch) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(batch);
    }

    public byte[] macBatch(byte[] batch, byte[] keyBytes) throws Exception {
        Mac mac = Mac.getInstance("HmacMD5");
        mac.init(new SecretKeySpec(keyBytes, "HmacMD5"));
        return mac.doFinal(batch);
    }
}
