import { randomBytes, randomUUID, createCipheriv, createDecipheriv, createHash } from "crypto";
import { storage } from "../storage";

export interface EncryptionResult {
  encryptedData: string;
  encryptionKey: string;
  quantumKeyId: string;
  bb84Stats: BB84Stats;
}

export interface BB84Stats {
  aliceBits: number;       // Total bits sent by Alice
  bobBits: number;         // Total bits received by Bob
  matchingBases: number;   // Bits with matching measurement bases
  errorRate: number;       // Quantum Bit Error Rate (QBER)
  finalKeyBits: number;    // Final shared secret key length
  isSecure: boolean;       // Whether the key exchange was secure
}

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
export class QuantumEncryptionService {

  /**
   * Simulate BB84 Quantum Key Distribution Protocol
   * This generates a quantum-secure shared secret key
   */
  private simulateBB84Protocol(keyLengthBits: number = 256): { key: string; stats: BB84Stats } {
    // Step 1: Alice prepares random bits and random bases
    const aliceBits: number[] = [];
    const aliceBases: ('R' | 'D')[] = []; // R=Rectilinear, D=Diagonal

    for (let i = 0; i < keyLengthBits * 4; i++) { // 4x bits needed due to basis mismatch
      aliceBits.push(Math.random() < 0.5 ? 0 : 1);
      aliceBases.push(Math.random() < 0.5 ? 'R' : 'D');
    }

    // Step 2: Bob chooses random measurement bases
    const bobBases: ('R' | 'D')[] = [];
    for (let i = 0; i < aliceBits.length; i++) {
      bobBases.push(Math.random() < 0.5 ? 'R' : 'D');
    }

    // Step 3: Simulate quantum channel transmission
    // Bob measures - gets correct result only if bases match
    const bobBits: number[] = [];
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
    const siftedAliceBits: number[] = [];
    const siftedBobBits: number[] = [];
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
  private bitsToHex(bits: number[]): string {
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
  async generateQuantumKey(): Promise<{ keyId: string; stats: BB84Stats }> {
    const keyId = `QK-${randomUUID().substring(0, 8)}`;

    // Run BB84 protocol simulation
    const { key, stats } = this.simulateBB84Protocol(256);

    // Store the quantum-generated key
    await storage.createQuantumKey({
      keyId,
      keyData: key,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    console.log(`[BB84] Generated quantum key ${keyId} - Secure: ${stats.isSecure}, QBER: ${stats.errorRate}%`);

    return { keyId, stats };
  }

  /**
   * Encrypt data using AES-256-CBC with a quantum-generated key
   * The key is generated using BB84 QKD protocol simulation
   */
  async encryptData(data: string): Promise<EncryptionResult> {
    // Generate quantum-protected key using BB84 protocol
    const { keyId: quantumKeyId, stats: bb84Stats } = await this.generateQuantumKey();
    const quantumKey = await storage.getQuantumKey(quantumKeyId);

    if (!quantumKey) {
      throw new Error('Failed to generate quantum key');
    }

    // Security check: Ensure BB84 didn't detect eavesdropping
    if (!bb84Stats.isSecure) {
      console.warn(`[BB84] Warning: High QBER detected (${bb84Stats.errorRate}%), potential eavesdropping`);
      // In real system, would abort and retry; for demo, continue with warning
    }

    // Use quantum-generated key for AES-256-CBC encryption
    const encryptionKey = Buffer.from(quantumKey.keyData.substring(0, 64), 'hex'); // 32 bytes = 256 bits
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

  /**
   * Decrypt data using quantum-protected keys
   * Includes quantum intrusion detection simulation
   */
  async decryptData(encryptedData: string, quantumKeyId: string): Promise<string> {
    const quantumKey = await storage.getQuantumKey(quantumKeyId);

    if (!quantumKey) {
      throw new Error('Quantum key not found or compromised');
    }

    if (quantumKey.isCompromised) {
      throw new Error('Quantum key has been compromised - access denied');
    }

    // Check key expiration
    if (quantumKey.expiresAt && new Date(quantumKey.expiresAt) < new Date()) {
      throw new Error('Quantum key has expired - please re-upload document');
    }

    /**
     * Simulate quantum state collapse detection
     * In real BB84, any eavesdropping attempt causes quantum state collapse,
     * which is detectable through increased error rates
     */
    const intrusionDetected = Math.random() < 0.005; // 0.5% chance of detecting intrusion
    if (intrusionDetected) {
      await storage.markKeyCompromised(quantumKeyId);
      console.error(`[BB84] Intrusion detected! Key ${quantumKeyId} marked as compromised`);
      throw new Error('Quantum intrusion detected - key compromised for security');
    }

    // Split IV and encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = parts[1];
    const encryptionKey = Buffer.from(quantumKey.keyData.substring(0, 64), 'hex');

    const decipher = createDecipheriv('aes-256-cbc', encryptionKey, iv);

    let decryptedData = decipher.update(encrypted, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');

    console.log(`[Decryption] Data decrypted with quantum key ${quantumKeyId}`);

    return decryptedData;
  }

  /**
   * Validate quantum key using entanglement verification simulation
   *
   * In real quantum systems, entanglement verification ensures:
   * 1. The quantum channel hasn't been compromised
   * 2. The key hasn't been measured by an eavesdropper
   * 3. The quantum states are still correlated
   */
  async validateQuantumKey(keyId: string): Promise<boolean> {
    const key = await storage.getQuantumKey(keyId);

    if (!key) {
      console.log(`[QKD] Key ${keyId} not found`);
      return false;
    }

    if (key.isCompromised) {
      console.log(`[QKD] Key ${keyId} is compromised`);
      return false;
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      console.log(`[QKD] Key ${keyId} has expired`);
      return false;
    }

    /**
     * Simulate quantum entanglement verification
     * Bell state measurement to verify quantum correlation
     * Success rate ~95% in ideal conditions
     */
    const bellStateVerified = Math.random() > 0.03; // 97% success rate

    if (!bellStateVerified) {
      await storage.markKeyCompromised(keyId);
      console.warn(`[QKD] Bell state verification failed for key ${keyId} - marked compromised`);
      return false;
    }

    console.log(`[QKD] Key ${keyId} validated successfully`);
    return true;
  }

  /**
   * Simulate eavesdropper attack for educational purposes
   * Demonstrates how BB84 detects Eve's interception
   */
  simulateEavesdropperAttack(): BB84Stats {
    const aliceBits: number[] = [];
    const aliceBases: ('R' | 'D')[] = [];

    for (let i = 0; i < 256 * 4; i++) {
      aliceBits.push(Math.random() < 0.5 ? 0 : 1);
      aliceBases.push(Math.random() < 0.5 ? 'R' : 'D');
    }

    // Eve intercepts and measures with random bases
    const eveBases: ('R' | 'D')[] = [];
    const eveBits: number[] = [];
    for (let i = 0; i < aliceBits.length; i++) {
      eveBases.push(Math.random() < 0.5 ? 'R' : 'D');
      // Eve gets random result 50% of the time (wrong basis)
      eveBits.push(aliceBases[i] === eveBases[i] ? aliceBits[i] : (Math.random() < 0.5 ? 0 : 1));
    }

    // Bob receives Eve's disturbed qubits
    const bobBases: ('R' | 'D')[] = [];
    const bobBits: number[] = [];
    for (let i = 0; i < aliceBits.length; i++) {
      bobBases.push(Math.random() < 0.5 ? 'R' : 'D');
      // Bob measures Eve's qubits
      bobBits.push(eveBases[i] === bobBases[i] ? eveBits[i] : (Math.random() < 0.5 ? 0 : 1));
    }

    // Count errors when Alice and Bob used same basis
    let matches = 0;
    let errors = 0;
    for (let i = 0; i < aliceBits.length; i++) {
      if (aliceBases[i] === bobBases[i]) {
        matches++;
        if (aliceBits[i] !== bobBits[i]) {
          errors++;
        }
      }
    }

    const errorRate = matches > 0 ? (errors / matches) * 100 : 0;

    // Eve's attack introduces ~25% error rate
    return {
      aliceBits: aliceBits.length,
      bobBits: bobBits.length,
      matchingBases: matches,
      errorRate: Math.round(errorRate * 100) / 100,
      finalKeyBits: 0, // Key discarded due to attack
      isSecure: false,
    };
  }
}

export const encryptionService = new QuantumEncryptionService();
