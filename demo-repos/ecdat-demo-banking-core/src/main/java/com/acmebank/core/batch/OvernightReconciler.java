package com.acmebank.core.batch;

import java.security.MessageDigest;
import java.security.SecureRandom;

/** Reconciles the overnight settlement batch against the clearing house feed. */
public class OvernightReconciler {

    public byte[] recordHash(byte[] record) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(record);
    }

    public byte[] batchToken() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] token = new byte[16];
        random.nextBytes(token);
        return token;
    }
}
