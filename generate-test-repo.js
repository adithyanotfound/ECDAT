const fs = require('fs');
const path = require('path');

const repoPath = path.join(__dirname, 'ecdat-test-repo');

if (!fs.existsSync(repoPath)) {
  fs.mkdirSync(repoPath);
}

// 1. Weak Algorithms & Hash functions (JS)
fs.writeFileSync(path.join(repoPath, 'auth.js'), `
const crypto = require('crypto');

function hashPassword(password) {
  // WEAK HASH: MD5
  return crypto.createHash('md5').update(password).digest('hex');
}

function encryptData(data) {
  // WEAK CIPHER: DES
  const cipher = crypto.createCipheriv('des-cbc', Buffer.alloc(8), Buffer.alloc(8));
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}
`);

// 2. Weak Key Sizes & Hardcoded Secrets (Python)
fs.writeFileSync(path.join(repoPath, 'payment.py'), `
from cryptography.hazmat.primitives.asymmetric import rsa

def generate_keys():
    # WEAK KEY SIZE: 1024 is vulnerable
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=1024,
    )
    
    # HARDCODED SECRET
    aws_secret_key = "AKIAIOSFODNN7EXAMPLE"
    
    return private_key
`);

// 3. PQC Readiness (Java)
fs.writeFileSync(path.join(repoPath, 'KeyExchange.java'), `
import javax.crypto.KeyAgreement;

public class KeyExchange {
    public void doExchange() {
        // ECDH is not quantum-safe
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
    }
}
`);

console.log('✅ Created mock repository at:', repoPath);
console.log('\nTo use this with ECDAT Atlas:');
console.log('1. Go to GitHub and create a new empty repository (e.g. "ecdat-test").');
console.log('2. Run these commands in your terminal:');
console.log(`   cd ecdat-test-repo`);
console.log(`   git init`);
console.log(`   git add .`);
console.log(`   git commit -m "Initial commit with vulnerable crypto"`);
console.log(`   git branch -M main`);
console.log(`   git remote add origin https://github.com/YOUR-USERNAME/ecdat-test.git`);
console.log(`   git push -u origin main`);
console.log('\n3. Then, add that repository to ECDAT Atlas and scan it!');
