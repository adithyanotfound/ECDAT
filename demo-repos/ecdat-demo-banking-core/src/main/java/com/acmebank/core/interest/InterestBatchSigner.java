package com.acmebank.core.interest;

import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Signs the nightly interest-accrual batch file before core-ledger import. */
public class InterestBatchSigner {

    public byte[] batchDigest(byte[] batch) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(batch);
    }

    public byte[] batchMac(byte[] batch, byte[] keyBytes) throws Exception {
        Mac mac = Mac.getInstance("HmacMD5");
        mac.init(new SecretKeySpec(keyBytes, "HmacMD5"));
        return mac.doFinal(batch);
    }
}
