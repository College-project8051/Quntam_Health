import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Stethoscope,
  Brain,
  Pill,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@/App";

interface Suggestion {
  _id: string;
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  diagnosis?: string;
  suggestion: string;
  prescription?: string;
  followUpDate?: string;
  priority: "low" | "medium" | "high" | "critical";
  isRead: boolean;
  createdAt: string;
}

interface PatientSuggestionsProps {
  user: UserType;
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "high":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "medium":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "low":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function getPriorityLabel(priority: string) {
  switch (priority) {
    case "critical":
      return { label: "Critical", color: "bg-red-500 text-white" };
    case "high":
      return { label: "High", color: "bg-orange-500 text-white" };
    case "medium":
      return { label: "Medium", color: "bg-yellow-500 text-black" };
    case "low":
      return { label: "Low", color: "bg-green-500 text-white" };
    default:
      return { label: "Unknown", color: "bg-gray-500 text-white" };
  }
}

function getDocumentTypeLabel(documentType: string) {
  switch (documentType) {
    case "x-ray":
      return "X-Ray";
    case "ct-scan":
      return "CT Scan";
    case "mri":
      return "MRI";
    case "lab-report":
      return "Lab Report";
    case "prescription":
      return "Prescription";
    default:
      return "Document";
  }
}

export default function PatientSuggestions({ user }: PatientSuggestionsProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/suggestions/patient", user.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/suggestions/patient/${user.id}`);
      return response.json();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const response = await apiRequest("PUT", `/api/suggestions/${suggestionId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/patient", user.id] });
    },
  });

  const handleToggleExpand = (suggestionId: string, isRead: boolean) => {
    if (expandedSuggestion === suggestionId) {
      setExpandedSuggestion(null);
    } else {
      setExpandedSuggestion(suggestionId);
      if (!isRead) {
        markAsReadMutation.mutate(suggestionId);
      }
    }
  };

  const suggestions: Suggestion[] = data?.suggestions || [];
  const unreadCount = suggestions.filter((s) => !s.isRead).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-destructive">Failed to load suggestions</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Stethoscope className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Doctor Suggestions Yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          When doctors review your medical documents and provide suggestions, they will appear here.
          Share your documents with doctors to receive medical advice.
        </p>
      </div>
    );
  }

  // Group suggestions by priority for better organization
  const criticalSuggestions = suggestions.filter((s) => s.priority === "critical");
  const highSuggestions = suggestions.filter((s) => s.priority === "high");
  const otherSuggestions = suggestions.filter(
    (s) => s.priority !== "critical" && s.priority !== "high"
  );

  const sortedSuggestions = [...criticalSuggestions, ...highSuggestions, ...otherSuggestions];

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Doctor Suggestions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Medical recommendations from your healthcare providers
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            {unreadCount} Unread
          </Badge>
        )}
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {sortedSuggestions.map((suggestion) => {
          const priorityInfo = getPriorityLabel(suggestion.priority);
          const isExpanded = expandedSuggestion === (suggestion.id || suggestion._id);

          return (
            <Card
              key={suggestion.id || suggestion._id}
              className={`transition-all ${
                !suggestion.isRead ? "border-primary/50 bg-primary/5" : ""
              } ${isExpanded ? "shadow-lg" : "hover:shadow-md"}`}
            >
              <CardHeader
                className="cursor-pointer pb-2"
                onClick={() => handleToggleExpand(suggestion.id || suggestion._id, suggestion.isRead)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getPriorityIcon(suggestion.priority)}</div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {!suggestion.isRead && (
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                        Dr. {suggestion.doctorName}
                        {suggestion.doctorSpecialty && (
                          <span className="text-sm font-normal text-muted-foreground">
                            ({suggestion.doctorSpecialty})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <FileText className="h-3 w-3" />
                        {suggestion.documentName} ({getDocumentTypeLabel(suggestion.documentType)})
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Diagnosis */}
                  {suggestion.diagnosis && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Brain className="h-4 w-4" />
                        Diagnosis
                      </div>
                      <p className="text-sm bg-muted p-3 rounded-md">{suggestion.diagnosis}</p>
                    </div>
                  )}

                  {/* Suggestion/Recommendation */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Stethoscope className="h-4 w-4" />
                      Recommendation
                    </div>
                    <p className="text-sm bg-primary/10 p-3 rounded-md border border-primary/20">
                      {suggestion.suggestion}
                    </p>
                  </div>

                  {/* Prescription */}
                  {suggestion.prescription && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Pill className="h-4 w-4" />
                        Prescription
                      </div>
                      <p className="text-sm bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800">
                        {suggestion.prescription}
                      </p>
                    </div>
                  )}

                  {/* Follow-up Date */}
                  {suggestion.followUpDate && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">
                        <span className="font-medium">Follow-up recommended:</span>{" "}
                        {new Date(suggestion.followUpDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Received on{" "}
                    {new Date(suggestion.createdAt).toLocaleString("en-US", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
