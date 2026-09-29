package com.acmebank.core.fraud;

import java.security.MessageDigest;
import java.security.SecureRandom;

/** Hashes device fingerprints for the fraud-scoring pipeline. */
public class FraudSignalHasher {

    public byte[] deviceFingerprint(byte[] rawSignal) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(rawSignal);
    }

    public byte[] caseReferenceId() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] id = new byte[12];
        random.nextBytes(id);
        return id;
    }
}
