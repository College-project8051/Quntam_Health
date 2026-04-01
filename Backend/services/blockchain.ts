import { storage } from "../storage";
import { randomUUID } from "crypto";

export interface BlockchainEntry {
  userId: string;
  documentId?: string;
  action: string;
  details?: any;
  quantumStatus: string;
}

export class BlockchainService {
  // Simulate blockchain block creation
  private generateBlockHash(data: string, previousHash: string): string {
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
  async addBlock(entry: BlockchainEntry): Promise<void> {
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
    
    await storage.logAccess({
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
  async logDocumentUpload(userId: string, documentId: string, fileName: string): Promise<void> {
    await this.addBlock({
      userId,
      documentId,
      action: 'upload',
      details: { fileName },
      quantumStatus: 'secured',
    });
  }

  // Log document access to blockchain
  async logDocumentView(userId: string, documentId: string, documentName: string): Promise<void> {
    await this.addBlock({
      userId,
      documentId,
      action: 'view',
      details: { documentName },
      quantumStatus: 'secured',
    });
  }

  // Log access grant to blockchain
  async logAccessGrant(granterId: string, granteeId: string, documentId: string): Promise<void> {
    await this.addBlock({
      userId: granterId,
      documentId,
      action: 'grant',
      details: { grantedTo: granteeId },
      quantumStatus: 'secured',
    });
  }

  // Log access revocation to blockchain
  async logAccessRevoke(granterId: string, granteeId: string, documentId: string): Promise<void> {
    await this.addBlock({
      userId: granterId,
      documentId,
      action: 'revoke',
      details: { revokedFrom: granteeId },
      quantumStatus: 'secured',
    });
  }

  // Verify blockchain integrity
  async verifyBlockchainIntegrity(): Promise<boolean> {
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
  async getBlockchainStats(): Promise<{
    totalBlocks: number;
    integrityStatus: boolean;
    lastBlockTime: Date | null;
  }> {
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

export const blockchainService = new BlockchainService();
