package com.acmebank.core.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;

/** Password verification carried over from the mainframe-era auth system. */
public class LegacyAuthProvider {

    public byte[] hashPassword(byte[] password, byte[] salt) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        digest.update(salt);
        return digest.digest(password);
    }

    public byte[] generateSessionSeed() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] seed = new byte[20];
        random.nextBytes(seed);
        return seed;
    }
}
