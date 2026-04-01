import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CloudUpload, Plus, Lock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/App";
import FileUploadZone from "@/components/ui/file-upload-zone";

interface FileUploadProps {
  user: User;
}

export default function FileUpload({ user }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is a doctor - doctors cannot upload
  const isDoctor = user.userType === "doctor";

  // Debug log to check user type
  console.log("[FileUpload] User:", user.name, "Type:", user.userType, "isDoctor:", isDoctor);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("documentType", documentType);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const securityInfo = data.security
        ? `\nEncryption: ${data.security.algorithm}\nKey Exchange: ${data.security.keyExchange}\nQBER: ${data.security.qber}`
        : "";
      toast({
        title: "Upload Successful - Quantum Secured",
        description: `Document encrypted with Quantum Key: ${data.quantumKeyId}${securityInfo}`,
      });
      setSelectedFile(null);
      setDocumentType("");
      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/documents/user", user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/history"] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (files: FileList) => {
    if (files.length > 0) {
      const file = files[0];
      
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/dicom',
        'application/pdf', 'application/dicom'
      ];
      
      if (!allowedTypes.some(type => file.type.includes(type) || file.name.toLowerCase().includes(type))) {
        toast({
          title: "Invalid File Type",
          description: "Please upload X-Ray, CT Scan, MRI, or Lab Report files (PDF, DICOM, JPG, PNG)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 50MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !documentType) {
      toast({
        title: "Validation Error",
        description: "Please select a file and document type",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, documentType });
  };

  // If doctor, show message that only patients can upload
  if (isDoctor) {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium mb-2">
            Document Upload Not Available
          </p>
          <p className="text-sm text-muted-foreground">
            Only patients can upload medical documents. As a doctor, you can view documents shared with you.
          </p>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center text-sm text-blue-800 dark:text-blue-200">
            <Lock className="h-4 w-4 mr-2" />
            <span>View shared documents in the "View Medical Documents" section</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FileUploadZone
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        disabled={uploadMutation.isPending}
      />
      
      {selectedFile && (
        <div>
          <Label className="block text-sm font-medium text-foreground mb-2">
            Document Type
          </Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger data-testid="select-document-type">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x-ray">X-Ray Scan</SelectItem>
              <SelectItem value="ct-scan">CT Scan</SelectItem>
              <SelectItem value="mri">MRI Scan</SelectItem>
              <SelectItem value="lab-report">Lab Report</SelectItem>
              <SelectItem value="prescription">Prescription</SelectItem>
              <SelectItem value="other">Other Medical Document</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedFile && documentType && (
        <Button
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          className="w-full"
          data-testid="button-upload-document"
        >
          {uploadMutation.isPending ? (
            "Encrypting & Uploading..."
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Upload & Encrypt Document
            </>
          )}
        </Button>
      )}
      
      {/* Encryption Status */}
      <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
        <div className="flex items-center text-sm text-green-800 dark:text-green-200">
          <Lock className="h-4 w-4 mr-2" />
          <span>AES-256 Encryption + Quantum Key Protection Active</span>
        </div>
      </div>
    </div>
  );
}
