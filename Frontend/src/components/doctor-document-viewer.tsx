import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileImage,
  Brain,
  Zap,
  FileText,
  ExternalLink,
  AlertCircle,
  MessageSquarePlus,
  Send,
  Stethoscope,
  Pill,
  Calendar,
  X,
  CheckCircle,
  User,
  Mail,
  Loader2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User as UserType } from "@/App";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  documentType: string;
  uploadedAt: string;
  ownerName?: string;
  ownerGeneratedId?: string;
}

interface DoctorDocumentViewerProps {
  user: UserType;
  documents: Document[];
}

interface SuggestionFormData {
  diagnosis: string;
  suggestion: string;
  prescription: string;
  followUpDate: string;
  priority: "low" | "medium" | "high" | "critical";
}

function getDocumentIcon(documentType: string) {
  switch (documentType) {
    case "x-ray":
      return <FileImage className="h-6 w-6 text-blue-600" />;
    case "ct-scan":
      return <Zap className="h-6 w-6 text-green-600" />;
    case "mri":
      return <Brain className="h-6 w-6 text-purple-600" />;
    default:
      return <FileText className="h-6 w-6 text-gray-600" />;
  }
}

function getDocumentTypeLabel(documentType: string) {
  switch (documentType) {
    case "x-ray":
      return "X-Ray Scan";
    case "ct-scan":
      return "CT Scan";
    case "mri":
      return "MRI Scan";
    case "lab-report":
      return "Lab Report";
    case "prescription":
      return "Prescription";
    default:
      return "Medical Document";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "bg-red-500 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-yellow-500 text-black";
    case "low":
      return "bg-green-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

export default function DoctorDocumentViewer({ user, documents }: DoctorDocumentViewerProps) {
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastCreatedSuggestionId, setLastCreatedSuggestionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SuggestionFormData>({
    diagnosis: "",
    suggestion: "",
    prescription: "",
    followUpDate: "",
    priority: "medium",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing suggestions for selected document
  const { data: existingSuggestions } = useQuery({
    queryKey: ["/api/suggestions/document", selectedDocument?.id],
    queryFn: async () => {
      if (!selectedDocument) return { suggestions: [] };
      const response = await apiRequest(
        "GET",
        `/api/suggestions/document/${selectedDocument.id}?userId=${user.id}`
      );
      return response.json();
    },
    enabled: !!selectedDocument,
  });

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

      try {
        const base64 = data.data as string;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.fileType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          const link = document.createElement("a");
          link.href = url;
          link.download = data.fileName || "document";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        toast({
          title: "Viewer Error",
          description: "Unable to open document. The file has been downloaded instead.",
        });
      }
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

  const createSuggestionMutation = useMutation({
    mutationFn: async (data: { documentId: string } & SuggestionFormData) => {
      const response = await apiRequest("POST", "/api/suggestions", {
        documentId: data.documentId,
        doctorId: user.id,
        diagnosis: data.diagnosis,
        suggestion: data.suggestion,
        prescription: data.prescription,
        followUpDate: data.followUpDate || null,
        priority: data.priority,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setShowSuggestionForm(false);
      setFormData({
        diagnosis: "",
        suggestion: "",
        prescription: "",
        followUpDate: "",
        priority: "medium",
      });
      // Store the suggestion ID and show success dialog
      setLastCreatedSuggestionId(data.suggestion?._id || data.suggestion?.id);
      setShowSuccessDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/document", selectedDocument?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/doctor", user.id] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Suggestion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const response = await apiRequest("POST", `/api/suggestions/${suggestionId}/send-email`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent Successfully",
        description: `Email notification sent to patient at ${data.email}`,
      });
      setShowSuccessDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewDocument = (doc: Document) => {
    setSelectedDocument(doc);
    viewDocumentMutation.mutate(doc.id);
  };

  const handleOpenSuggestionForm = (doc: Document) => {
    setSelectedDocument(doc);
    setShowSuggestionForm(true);
  };

  const handleSubmitSuggestion = () => {
    if (!selectedDocument) return;
    if (!formData.suggestion.trim()) {
      toast({
        title: "Suggestion Required",
        description: "Please enter your medical suggestion.",
        variant: "destructive",
      });
      return;
    }
    createSuggestionMutation.mutate({
      documentId: selectedDocument.id,
      ...formData,
    });
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Patient Documents</h3>
        <p className="text-muted-foreground">
          No patients have shared their medical documents with you yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                    {getDocumentIcon(doc.documentType)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{doc.fileName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {getDocumentTypeLabel(doc.documentType)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {doc.ownerName && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>
                          {doc.ownerName} ({doc.ownerGeneratedId})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSuggestionForm(doc)}
                    className="gap-1"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Suggestion</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDocument(doc)}
                    disabled={viewDocumentMutation.isPending}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suggestion Form Dialog */}
      <Dialog open={showSuggestionForm} onOpenChange={setShowSuggestionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Add Medical Suggestion
            </DialogTitle>
            <DialogDescription>
              Provide your medical assessment for: {selectedDocument?.fileName}
              {selectedDocument?.ownerName && (
                <span className="block mt-1">
                  Patient: {selectedDocument.ownerName} ({selectedDocument.ownerGeneratedId})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Priority Selection */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: "low" | "medium" | "high" | "critical") =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Low - Routine
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      Medium - Standard
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      High - Important
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Critical - Urgent
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Diagnosis */}
            <div className="space-y-2">
              <Label htmlFor="diagnosis" className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                Diagnosis (Optional)
              </Label>
              <Textarea
                id="diagnosis"
                placeholder="Enter your diagnosis based on the document..."
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                rows={2}
              />
            </div>

            {/* Suggestion/Recommendation */}
            <div className="space-y-2">
              <Label htmlFor="suggestion" className="flex items-center gap-1">
                <MessageSquarePlus className="h-4 w-4" />
                Suggestion / Recommendation *
              </Label>
              <Textarea
                id="suggestion"
                placeholder="Enter your medical suggestion or recommendation for the patient..."
                value={formData.suggestion}
                onChange={(e) => setFormData({ ...formData, suggestion: e.target.value })}
                rows={4}
                required
              />
            </div>

            {/* Prescription */}
            <div className="space-y-2">
              <Label htmlFor="prescription" className="flex items-center gap-1">
                <Pill className="h-4 w-4" />
                Prescription (Optional)
              </Label>
              <Textarea
                id="prescription"
                placeholder="Enter any prescribed medications or treatments..."
                value={formData.prescription}
                onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                rows={2}
              />
            </div>

            {/* Follow-up Date */}
            <div className="space-y-2">
              <Label htmlFor="followUpDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Follow-up Date (Optional)
              </Label>
              <Input
                id="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Existing Suggestions */}
            {existingSuggestions?.suggestions?.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-muted-foreground">Previous Suggestions for this Document</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {existingSuggestions.suggestions.map((sug: any) => (
                    <div
                      key={sug._id}
                      className="p-2 bg-muted rounded text-sm flex items-start gap-2"
                    >
                      <Badge className={`${getPriorityColor(sug.priority)} text-xs`}>
                        {sug.priority}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">
                          {new Date(sug.createdAt).toLocaleDateString()} by {sug.doctorName}
                        </p>
                        <p className="line-clamp-2">{sug.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowSuggestionForm(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSubmitSuggestion}
                disabled={createSuggestionMutation.isPending || !formData.suggestion.trim()}
              >
                <Send className="h-4 w-4 mr-1" />
                {createSuggestionMutation.isPending ? "Sending..." : "Send Suggestion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Denied Dialog */}
      <Dialog open={showAccessDenied} onOpenChange={setShowAccessDenied}>
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
            <Button onClick={() => setShowAccessDenied(false)}>Understood</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Send Email Option */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center">Suggestion Created Successfully!</DialogTitle>
            <DialogDescription className="text-center">
              Your medical suggestion has been saved. Would you like to send an email notification to the patient?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => {
                if (lastCreatedSuggestionId) {
                  sendEmailMutation.mutate(lastCreatedSuggestionId);
                }
              }}
              disabled={sendEmailMutation.isPending}
              className="w-full gap-2"
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Email...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Email to Patient
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="w-full"
            >
              Skip for Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
