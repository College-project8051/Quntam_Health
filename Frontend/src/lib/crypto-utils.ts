// Client-side crypto utilities for demonstration
// Note: In production, all encryption should happen server-side

export interface ClientEncryptionInfo {
  algorithm: string;
  keySize: number;
  quantumProtected: boolean;
}

export const getEncryptionInfo = (): ClientEncryptionInfo => {
  return {
    algorithm: "AES-256-CBC",
    keySize: 256,
    quantumProtected: true,
  };
};

export const generateClientKeyId = (): string => {
  return `CLIENT-${Math.random().toString(36).substring(2, 15)}`;
};

export const validateFileForEncryption = (file: File): boolean => {
  // Validate file type
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/dicom',
    'application/pdf', 'application/dicom'
  ];
  
  const isValidType = allowedTypes.some(type => 
    file.type.includes(type) || file.name.toLowerCase().includes(type.split('/')[1])
  );
  
  // Validate file size (50MB limit)
  const isValidSize = file.size <= 50 * 1024 * 1024;
  
  return isValidType && isValidSize;
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const getDocumentTypeFromFile = (file: File): string => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  if (fileName.includes('xray') || fileName.includes('x-ray')) {
    return 'x-ray';
  }
  
  if (fileName.includes('ct') || fileName.includes('cat')) {
    return 'ct-scan';
  }
  
  if (fileName.includes('mri')) {
    return 'mri';
  }
  
  if (fileName.includes('lab') || fileName.includes('blood') || fileName.includes('test')) {
    return 'lab-report';
  }
  
  if (fileType.includes('pdf')) {
    return 'lab-report';
  }
  
  return 'other';
};
