package com.acmebank.core.disputes;

import java.security.MessageDigest;

/** Hashes card-dispute case attachments for the evidence chain of custody. */
public class DisputeCaseHasher {

    public byte[] attachmentHash(byte[] attachment) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(attachment);
    }

    public byte[] caseHash(byte[] caseData) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        return digest.digest(caseData);
    }
}
