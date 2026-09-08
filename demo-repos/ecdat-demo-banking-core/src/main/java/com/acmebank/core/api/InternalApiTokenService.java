package com.acmebank.core.api;

import java.security.SecureRandom;
import java.security.MessageDigest;

/** Issues bearer tokens for internal service-to-service API calls. */
public class InternalApiTokenService {

    public byte[] issueToken() throws Exception {
        SecureRandom random = SecureRandom.getInstance("SHA1PRNG");
        byte[] token = new byte[24];
        random.nextBytes(token);
        return token;
    }

    public byte[] tokenHash(byte[] token) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(token);
    }
}
