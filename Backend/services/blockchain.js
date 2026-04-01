import { storage } from '../storage.js';
import { randomUUID } from 'crypto';

/**
 * Blockchain Service for simulating blockchain-based audit trails
 */
class BlockchainService {
  // Simulate blockchain block creation
  generateBlockHash(data, previousHash) {
    // Simple hash simulation - in real implementation would use SHA-256
    const combined = data + previousHash + Date.now().toString();
    return combined
      .split('')
      .reduce((hash, char) => {
        const charCode = char.charCodeAt(0);
        return ((hash << 5) - hash + charCode) & 0xffffffff;
      }, 0)
      .toString(16)
      .padStart(16, '0')
      .substring(0, 16);
  }

  // Add entry to blockchain
  async addBlock(entry) {
    // Generate block hash for this entry
    const blockData = JSON.stringify({
      userId: entry.userId,
      documentId: entry.documentId,
      action: entry.action,
      details: entry.details,
      timestamp: Date.now()
    });
    
    // Get previous block hash for chaining
    const history = await storage.getAccessHistory(1);
    const previousHash = history[0]?.blockHash || '0000000000000000';
    
    const blockHash = this.generateBlockHash(blockData, previousHash);
    
    // Use our pre-computed hash instead of letting storage regenerate it
    await storage.logAccessWithHash({
      userId: entry.userId,
      documentId: entry.documentId,
      action: entry.action,
      details: entry.details,
      quantumStatus: entry.quantumStatus,
      blockHash,
      previousHash,
    });
  }

  // Log document upload to blockchain
  async logDocumentUpload(userId, documentId, fileName) {
    await this.addBlock({
      userId,
      documentId,
      action: 'upload',
      details: { fileName },
      quantumStatus: 'secured',
    });
  }

  // Log document access to blockchain
  async logDocumentView(userId, documentId, documentName) {
    await this.addBlock({
      userId,
      documentId,
      action: 'view',
      details: { documentName },
      quantumStatus: 'secured',
    });
  }

  // Log access grant to blockchain
  async logAccessGrant(granterId, granteeId, documentId) {
    await this.addBlock({
      userId: granterId,
      documentId,
      action: 'grant',
      details: { grantedTo: granteeId },
      quantumStatus: 'secured',
    });
  }

  // Log access revocation to blockchain
  async logAccessRevoke(granterId, granteeId, documentId) {
    await this.addBlock({
      userId: granterId,
      documentId,
      action: 'revoke',
      details: { revokedFrom: granteeId },
      quantumStatus: 'secured',
    });
  }

  // Verify blockchain integrity
  async verifyBlockchainIntegrity() {
    const history = await storage.getAccessHistory(1000);
    
    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const previous = history[i - 1];
      
      if (current.previousHash !== previous.blockHash) {
        return false; // Blockchain compromised
      }
    }
    
    return true;
  }

  // Get blockchain statistics
  async getBlockchainStats() {
    const history = await storage.getAccessHistory(1);
    const totalHistory = await storage.getAccessHistory(10000);
    const integrityStatus = await this.verifyBlockchainIntegrity();
    
    return {
      totalBlocks: totalHistory.length,
      integrityStatus,
      lastBlockTime: history[0]?.timestamp || null,
    };
  }
}

const blockchainService = new BlockchainService();

export { BlockchainService, blockchainService };