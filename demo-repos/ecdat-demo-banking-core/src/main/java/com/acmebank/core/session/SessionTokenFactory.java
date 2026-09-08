package com.acmebank.core.session;

import java.security.SecureRandom;
import java.security.MessageDigest;

/** Issues session tokens for the teller-desk internal application. */
public class SessionTokenFactory {

    public byte[] newToken() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] token = new byte[24];
        random.nextBytes(token);
        return token;
    }

    public byte[] tokenChecksum(byte[] token) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(token);
    }
}
