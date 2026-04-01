import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Upload,
  Eye,
  History,
  FileText,
  Share2,
  Shield,
  Activity,
  Clock,
  TrendingUp,
  Users,
  Lock,
  CheckCircle2,
  ArrowRight,
  Zap,
  Stethoscope,
  ClipboardList,
  Mail,
  Loader2,
  Calendar,
  MessageSquare,
  CalendarClock,
} from "lucide-react";
import FileUpload from "@/components/file-upload";
import AccessControl from "@/components/access-control";
import DocumentViewer from "@/components/document-viewer";
import DoctorDocumentViewer from "@/components/doctor-document-viewer";
import PatientSuggestions from "@/components/patient-suggestions";
import BlockchainHistory from "@/components/blockchain-history";
import Messaging from "@/components/messaging";
import Appointments from "@/components/appointments";
import DoctorAvailability from "@/components/doctor-availability";
import FindDoctors from "@/components/find-doctors";
import AIChatbot from "@/components/ai-chatbot";
import Sider from "@/components/Sider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/App";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onProfileComplete?: () => void;
}

interface DoctorSuggestion {
  _id: string;
  id: string;
  documentName: string;
  documentType: string;
  patientName: string;
  patientGeneratedId: string;
  diagnosis?: string;
  suggestion: string;
  prescription?: string;
  followUpDate?: string;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
}

