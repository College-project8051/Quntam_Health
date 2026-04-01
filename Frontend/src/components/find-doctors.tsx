import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Stethoscope,
  MapPin,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  User,
  Clock,
  Star,
  Building,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Doctor {
  id: string;
  generatedId: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  city?: string;
  address?: string;
  createdAt?: string;
}

interface DoctorAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface FindDoctorsProps {
  userId: string;
  userName: string;
  onStartChat: (doctorId: string, doctorName: string) => void;
  onBookAppointment: (doctorId: string) => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FindDoctors({ userId, userName, onStartChat, onBookAppointment }: FindDoctorsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Fetch all doctors
  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const res = await fetch("/api/users/doctors");
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
  });

  const doctors: Doctor[] = doctorsData?.doctors || [];

  // Fetch selected doctor's availability
  const { data: availabilityData } = useQuery({
    queryKey: ["doctor-availability", selectedDoctor?.id],
    queryFn: async () => {
      if (!selectedDoctor?.id) return { availability: [] };
      const res = await fetch(`/api/doctor/${selectedDoctor.id}/availability`);
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    enabled: !!selectedDoctor?.id,
  });

  const availability: DoctorAvailability[] = availabilityData?.availability || [];

  // Create conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: userId,
          doctorId: doctorId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (_, doctorId) => {
      const doctor = doctors.find(d => d.id === doctorId);
      if (doctor) {
        onStartChat(doctorId, doctor.name);
      }
      setProfileOpen(false);
      toast({
        title: "Chat Started",
        description: `You can now message Dr. ${selectedDoctor?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    },
  });

  const filteredDoctors = doctors.filter((doctor) => {
    const query = searchQuery.toLowerCase();
    return (
      doctor.name.toLowerCase().includes(query) ||
      doctor.specialty?.toLowerCase().includes(query) ||
      doctor.city?.toLowerCase().includes(query) ||
      doctor.generatedId?.toLowerCase().includes(query)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleViewProfile = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setProfileOpen(true);
  };

  const handleStartChat = () => {
    if (selectedDoctor) {
      startConversationMutation.mutate(selectedDoctor.id);
    }
  };

  const getAvailableDays = () => {
    return availability
      .filter(a => a.isAvailable)
      .map(a => DAYS_OF_WEEK[a.dayOfWeek])
      .join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Find Doctors
          </CardTitle>
          <CardDescription>
            Browse available doctors, view their profiles, and start a conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, specialty, or city..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Doctors List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading doctors...
        </div>
      ) : filteredDoctors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Stethoscope className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium">No Doctors Found</h3>
            <p className="text-muted-foreground mt-2">
              {searchQuery ? "Try a different search term" : "No doctors are registered yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doctor) => (
            <Card
              key={doctor.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewProfile(doctor)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                      {getInitials(doctor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      Dr. {doctor.name}
                    </h3>
                    {doctor.specialty && (
                      <Badge variant="secondary" className="mt-1">
                        {doctor.specialty}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{doctor.city || "Location not specified"}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{doctor.generatedId}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewProfile(doctor);
                    }}
                  >
                    View Profile
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDoctor(doctor);
                      startConversationMutation.mutate(doctor.id);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Doctor Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDoctor && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                      {getInitials(selectedDoctor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">
                      Dr. {selectedDoctor.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedDoctor.specialty && (
                        <Badge variant="secondary" className="mr-2">
                          {selectedDoctor.specialty}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {selectedDoctor.generatedId}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Contact Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDoctor.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDoctor.email}</span>
                      </div>
                    )}
                    {selectedDoctor.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDoctor.phone}</span>
                      </div>
                    )}
                    {selectedDoctor.city && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDoctor.city}</span>
                      </div>
                    )}
                    {selectedDoctor.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDoctor.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Availability
                  </h3>
                  {availability.length > 0 ? (
                    <div className="space-y-2">
                      {availability
                        .filter(a => a.isAvailable)
                        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                        .map((slot) => (
                          <div
                            key={slot.dayOfWeek}
                            className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                          >
                            <span className="font-medium text-green-700">
                              {DAYS_OF_WEEK[slot.dayOfWeek]}
                            </span>
                            <span className="text-green-600">
                              {slot.startTime} - {slot.endTime}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Availability not set. Contact the doctor directly.
                    </p>
                  )}
                </div>

                {/* Member Since */}
                {selectedDoctor.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarCheck className="h-4 w-4" />
                    <span>
                      Member since {new Date(selectedDoctor.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  className="flex-1"
                  onClick={handleStartChat}
                  disabled={startConversationMutation.isPending}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {startConversationMutation.isPending ? "Starting..." : "Send Message"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setProfileOpen(false);
                    onBookAppointment(selectedDoctor.id);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FindDoctors;
