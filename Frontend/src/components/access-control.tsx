import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, UserMinus, UserCheck, X, Users, Phone, MapPin, Stethoscope, Mail } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/App";

interface Doctor {
  id: string;
  generatedId: string;
  name: string;
  phone: string;
  city: string;
  specialty: string;
  email: string;
}

interface AccessControlProps {
  user: User;
}

export default function AccessControl({ user }: AccessControlProps) {
  const [grantDoctorId, setGrantDoctorId] = useState("");
  const [idLabelMap, setIdLabelMap] = useState<Record<string, string>>({});
  const [doctorsDialogOpen, setDoctorsDialogOpen] = useState(false);
  const pendingGrantResolvedId = useRef<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all doctors list
  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ["/api/users/doctors"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/doctors");
      return res.json();
    },
    enabled: doctorsDialogOpen, // Only fetch when dialog is open
  });

  // Get user's documents for granting access
  const { data: documentsData } = useQuery({
    queryKey: ["/api/documents/user", user.id],
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectDoctor = (doctorId: string) => {
    setGrantDoctorId(doctorId);
    setDoctorsDialogOpen(false);
    toast({
      title: "Doctor Selected",
      description: `Doctor ID ${doctorId} has been filled in`,
    });
  };

  // Get current access permissions
  const { data: accessData, refetch: refetchAccess } = useQuery({
    queryKey: ["/api/access/by-granter", user.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/access/by-granter/${user.id}`);
      return await res.json();
    },
    staleTime: 0,
  });

  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async ({ documentId, doctorId }: { documentId: string; doctorId: string }) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/grant`, {
        granterId: user.id,
        doctorId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Access Granted",
        description: "Doctor access granted successfully. Blockchain updated.",
      });
      // Remember the human-friendly DOC-XXXX label for this grantedTo id
      const typed = grantDoctorId.trim().toUpperCase();
      if (typed.startsWith("DOC-") && pendingGrantResolvedId.current) {
        setIdLabelMap((prev) => ({ ...prev, [pendingGrantResolvedId.current as string]: typed }));
      }
      pendingGrantResolvedId.current = null;
      setGrantDoctorId("");
      refetchAccess();
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/history"] });
    },
    onError: (error) => {
      toast({
        title: "Grant Access Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resolve human-readable DOC-IDs to internal user IDs
  async function resolveDoctorId(input: string): Promise<string> {
    const cleaned = input.trim().toUpperCase();
    if (cleaned.startsWith("DOC-")) {
      try {
        const res = await apiRequest("GET", `/api/users/search?query=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        if (data?.users?.length > 0) {
          return data.users[0].id; // internal _id
        }
      } catch (e) {
        // ignore and fallback to original input
      }
    }
    return cleaned;
  }

  // Revoke access mutation
  const revokeAccessMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const response = await apiRequest("POST", `/api/documents/access/${accessId}/revoke`, {
        userId: user.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Access Revoked",
        description: "Doctor access revoked successfully. Blockchain updated.",
      });
      refetchAccess();
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/history"] });
    },
    onError: (error) => {
      toast({
        title: "Revoke Access Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGrantAccess = async (documentId: string) => {
    if (!grantDoctorId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a doctor ID",
        variant: "destructive",
      });
      return;
    }

    const resolvedId = await resolveDoctorId(grantDoctorId);
    pendingGrantResolvedId.current = resolvedId;

    grantAccessMutation.mutate({
      documentId,
      doctorId: resolvedId,
    });
  };

  const handleRevokeAccess = (accessId: string) => {
    revokeAccessMutation.mutate(accessId);
  };

  return (
    <>
      {user.userType === "patient" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <UserPlus className="h-5 w-5" />
                Grant Document Access
              </CardTitle>
              <Dialog open={doctorsDialogOpen} onOpenChange={setDoctorsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    Doctors
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      Available Doctors
                    </DialogTitle>
                    <DialogDescription>
                      Browse and select a doctor to grant access to your documents
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[400px] pr-4">
                    {doctorsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (doctorsData as any)?.doctors?.length > 0 ? (
                      <div className="space-y-3">
                        {(doctorsData as any).doctors.map((doctor: Doctor) => (
                          <div
                            key={doctor.id}
                            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getInitials(doctor.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold truncate">{doctor.name}</p>
                                <Badge variant="secondary" className="text-xs font-mono">
                                  {doctor.generatedId}
                                </Badge>
                              </div>
                              {doctor.specialty && (
                                <p className="text-sm text-primary mt-0.5">
                                  {doctor.specialty}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {doctor.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {doctor.phone}
                                  </span>
                                )}
                                {doctor.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {doctor.email}
                                  </span>
                                )}
                                {doctor.city && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {doctor.city}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSelectDoctor(doctor.generatedId)}
                            >
                              Select
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No doctors registered yet</p>
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">
                Doctor ID
              </Label>
              <Input
                type="text"
                placeholder="Enter Doctor ID (e.g., DOC-1234)"
                value={grantDoctorId}
                onChange={(e) => setGrantDoctorId(e.target.value.toUpperCase())}
                className="w-full"
                data-testid="input-doctor-id"
              />
            </div>
            {(documentsData as any)?.documents?.length > 0 ? (
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">
                  Select Documents to Grant Access
                </Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(documentsData as any).documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                        <Badge variant="outline" className="text-xs">
                          {doc.documentType.replace("-", " ").toUpperCase()}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGrantAccess(doc.id)}
                        disabled={!grantDoctorId.trim() || grantAccessMutation.isPending}
                        data-testid={`button-grant-access-${doc.id}`}
                      >
                        {grantAccessMutation.isPending ? "Granting..." : "Grant"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No documents available to grant access
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {user.userType === "patient" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserMinus className="h-5 w-5" />
              Revoke Document Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">
                Current Access Permissions
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(accessData as any)?.accessList?.length > 0 ? (
                  (accessData as any).accessList.map((access: any) => (
                    <div
                      key={access.id || access._id}
                      className="flex items-center justify-between p-3 border border-border rounded-md"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {access.doctorName || "Doctor"} - {access.doctorGeneratedId || access.grantedTo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Document: {access.documentName || "Unknown"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevokeAccess(access.id || access._id)}
                        disabled={revokeAccessMutation.isPending}
                        data-testid={`button-revoke-access-${access.id || access._id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No active access permissions</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
