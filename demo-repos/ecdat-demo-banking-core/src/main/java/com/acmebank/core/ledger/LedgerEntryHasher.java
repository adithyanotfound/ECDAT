package com.acmebank.core.ledger;

import java.security.MessageDigest;

/** Computes tamper-evidence hashes for double-entry ledger rows. */
public class LedgerEntryHasher {

    public byte[] entryHash(byte[] entry) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        return digest.digest(entry);
    }

    public byte[] chainHash(byte[] previousHash, byte[] entry) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        digest.update(previousHash);
        return digest.digest(entry);
    }
}
