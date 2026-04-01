import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Phone,
  Calendar,
  Clock,
  User,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import VideoCall from "./video-call";

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
  type: "in-person" | "video" | "phone";
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  reason?: string;
}

interface VideoConsultationProps {
  userId: string;
  userName: string;
  userType: "patient" | "doctor";
  appointment?: Appointment;
  onClose: () => void;
}

export default function VideoConsultation({
  userId,
  userName,
  userType,
  appointment,
  onClose,
}: VideoConsultationProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const remoteName = userType === "patient"
    ? appointment?.doctorName || "Doctor"
    : appointment?.patientName || "Patient";

  // Start video call
  const startCall = async () => {
    if (!appointment) {
      toast({
        title: "Error",
        description: "No appointment selected",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create video room from appointment
      const response = await apiRequest("POST", "/api/video/create-from-appointment", {
        appointmentId: appointment._id,
      });

      const data = await response.json();

      if (data.success) {
        setRoomId(data.roomId);
        setIsInCall(true);
        toast({
          title: "Video Call Started",
          description: `Connecting with ${remoteName}...`,
        });
      } else {
        throw new Error(data.message || "Failed to create video room");
      }
    } catch (error: any) {
      console.error("Error starting video call:", error);
      setError(error.message || "Failed to start video call");
      toast({
        title: "Error",
        description: error.message || "Failed to start video call",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // End video call
  const handleEndCall = () => {
    setIsInCall(false);
    setRoomId(null);
    toast({
      title: "Call Ended",
      description: "Video consultation has ended",
    });
    onClose();
  };

  // If in call, show video call component
  if (isInCall && roomId) {
    return (
      <VideoCall
        roomId={roomId}
        userId={userId}
        userName={userName}
        userType={userType}
        remoteName={remoteName}
        onEndCall={handleEndCall}
      />
    );
  }

  // Pre-call screen
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4">
            <Video className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Video Consultation</CardTitle>
          <CardDescription>
            {appointment ? `Appointment with ${remoteName}` : "Start a video call"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Appointment Details */}
          {appointment && (
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                {userType === "patient" ? (
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                ) : (
                  <User className="h-5 w-5 text-purple-600" />
                )}
                <div>
                  <p className="font-medium">
                    {userType === "patient" ? `Dr. ${appointment.doctorName}` : appointment.patientName}
                  </p>
                  {appointment.doctorSpecialty && (
                    <p className="text-sm text-muted-foreground">{appointment.doctorSpecialty}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span>{new Date(appointment.appointmentDate).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>{appointment.startTime} - {appointment.endTime}</span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={appointment.status === "confirmed" ? "default" : "secondary"}>
                  {appointment.status}
                </Badge>
                <Badge variant="outline" className="bg-purple-50">
                  <Video className="h-3 w-3 mr-1" />
                  Video Call
                </Badge>
              </div>
            </div>
          )}

          {/* Pre-call Checklist */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Before starting:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Ensure your camera and microphone are working</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Find a quiet, well-lit space</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Check your internet connection</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={startCall}
              disabled={isLoading || !appointment}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Start Video Call
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
