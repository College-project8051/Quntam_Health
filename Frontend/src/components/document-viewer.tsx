import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileImage, Brain, Zap, FileText, ExternalLink, AlertCircle, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { User } from "@/App";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  documentType: string;
  uploadedAt: string;
  ownerName?: string;
  ownerGeneratedId?: string;
}

interface DocumentViewerProps {
  user: User;
  documents: Document[];
}

interface AccessDeniedModalProps {
  open: boolean;
  onClose: () => void;
}

function AccessDeniedModal({ open, onClose }: AccessDeniedModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-center">Access Denied</DialogTitle>
          <DialogDescription className="text-center">
            You don't have permission to view this document. Please request access from the patient.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Button onClick={onClose} data-testid="button-close-access-denied">
            Understood
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentName: string;
  isDeleting: boolean;
}

function DeleteConfirmModal({ open, onClose, onConfirm, documentName, isDeleting }: DeleteConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-center">Delete Document</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to delete <strong>"{documentName}"</strong>? This action cannot be undone and will also remove all access permissions granted to doctors.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getDocumentIcon(documentType: string) {
  switch (documentType) {
    case 'x-ray':
      return <FileImage className="h-6 w-6 text-blue-600" />;
    case 'ct-scan':
      return <Zap className="h-6 w-6 text-green-600" />;
    case 'mri':
      return <Brain className="h-6 w-6 text-purple-600" />;
    default:
      return <FileText className="h-6 w-6 text-gray-600" />;
  }
}

function getDocumentTypeLabel(documentType: string) {
  switch (documentType) {
    case 'x-ray':
      return 'X-Ray Scan';
    case 'ct-scan':
      return 'CT Scan';
    case 'mri':
      return 'MRI Scan';
    case 'lab-report':
      return 'Lab Report';
    case 'prescription':
      return 'Prescription';
    default:
      return 'Medical Document';
  }
}

export default function DocumentViewer({ user, documents }: DocumentViewerProps) {
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/delete`, {
        userId: user.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "The document has been permanently deleted.",
      });
      setDeleteDoc(null);
      // Refresh the documents list
      queryClient.invalidateQueries({ queryKey: ["/api/documents/user", user.id] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete the document.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (doc: { id: string; fileName: string }) => {
    setDeleteDoc({ id: doc.id, name: doc.fileName });
  };

  const handleConfirmDelete = () => {
    if (deleteDoc) {
      deleteDocumentMutation.mutate(deleteDoc.id);
    }
  };

  const viewDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("GET", `/api/documents/${documentId}/view?userId=${user.id}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Accessed",
        description: `${data.fileName} opened successfully. Access logged in blockchain.`,
      });
      
      // Convert base64 to Blob and open in a new tab
      try {
        const base64 = data.data as string;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.fileType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        // Open in new tab; fallback to download if blocked
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          const link = document.createElement('a');
          link.href = url;
          link.download = data.fileName || 'document';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        // Revoke URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        toast({
          title: "Viewer Error",
          description: "Unable to open document. The file has been downloaded instead.",
        });
      }
      
      // TODO: Implement inline viewer modal if needed
    },
    onError: (error) => {
      if (error.message.includes("Access denied") || error.message.includes("403")) {
        setShowAccessDenied(true);
      } else if (error.message.includes("Quantum key compromised")) {
        toast({
          title: "Security Alert",
          description: "Quantum key compromised - document access blocked for security",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Access Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleViewDocument = (documentId: string) => {
    viewDocumentMutation.mutate(documentId);
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No medical documents uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                  {getDocumentIcon(doc.documentType)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {getDocumentTypeLabel(doc.documentType)}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {/* Show patient info for doctors viewing shared documents */}
                  {doc.ownerName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Patient: {doc.ownerName} ({doc.ownerGeneratedId})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewDocument(doc.id)}
                  disabled={viewDocumentMutation.isPending}
                  data-testid={`button-view-document-${doc.id}`}
                  title="View document"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {/* Only show delete button if user is the owner (no ownerName means it's their own document) */}
                {!doc.ownerName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(doc)}
                    disabled={deleteDocumentMutation.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid={`button-delete-document-${doc.id}`}
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AccessDeniedModal
        open={showAccessDenied}
        onClose={() => setShowAccessDenied(false)}
      />

      <DeleteConfirmModal
        open={deleteDoc !== null}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleConfirmDelete}
        documentName={deleteDoc?.name || ""}
        isDeleting={deleteDocumentMutation.isPending}
      />
    </>
  );
}
