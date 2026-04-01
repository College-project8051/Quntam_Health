import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Maximize2,
  Minimize2,
  User,
  Stethoscope,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessagingCallProps {
  callType: "audio" | "video";
  roomId: string;
  callerId: string;
  callerName: string;
  callerType: "patient" | "doctor";
  receiverId: string;
  receiverName: string;
  receiverType: "patient" | "doctor";
  isIncoming?: boolean;
  onEndCall: () => void;
  onCallAccepted?: () => void;
  onCallRejected?: () => void;
}

// STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function MessagingCall({
  callType,
  roomId,
  callerId,
  callerName,
  callerType,
  receiverId,
  receiverName,
  receiverType,
  isIncoming = false,
  onEndCall,
  onCallAccepted,
  onCallRejected,
}: MessagingCallProps) {
  const [callState, setCallState] = useState<"ringing" | "connecting" | "connected" | "ended">(
    isIncoming ? "ringing" : "connecting"
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>(
    isIncoming ? "Incoming call..." : "Calling..."
  );

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const isVideoCall = callType === "video";
  const myId = isIncoming ? receiverId : callerId;
  const myName = isIncoming ? receiverName : callerName;
  const remoteName = isIncoming ? callerName : receiverName;
  const remoteType = isIncoming ? callerType : receiverType;

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Play ringtone
  const playRingtone = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(480, audioContext.currentTime + 0.2);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.log("Audio playback not supported");
    }
  }, []);

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: isVideoCall
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && isVideoCall) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error: any) {
      console.error("Media access error:", error);
      toast({
        title: "Permission Required",
        description: `Please allow access to ${isVideoCall ? "camera and microphone" : "microphone"}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [isVideoCall, toast]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await fetch("/api/call/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId,
              sender: myId,
              type: "ice-candidate",
              data: event.candidate,
            }),
          });
        } catch (error) {
          console.error("Error sending ICE candidate:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track", event.streams[0]);
      if (event.streams[0]) {
        if (isVideoCall && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
        setCallState("connected");
        setConnectionStatus("Connected");

        // Stop ringtone
        if (ringtoneIntervalRef.current) {
          clearInterval(ringtoneIntervalRef.current);
        }

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      switch (pc.connectionState) {
        case "connected":
          setConnectionStatus("Connected");
          setCallState("connected");
          break;
        case "disconnected":
          setConnectionStatus("Disconnected");
          break;
        case "failed":
          setConnectionStatus("Connection failed");
          toast({
            title: "Connection Failed",
            description: "Unable to establish connection",
            variant: "destructive",
          });
          break;
      }
    };

    return pc;
  }, [roomId, myId, isVideoCall, toast]);

  // Start call (create offer)
  const startCall = useCallback(async () => {
    try {
      setCallState("connecting");
      setConnectionStatus("Calling...");

      // Create room first
      await fetch("/api/call/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          callerId,
          callerName,
          callerType,
          receiverId,
          receiverName,
          receiverType,
          callType,
        }),
      });

      const stream = await initializeMedia();
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch("/api/call/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          sender: myId,
          type: "offer",
          data: offer,
        }),
      });

      setConnectionStatus("Ringing...");
      startSignalPolling();

      // Play calling sound
      ringtoneIntervalRef.current = setInterval(playRingtone, 2000);
    } catch (error) {
      console.error("Error starting call:", error);
      setConnectionStatus("Failed to start call");
      onEndCall();
    }
  }, [
    roomId,
    callerId,
    callerName,
    callerType,
    receiverId,
    receiverName,
    receiverType,
    callType,
    myId,
    initializeMedia,
    createPeerConnection,
    playRingtone,
    onEndCall,
  ]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    try {
      setCallState("connecting");
      setConnectionStatus("Connecting...");

      // Stop ringtone
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
      }

      const stream = await initializeMedia();
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      startSignalPolling();
      onCallAccepted?.();
    } catch (error) {
      console.error("Error accepting call:", error);
      onEndCall();
    }
  }, [initializeMedia, createPeerConnection, onCallAccepted, onEndCall]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    try {
      await fetch("/api/call/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          sender: myId,
          type: "reject",
          data: null,
        }),
      });
    } catch (error) {
      console.error("Error rejecting call:", error);
    }

    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
    }

    onCallRejected?.();
    onEndCall();
  }, [roomId, myId, onCallRejected, onEndCall]);

  // Handle incoming signals
  const handleSignal = useCallback(
    async (signal: { type: string; data: any; sender: string }) => {
      if (signal.sender === myId) return;

      const pc = peerConnectionRef.current;

      try {
        switch (signal.type) {
          case "offer":
            if (!pc) return;
            console.log("Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await fetch("/api/call/signal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId,
                sender: myId,
                type: "answer",
                data: answer,
              }),
            });
            break;

          case "answer":
            if (!pc) return;
            console.log("Received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
            break;

          case "ice-candidate":
            if (!pc) return;
            console.log("Received ICE candidate");
            if (signal.data) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.data));
            }
            break;

          case "end-call":
          case "reject":
            console.log("Call ended/rejected by remote");
            handleEndCall();
            break;

          case "accept":
            console.log("Call accepted");
            setConnectionStatus("Connecting...");
            break;
        }
      } catch (error) {
        console.error("Error handling signal:", error);
      }
    },
    [roomId, myId]
  );

  // Poll for signals
  const startSignalPolling = useCallback(() => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/call/signals/${roomId}?userId=${myId}`);
        const data = await response.json();

        if (data.signals && data.signals.length > 0) {
          for (const signal of data.signals) {
            await handleSignal(signal);
          }
        }
      } catch (error) {
        console.error("Error polling signals:", error);
      }
    }, 500);
  }, [roomId, myId, handleSignal]);

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current && isVideoCall) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // End call
  const handleEndCall = useCallback(async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    try {
      await fetch("/api/call/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          sender: myId,
          type: "end-call",
          data: null,
        }),
      });
    } catch (error) {
      console.error("Error sending end-call signal:", error);
    }

    onEndCall();
  }, [roomId, myId, onEndCall]);

  // Initialize on mount
  useEffect(() => {
    if (!isIncoming) {
      startCall();
    } else {
      // Play incoming ringtone
      ringtoneIntervalRef.current = setInterval(playRingtone, 1500);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (ringtoneIntervalRef.current) clearInterval(ringtoneIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Incoming call UI
  if (callState === "ringing" && isIncoming) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
            <Avatar className="h-32 w-32 mx-auto relative">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white text-4xl">
                {remoteType === "doctor" ? (
                  <Stethoscope className="h-16 w-16" />
                ) : (
                  <User className="h-16 w-16" />
                )}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="text-white text-2xl font-semibold mb-2">
            {remoteType === "doctor" ? "Dr. " : ""}
            {remoteName}
          </h2>
          <p className="text-gray-400 mb-8">
            Incoming {callType} call...
          </p>

          <div className="flex items-center justify-center gap-8">
            <Button
              onClick={rejectCall}
              className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
            <Button
              onClick={acceptCall}
              className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-8 w-8" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Audio call UI
  if (!isVideoCall) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center"
      >
        {/* Hidden audio element */}
        <audio ref={remoteAudioRef} autoPlay />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Badge className={callState === "connected" ? "bg-green-500" : "bg-yellow-500"}>
            {connectionStatus}
          </Badge>
          {callState === "connected" && (
            <span className="text-white">{formatDuration(callDuration)}</span>
          )}
        </div>

        {/* Avatar and info */}
        <div className="text-center mb-12">
          <div className="relative mb-6">
            {callState === "connecting" && (
              <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
            )}
            <Avatar className="h-40 w-40 mx-auto relative">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white text-5xl">
                {remoteType === "doctor" ? (
                  <Stethoscope className="h-20 w-20" />
                ) : (
                  <User className="h-20 w-20" />
                )}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="text-white text-3xl font-semibold mb-2">
            {remoteType === "doctor" ? "Dr. " : ""}
            {remoteName}
          </h2>
          <p className="text-gray-400">Audio Call</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <Button
            onClick={toggleMute}
            className={`h-14 w-14 rounded-full ${
              isMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            onClick={handleEndCall}
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </div>
    );
  }

  // Video call UI
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white">
              {remoteType === "doctor" ? (
                <Stethoscope className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-white font-semibold">
              {remoteType === "doctor" ? "Dr. " : ""}
              {remoteName}
            </h3>
            <div className="flex items-center gap-2">
              <Badge className={callState === "connected" ? "bg-green-500" : "bg-yellow-500"}>
                {connectionStatus}
              </Badge>
              {callState === "connected" && (
                <span className="text-gray-400 text-sm">{formatDuration(callDuration)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Remote Video */}
        <div className="relative w-full h-full max-w-5xl rounded-2xl overflow-hidden bg-gray-800">
          {callState !== "connected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                {remoteType === "doctor" ? (
                  <Stethoscope className="h-12 w-12 text-white" />
                ) : (
                  <User className="h-12 w-12 text-white" />
                )}
              </div>
              <p className="text-white text-xl font-medium">{connectionStatus}</p>
            </div>
          )}

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${callState !== "connected" ? "hidden" : "block"}`}
          />

          {callState === "connected" && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
              <span className="text-white text-sm">
                {remoteType === "doctor" ? "Dr. " : ""}
                {remoteName}
              </span>
            </div>
          )}
        </div>

        {/* Local Video (PiP) */}
        <div className="absolute bottom-8 right-8 w-48 h-36 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 bg-gray-800">
          {isVideoOff ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-400 text-xs">Camera Off</p>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
            <span className="text-white text-xs">You</span>
            {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 bg-gray-800/80 backdrop-blur">
        <Button
          onClick={toggleMute}
          className={`h-14 w-14 rounded-full ${
            isMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          onClick={toggleVideo}
          className={`h-14 w-14 rounded-full ${
            isVideoOff ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>

        <Button
          onClick={handleEndCall}
          className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
}
