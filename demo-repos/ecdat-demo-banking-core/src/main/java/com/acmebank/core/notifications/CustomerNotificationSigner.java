package com.acmebank.core.notifications;

import java.security.MessageDigest;

/** Signs outbound SMS/email notification payloads for the fraud webhook. */
public class CustomerNotificationSigner {

    public byte[] payloadDigest(byte[] payload) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(payload);
    }
}
