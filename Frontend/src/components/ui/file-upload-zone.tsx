import { useCallback } from "react";
import { CloudUpload, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFileSelect: (files: FileList) => void;
  selectedFile?: File | null;
  disabled?: boolean;
  className?: string;
}

export default function FileUploadZone({
  onFileSelect,
  selectedFile,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (disabled) return;
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFileSelect(files);
      }
    },
    [onFileSelect, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.click();
  };

  return (
    <div
      className={cn(
        "upload-zone border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
      data-testid="file-upload-zone"
    >
      <input
        id="file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.dcm,.dicom"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />
      
      {selectedFile ? (
        <div className="space-y-2">
          <File className="h-12 w-12 text-primary mx-auto" />
          <p className="text-foreground font-medium">{selectedFile.name}</p>
          <p className="text-sm text-muted-foreground">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <p className="text-xs text-muted-foreground">Click to select a different file</p>
        </div>
      ) : (
        <div className="space-y-4">
          <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <p className="text-foreground font-medium mb-2">
              Drop medical scans here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports: X-Ray, CT Scan, MRI, Lab Reports (PDF, DICOM, JPG, PNG)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
