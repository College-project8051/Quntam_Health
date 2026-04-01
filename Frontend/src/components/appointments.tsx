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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  Video,
  Phone,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  VideoIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VideoConsultation from "./video-consultation";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: 'in-person' | 'video' | 'phone';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show' | 'rescheduled';
  reason?: string;
  patientNotes?: string;
  doctorNotes?: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

interface Doctor {
  id: string;
  name: string;
  specialty?: string;
  city?: string;
}

interface AppointmentsProps {
  userId: string;
  userType: 'patient' | 'doctor';
  userName: string;
}

export function Appointments({ userId, userType, userName }: AppointmentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [appointmentType, setAppointmentType] = useState<'in-person' | 'video' | 'phone'>('in-person');
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoCallAppointment, setVideoCallAppointment] = useState<Appointment | null>(null);

  // Doctor custom appointment states
  const [showDoctorBookingDialog, setShowDoctorBookingDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customHour, setCustomHour] = useState<string>("09");
  const [customMinute, setCustomMinute] = useState<string>("00");
  const [customDuration, setCustomDuration] = useState<number>(30);

  // Fetch appointments
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ["appointments", userId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });

  const appointments: Appointment[] = appointmentsData?.appointments || [];

  // Fetch doctors (for patient booking)
  const { data: doctorsData } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const res = await fetch("/api/users/doctors");
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
    enabled: userType === 'patient',
  });

  const doctors: Doctor[] = doctorsData?.doctors || [];

  // Fetch patients (for doctor booking)
  const { data: patientsData } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const res = await fetch("/api/users/patients");
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
    enabled: userType === 'doctor',
  });

  const patients: { id: string; name: string }[] = patientsData?.patients || [];

  // Fetch time slots for selected doctor and date
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ["slots", selectedDoctor?.id, selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!selectedDoctor?.id) return { slots: [] };
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await fetch(`/api/doctor/${selectedDoctor.id}/slots?date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: !!selectedDoctor?.id,
  });

  const slots: TimeSlot[] = slotsData?.slots || [];

  // Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor || !selectedSlot) throw new Error("Missing data");
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: userId,
          doctorId: selectedDoctor.id,
          appointmentDate: selectedDate.toISOString(),
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          type: appointmentType,
          reason,
          notes,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to book appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment booked successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments", userId] });
      setShowBookingDialog(false);
      resetBookingForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Doctor creates custom appointment mutation
  const doctorBookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Please select a patient");

      const startTime = `${customHour}:${customMinute}`;
      // Calculate end time based on duration
      const startMinutes = parseInt(customHour) * 60 + parseInt(customMinute);
      const endMinutes = startMinutes + customDuration;
      const endHour = Math.floor(endMinutes / 60).toString().padStart(2, '0');
      const endMin = (endMinutes % 60).toString().padStart(2, '0');
      const endTime = `${endHour}:${endMin}`;

      const res = await fetch("/api/appointments/doctor-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: userId,
          patientId: selectedPatient.id,
          appointmentDate: new Date(customDate).toISOString(),
          startTime,
          endTime,
          type: appointmentType,
          reason,
          notes,
          duration: customDuration,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments", userId] });
      setShowDoctorBookingDialog(false);
      resetDoctorBookingForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update appointment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status, cancelReason }: { appointmentId: string; status: string; cancelReason?: string }) => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, userId, cancelReason }),
      });
      if (!res.ok) throw new Error("Failed to update appointment");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments", userId] });
      setCancelDialogOpen(false);
      setSelectedAppointment(null);
      setCancelReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update appointment",
        variant: "destructive",
      });
    },
  });

  const resetBookingForm = () => {
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setAppointmentType('in-person');
    setReason("");
    setNotes("");
    setSelectedDate(new Date());
  };

  const resetDoctorBookingForm = () => {
    setSelectedPatient(null);
    setCustomDate(new Date().toISOString().split('T')[0]);
    setCustomHour("09");
    setCustomMinute("00");
    setCustomDuration(30);
    setAppointmentType('in-person');
    setReason("");
    setNotes("");
  };

  const upcomingAppointments = appointments.filter(
    (apt) => ['scheduled', 'confirmed', 'rescheduled'].includes(apt.status) && new Date(apt.appointmentDate) >= new Date()
  );

  const pastAppointments = appointments.filter(
    (apt) => apt.status === 'completed' || new Date(apt.appointmentDate) < new Date()
  );

  const cancelledAppointments = appointments.filter(
    (apt) => apt.status === 'cancelled'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    if (newDate >= new Date()) {
      setSelectedDate(newDate);
      setSelectedSlot(null);
    }
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${userType === 'patient' ? 'bg-blue-100' : 'bg-green-100'}`}>
              {userType === 'patient' ? (
                <Stethoscope className="h-6 w-6 text-blue-600" />
              ) : (
                <User className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {userType === 'patient' ? `Dr. ${appointment.doctorName}` : appointment.patientName}
              </h3>
              {appointment.doctorSpecialty && userType === 'patient' && (
                <p className="text-sm text-muted-foreground">{appointment.doctorSpecialty}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(appointment.appointmentDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {appointment.startTime} - {appointment.endTime}
                </span>
                <span className="flex items-center gap-1">
                  {getTypeIcon(appointment.type)}
                  {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)}
                </span>
              </div>
              {appointment.reason && (
                <p className="text-sm mt-2">
                  <span className="font-medium">Reason:</span> {appointment.reason}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getStatusColor(appointment.status)}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Badge>
            {['scheduled', 'confirmed', 'rescheduled'].includes(appointment.status) && (
              <div className="flex gap-2">
                {userType === 'doctor' && appointment.status === 'scheduled' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    onClick={() => updateStatusMutation.mutate({ appointmentId: appointment._id, status: 'confirmed' })}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Confirm
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                  onClick={() => {
                    setSelectedAppointment(appointment);
                    setCancelDialogOpen(true);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
            {userType === 'doctor' && appointment.status === 'confirmed' && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate({ appointmentId: appointment._id, status: 'completed' })}
              >
                Mark Complete
              </Button>
            )}
            {/* Video Call Button - Show for confirmed video appointments for BOTH doctor and patient */}
            {appointment.type === 'video' && appointment.status === 'confirmed' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setVideoCallAppointment(appointment);
                  setShowVideoCall(true);
                }}
              >
                <Video className="h-4 w-4 mr-1" />
                {userType === 'doctor' ? 'Start Now' : 'Join Video Call'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Appointments
          </h1>
          <p className="text-muted-foreground">
            {userType === 'patient' ? 'Manage your appointments with doctors' : 'View and manage patient appointments'}
          </p>
        </div>
        {userType === 'patient' && (
          <Button onClick={() => setShowBookingDialog(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        )}
        {userType === 'doctor' && (
          <Button onClick={() => setShowDoctorBookingDialog(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Create Appointment
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Upcoming ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Past ({pastAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex items-center gap-2">
            <CalendarX className="h-4 w-4" />
            Cancelled ({cancelledAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading appointments...</div>
          ) : upcomingAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">No upcoming appointments</h3>
                <p className="text-muted-foreground mt-2">
                  {userType === 'patient' ? 'Book an appointment with a doctor to get started' : 'No patients have booked appointments yet'}
                </p>
                {userType === 'patient' && (
                  <Button className="mt-4" onClick={() => setShowBookingDialog(true)}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Book Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            upcomingAppointments.map((apt) => (
              <AppointmentCard key={apt._id} appointment={apt} />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">No past appointments</h3>
              </CardContent>
            </Card>
          ) : (
            pastAppointments.map((apt) => (
              <AppointmentCard key={apt._id} appointment={apt} />
            ))
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          {cancelledAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarX className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">No cancelled appointments</h3>
              </CardContent>
            </Card>
          ) : (
            cancelledAppointments.map((apt) => (
              <AppointmentCard key={apt._id} appointment={apt} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Book an Appointment
            </DialogTitle>
            <DialogDescription>
              Select a doctor, date, and time slot to book your appointment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Select Doctor */}
            <div className="space-y-2">
              <Label>Select Doctor</Label>
              <Select
                value={selectedDoctor?.id || ""}
                onValueChange={(value) => {
                  const doc = doctors.find(d => d.id === value);
                  setSelectedDoctor(doc || null);
                  setSelectedSlot(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Dr. {doc.name} {doc.specialty && `- ${doc.specialty}`}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Select Date */}
            {selectedDoctor && (
              <div className="space-y-2">
                <Label>Select Date</Label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateDate('prev')}
                    disabled={selectedDate.toDateString() === new Date().toDateString()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center font-medium">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Select Time Slot */}
            {selectedDoctor && (
              <div className="space-y-2">
                <Label>Select Time Slot</Label>
                {loadingSlots ? (
                  <div className="text-center py-4 text-muted-foreground">Loading available slots...</div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No slots available for this date
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.startTime}
                        variant={selectedSlot?.startTime === slot.startTime ? "default" : "outline"}
                        disabled={slot.isBooked}
                        className={slot.isBooked ? "opacity-50 cursor-not-allowed" : ""}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.startTime}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Appointment Type */}
            {selectedSlot && (
              <div className="space-y-2">
                <Label>Appointment Type</Label>
                <Select
                  value={appointmentType}
                  onValueChange={(value: 'in-person' | 'video' | 'phone') => setAppointmentType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in-person">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        In-Person
                      </div>
                    </SelectItem>
                    <SelectItem value="video">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Video Call
                      </div>
                    </SelectItem>
                    <SelectItem value="phone">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Call
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 5: Reason & Notes */}
            {selectedSlot && (
              <>
                <div className="space-y-2">
                  <Label>Reason for Visit</Label>
                  <Input
                    placeholder="e.g., Regular checkup, Follow-up, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Notes (Optional)</Label>
                  <Textarea
                    placeholder="Any additional information for the doctor..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBookingDialog(false);
              resetBookingForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => bookAppointmentMutation.mutate()}
              disabled={!selectedDoctor || !selectedSlot || bookAppointmentMutation.isPending}
            >
              {bookAppointmentMutation.isPending ? "Booking..." : "Book Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Create Appointment Dialog */}
      <Dialog open={showDoctorBookingDialog} onOpenChange={setShowDoctorBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Create Appointment
            </DialogTitle>
            <DialogDescription>
              Create a custom appointment with any patient at any time
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Select Patient */}
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select
                value={selectedPatient?.id || ""}
                onValueChange={(value) => {
                  const patient = patients.find(p => p.id === value);
                  setSelectedPatient(patient || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {patient.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Select Date */}
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Input
                type="date"
                value={customDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>

            {/* Step 3: Custom Time Selection */}
            <div className="space-y-2">
              <Label>Select Time</Label>
              <div className="flex items-center gap-2">
                <Select value={customHour} onValueChange={setCustomHour}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xl font-bold">:</span>
                <Select value={customMinute} onValueChange={setCustomMinute}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Minute" />
                  </SelectTrigger>
                  <SelectContent>
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground ml-2">
                  ({parseInt(customHour) >= 12 ? 'PM' : 'AM'})
                </span>
              </div>
            </div>

            {/* Step 4: Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={customDuration.toString()}
                onValueChange={(value) => setCustomDuration(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Step 5: Appointment Type */}
            <div className="space-y-2">
              <Label>Appointment Type</Label>
              <Select
                value={appointmentType}
                onValueChange={(value: 'in-person' | 'video' | 'phone') => setAppointmentType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      In-Person
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Video Call
                    </div>
                  </SelectItem>
                  <SelectItem value="phone">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Call
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Step 6: Reason & Notes */}
            <div className="space-y-2">
              <Label>Reason for Appointment</Label>
              <Input
                placeholder="e.g., Follow-up, Consultation, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDoctorBookingDialog(false);
              resetDoctorBookingForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => doctorBookAppointmentMutation.mutate()}
              disabled={!selectedPatient || doctorBookAppointmentMutation.isPending}
            >
              {doctorBookAppointmentMutation.isPending ? "Creating..." : "Create Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Cancellation (Optional)</Label>
              <Textarea
                placeholder="Please provide a reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCancelDialogOpen(false);
              setSelectedAppointment(null);
              setCancelReason("");
            }}>
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedAppointment) {
                  updateStatusMutation.mutate({
                    appointmentId: selectedAppointment._id,
                    status: 'cancelled',
                    cancelReason,
                  });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Cancelling..." : "Cancel Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Consultation */}
      {showVideoCall && videoCallAppointment && (
        <VideoConsultation
          userId={userId}
          userName={userName}
          userType={userType}
          appointment={videoCallAppointment}
          onClose={() => {
            setShowVideoCall(false);
            setVideoCallAppointment(null);
          }}
        />
      )}
    </div>
  );
}

export default Appointments;
