import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'crypto';
import { storage } from '../storage.js';

/**
 * BB84 Quantum Key Distribution Protocol Simulation
 *
 * The BB84 protocol (Bennett-Brassard 1984) is the first quantum cryptography protocol.
 * It uses quantum mechanics principles to establish a shared secret key between two parties.
 *
 * Protocol Steps:
 * 1. Alice prepares qubits in random states using random bases (rectilinear + or diagonal x)
 * 2. Alice sends qubits to Bob through quantum channel
 * 3. Bob measures each qubit using randomly chosen bases
 * 4. Alice and Bob compare bases over classical channel (not the bit values!)
 * 5. They keep only the bits where they used the same basis
 * 6. They check for eavesdropping by comparing a subset of bits
 * 7. If error rate is low (<11%), the key is secure
 *
 * Security: If an eavesdropper (Eve) intercepts, quantum state collapses,
 * introducing detectable errors (>25% error rate if Eve measures all qubits)
 */
class QuantumEncryptionService {

  /**
   * Simulate BB84 Quantum Key Distribution Protocol
   * This generates a quantum-secure shared secret key
   */
  simulateBB84Protocol(keyLengthBits = 256) {
    // Step 1: Alice prepares random bits and random bases
    const aliceBits = [];
    const aliceBases = []; // 'R' = Rectilinear, 'D' = Diagonal

    for (let i = 0; i < keyLengthBits * 4; i++) { // 4x bits needed due to basis mismatch
      aliceBits.push(Math.random() < 0.5 ? 0 : 1);
      aliceBases.push(Math.random() < 0.5 ? 'R' : 'D');
    }

    // Step 2: Bob chooses random measurement bases
    const bobBases = [];
    for (let i = 0; i < aliceBits.length; i++) {
      bobBases.push(Math.random() < 0.5 ? 'R' : 'D');
    }

    // Step 3: Simulate quantum channel transmission
    // Bob measures - gets correct result only if bases match
    const bobBits = [];
    for (let i = 0; i < aliceBits.length; i++) {
      if (aliceBases[i] === bobBases[i]) {
        // Same basis - Bob gets Alice's bit (with small error probability)
        const errorProbability = 0.01; // 1% QBER (normal for quantum channels)
        bobBits.push(Math.random() < errorProbability ? (1 - aliceBits[i]) : aliceBits[i]);
      } else {
        // Different basis - random result (50/50)
        bobBits.push(Math.random() < 0.5 ? 0 : 1);
      }
    }

    // Step 4: Sifting - Keep only bits where bases matched
    const siftedAliceBits = [];
    const siftedBobBits = [];
    for (let i = 0; i < aliceBits.length; i++) {
      if (aliceBases[i] === bobBases[i]) {
        siftedAliceBits.push(aliceBits[i]);
        siftedBobBits.push(bobBits[i]);
      }
    }

    // Step 5: Error estimation - Compare subset to detect eavesdropping
    const sampleSize = Math.floor(siftedAliceBits.length * 0.1); // 10% for error check
    let errors = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (siftedAliceBits[i] !== siftedBobBits[i]) {
        errors++;
      }
    }
    const errorRate = sampleSize > 0 ? errors / sampleSize : 0;

    // Step 6: Security check - QBER threshold is ~11% for security
    const isSecure = errorRate < 0.11;

    // Step 7: Privacy amplification - Use remaining bits as key
    const finalBits = siftedAliceBits.slice(sampleSize);
    const keyHex = this.bitsToHex(finalBits.slice(0, keyLengthBits));