// Component for doctors to view their suggestions
function DoctorSuggestionsList({ suggestions }: { suggestions: DoctorSuggestion[] }) {
  const { toast } = useToast();
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);

  const handleSendEmail = async (suggestionId: string) => {
    setSendingEmailFor(suggestionId);
    try {
      const response = await apiRequest("POST", `/api/suggestions/${suggestionId}/send-email`);
      const data = await response.json();
      toast({
        title: "Email Sent Successfully",
        description: `Email notification sent to patient at ${data.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSendingEmailFor(null);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Suggestions Yet</h3>
        <p className="text-muted-foreground">
          When you provide medical suggestions for patient documents, they will appear here.
        </p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {suggestions.map((sug) => {
        const suggestionId = sug.id || sug._id;
        const isSending = sendingEmailFor === suggestionId;

        return (
          <Card key={suggestionId} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(sug.priority)}>
                      {sug.priority}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(sug.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-medium mt-1">
                    {sug.documentName}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Patient: {sug.patientName} ({sug.patientGeneratedId})
                  </p>
                </div>
                {/* Send Email Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendEmail(suggestionId)}
                  disabled={isSending}
                  className="gap-1 shrink-0"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-3 w-3" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>

              {sug.diagnosis && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Diagnosis:</p>
                  <p className="text-sm bg-muted p-2 rounded">{sug.diagnosis}</p>
                </div>
              )}

              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground">Suggestion:</p>
                <p className="text-sm bg-primary/10 p-2 rounded">{sug.suggestion}</p>
              </div>

              {sug.prescription && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Prescription:</p>
                  <p className="text-sm bg-green-50 dark:bg-green-950 p-2 rounded">{sug.prescription}</p>
                </div>
              )}

              {sug.followUpDate && (
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <Clock className="h-3 w-3" />
                  Follow-up: {new Date(sug.followUpDate).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Dashboard({ user, onLogout, onProfileComplete }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedChatDoctor, setSelectedChatDoctor] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  // Check if user needs to complete profile
  const isNewUser = user.isNewUser === true;

  // Handle page change - clear selected doctor when leaving messages
  const handlePageChange = (page: string) => {
    if (activePage === "messages" && page !== "messages") {
      setSelectedChatDoctor(null);
    }
    setActivePage(page);
  };

  // Search users
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("GET", `/api/users/search?query=${encodeURIComponent(query)}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.users.length === 0) {
        toast({
          title: "No Results",
          description: "No users found with that ID",
        });
      } else {
        toast({
          title: "Search Results",
          description: `Found ${data.users.length} user(s)`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get user documents (different endpoint for patients vs doctors)
  const { data: documentsData } = useQuery({
    queryKey: [user.userType === "patient" ? "/api/documents/user" : "/api/documents/shared", user.id],
    queryFn: async () => {
      const endpoint = user.userType === "patient"
        ? `/api/documents/user/${user.id}`
        : `/api/documents/shared/${user.id}`;
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Get suggestions for patient or by doctor
  const { data: suggestionsData } = useQuery({
    queryKey: [user.userType === "patient" ? "/api/suggestions/patient" : "/api/suggestions/doctor", user.id],
    queryFn: async () => {
      const endpoint = user.userType === "patient"
        ? `/api/suggestions/patient/${user.id}`
        : `/api/suggestions/doctor/${user.id}`;
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchQuery.trim());
  };

  const handleLogout = () => {
    toast({
      title: "Logged Out",
      description: "You have been securely logged out",
    });
    onLogout();
  };

  // Render content based on active page
  const renderContent = () => {
    switch (activePage) {
      case "search":
        return (
          <FindDoctors
            userId={user.id}
            userName={user.name}
            onStartChat={(doctorId, doctorName) => {
              setSelectedChatDoctor({ id: doctorId, name: doctorName });
              setActivePage("messages");
            }}
            onBookAppointment={(doctorId) => {
              setActivePage("appointments");
            }}
          />
        );

      case "upload":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Medical Document Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload user={user} />
            </CardContent>
          </Card>
        );

      case "documents":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                View Medical Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentViewer user={user} documents={(documentsData as any)?.documents || []} />
            </CardContent>
          </Card>
        );

      case "shared":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AccessControl user={user} />
          </div>
        );

      case "history":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Blockchain Access History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BlockchainHistory userId={user.id} />
            </CardContent>
          </Card>
        );

      // Patient-specific: View doctor suggestions
      case "suggestions":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Doctor Suggestions
              </CardTitle>
              <CardDescription>
                Medical recommendations and advice from your healthcare providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatientSuggestions user={user} />
            </CardContent>
          </Card>
        );

      // Doctor-specific: View patient documents shared with them
      case "patients":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Patient Documents
              </CardTitle>
              <CardDescription>
                Medical documents shared with you by patients. Click on a document to view and add suggestions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DoctorDocumentViewer user={user} documents={(documentsData as any)?.documents || []} />
            </CardContent>
          </Card>
        );

      // Doctor-specific: View suggestions they've made
      case "my-suggestions":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                My Suggestions
              </CardTitle>
              <CardDescription>
                Medical suggestions and recommendations you've provided to patients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DoctorSuggestionsList suggestions={(suggestionsData as any)?.suggestions || []} />
            </CardContent>
          </Card>
        );

      // Messaging - Secure chat between doctor and patient
      case "messages":
        return (
          <Messaging
            userId={user.id}
            userType={user.userType}
            userName={user.name}
            initialDoctorId={selectedChatDoctor?.id}
            initialDoctorName={selectedChatDoctor?.name}
          />
        );

      // Appointments - Book and manage appointments
      case "appointments":
        return (
          <Appointments
            userId={user.id}
            userType={user.userType as 'patient' | 'doctor'}
            userName={user.name}
          />
        );

      // Doctor Availability - Set available time slots
      case "availability":
        return (
          <DoctorAvailability doctorId={user.id} />
        );

      case "dashboard":
      default:
        const documents = (documentsData as any)?.documents || [];
        const totalDocuments = documents.length;
        const recentDocuments = documents.slice(0, 3);
        const suggestions = (suggestionsData as any)?.suggestions || [];
        const totalSuggestions = suggestions.length;

        return (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">
                      Welcome back, {user.userType === "doctor" ? "Dr. " : ""}{user.name.split(" ")[0]}!
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      {user.userType === "doctor"
                        ? "Access patient records and provide medical suggestions"
                        : "Your medical records are secured with quantum encryption"}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <Shield className="h-3 w-3 mr-1" />
                        Quantum Secured
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {user.userType}
                      </Badge>
                      <Badge variant="outline">
                        ID: {user.generatedId}
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Shield className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards - Different for doctors vs patients */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {user.userType === "doctor" ? "Patient Documents" : "My Documents"}
                      </p>
                      <p className="text-3xl font-bold">{totalDocuments}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span>{user.userType === "doctor" ? "Shared with you" : "Encrypted & Secure"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {user.userType === "doctor" ? "My Suggestions" : "Doctor Suggestions"}
                      </p>
                      <p className="text-3xl font-bold">{totalSuggestions}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <Stethoscope className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{user.userType === "doctor" ? "Recommendations provided" : "Medical advice received"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Security Status</p>
                      <p className="text-3xl font-bold text-green-600">Active</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                      <Lock className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>AES-256 + BB84 Quantum</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Blockchain</p>
                      <p className="text-3xl font-bold text-purple-600">Verified</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Activity className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3 text-purple-500" />
                    <span>Immutable audit trail</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions - Different for patients vs doctors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  {user.userType === "doctor"
                    ? "Common tasks for healthcare providers"
                    : "Common tasks you can perform"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.userType === "doctor" ? (
                  // Doctor Quick Actions
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("appointments")}
                    >
                      <Calendar className="h-6 w-6 text-primary" />
                      <span className="text-sm">Appointments</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("availability")}
                    >
                      <CalendarClock className="h-6 w-6 text-primary" />
                      <span className="text-sm">Set Availability</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("messages")}
                    >
                      <MessageSquare className="h-6 w-6 text-primary" />
                      <span className="text-sm">Messages</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("patients")}
                    >
                      <Users className="h-6 w-6 text-primary" />
                      <span className="text-sm">Patient Documents</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("my-suggestions")}
                    >
                      <ClipboardList className="h-6 w-6 text-primary" />
                      <span className="text-sm">My Suggestions</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("history")}
                    >
                      <History className="h-6 w-6 text-primary" />
                      <span className="text-sm">View History</span>
                    </Button>
                  </div>
                ) : (
                  // Patient Quick Actions
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("appointments")}
                    >
                      <Calendar className="h-6 w-6 text-primary" />
                      <span className="text-sm">Appointments</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("messages")}
                    >
                      <MessageSquare className="h-6 w-6 text-primary" />
                      <span className="text-sm">Messages</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("upload")}
                    >
                      <Upload className="h-6 w-6 text-primary" />
                      <span className="text-sm">Upload Document</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("documents")}
                    >
                      <Eye className="h-6 w-6 text-primary" />
                      <span className="text-sm">View Documents</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("shared")}
                    >
                      <Share2 className="h-6 w-6 text-primary" />
                      <span className="text-sm">Manage Access</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary"
                      onClick={() => handlePageChange("suggestions")}
                    >
                      <Stethoscope className="h-6 w-6 text-primary" />
                      <span className="text-sm">Doctor Suggestions</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Documents & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Documents - Different for doctors vs patients */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {user.userType === "doctor" ? "Recent Patient Documents" : "Recent Documents"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePageChange(user.userType === "doctor" ? "patients" : "documents")}
                    >
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {recentDocuments.map((doc: any, index: number) => (
                        <div
                          key={doc.id || index}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.title || doc.fileName || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.documentType || "Medical Record"} • {new Date(doc.createdAt || doc.uploadedAt || Date.now()).toLocaleDateString()}
                            </p>
                            {/* Show patient info for doctors */}
                            {user.userType === "doctor" && doc.ownerName && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3" />
                                {doc.ownerName}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Encrypted
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      {user.userType === "doctor" ? (
                        <>
                          <p>No patient documents shared yet</p>
                          <p className="text-sm mt-1">Patients can share their documents with you</p>
                        </>
                      ) : (
                        <>
                          <p>No documents yet</p>
                          <Button
                            variant="link"
                            className="mt-2"
                            onClick={() => handlePageChange("upload")}
                          >
                            Upload your first document
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Security Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Quantum Key Distribution (BB84)</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>AES-256 Encryption</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Blockchain Verification</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Last security check: Just now</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sider
        user={user}
        onLogout={handleLogout}
        activePage={activePage}
        onPageChange={handlePageChange}
        isNewUser={isNewUser}
        onProfileComplete={onProfileComplete}
      >
        {renderContent()}
      </Sider>

      {/* AI Chatbot - Only for patients */}
      {user.userType === "patient" && (
        <AIChatbot userId={user.id} userName={user.name} />
      )}
    </div>
  );
}