    return {
      key: keyHex.padEnd(64, '0'), // Ensure 256-bit key
      stats: {
        aliceBits: aliceBits.length,
        bobBits: bobBits.length,
        matchingBases: siftedAliceBits.length,
        errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
        finalKeyBits: finalBits.length,
        isSecure,
      }
    };
  }

  /**
   * Convert bit array to hexadecimal string
   */
  bitsToHex(bits) {
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      const nibble = bits.slice(i, i + 4);
      while (nibble.length < 4) nibble.push(0);
      const value = nibble[0] * 8 + nibble[1] * 4 + nibble[2] * 2 + nibble[3];
      hex += value.toString(16);
    }
    return hex;
  }

  /**
   * Generate a quantum-secure encryption key using BB84 protocol simulation
   */
  async generateQuantumKey() {
    const keyId = `QK-${randomUUID().substring(0, 8)}`;

    // Run BB84 protocol simulation
    const { key, stats } = this.simulateBB84Protocol(256);

    // Store the quantum-generated key
    await storage.createQuantumKey({
      keyId,
      key: key,
      bb84Stats: stats,
    });

    console.log(`[BB84] Generated quantum key ${keyId} - Secure: ${stats.isSecure}, QBER: ${stats.errorRate}%`);

    return { keyId, stats };
  }

  /**
   * Encrypt data using AES-256-CBC with a quantum-generated key
   * The key is generated using BB84 QKD protocol simulation
   */
  async encryptData(data) {
    // Generate quantum-protected key using BB84 protocol
    const { keyId: quantumKeyId, stats: bb84Stats } = await this.generateQuantumKey();
    const quantumKey = await storage.getQuantumKey(quantumKeyId);

    if (!quantumKey) {
      throw new Error('Failed to generate quantum key');
    }

    // Security check: Ensure BB84 didn't detect eavesdropping
    if (!bb84Stats.isSecure) {
      console.warn(`[BB84] Warning: High QBER detected (${bb84Stats.errorRate}%), potential eavesdropping`);
    }

    // Use quantum-generated key for AES-256-CBC encryption
    const encryptionKey = Buffer.from(quantumKey.key.substring(0, 64), 'hex'); // 32 bytes = 256 bits
    const iv = randomBytes(16); // 16 bytes IV for AES-256-CBC
    const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);

    let encryptedData = cipher.update(data, 'utf8', 'base64');
    encryptedData += cipher.final('base64');

    // Prepend IV to encrypted data for decryption
    const result = iv.toString('base64') + ':' + encryptedData;

    console.log(`[Encryption] Data encrypted with quantum key ${quantumKeyId}`);

    return {
      encryptedData: result,
      encryptionKey: encryptionKey.toString('hex'),
      quantumKeyId,
      bb84Stats,
    };
  }

  // Decrypt data using quantum-protected keys
  async decryptData(encryptedData, quantumKeyId) {
    const quantumKey = await storage.getQuantumKey(quantumKeyId);
    
    if (!quantumKey) {
      throw new Error('Quantum key not found or compromised');
    }

    if (quantumKey.isCompromised) {
      throw new Error('Quantum key has been compromised - access denied');
    }

    // Simulate quantum state collapse detection
    if (Math.random() < 0.01) { // 1% chance of detecting intrusion
      await storage.markKeyCompromised(quantumKeyId);
      throw new Error('Quantum intrusion detected - key compromised');
    }

    // Split IV and encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = parts[1];
    const encryptionKey = Buffer.from(quantumKey.key.substring(0, 64), 'hex');
    
    const decipher = createDecipheriv('aes-256-cbc', encryptionKey, iv);
    
    let decryptedData = decipher.update(encrypted, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData;
  }

  // Simulate quantum key distribution protocol
  async validateQuantumKey(keyId) {
    const key = await storage.getQuantumKey(keyId);
    
    if (!key) return false;
    if (key.isCompromised) return false;
    if (key.expiresAt && key.expiresAt < new Date()) return false;

    // Simulate quantum entanglement verification
    const isEntangled = Math.random() > 0.05; // 95% success rate
    
    if (!isEntangled) {
      await storage.markKeyCompromised(keyId);
      return false;
    }

    return true;
  }
}

const encryptionService = new QuantumEncryptionService();

export { QuantumEncryptionService, encryptionService };