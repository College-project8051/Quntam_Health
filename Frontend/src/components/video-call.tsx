import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Monitor,
  MessageSquare,
  Users,
  Maximize2,
  Minimize2,
  Settings,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  userType: "patient" | "doctor";
  remoteName: string;
  onEndCall: () => void;
}

// STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function VideoCall({
  roomId,
  userId,
  userName,
  userType,
  remoteName,
  onEndCall,
}: VideoCallProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error: any) {
      console.error("Media access error:", error);
      toast({
        title: "Camera/Microphone Error",
        description: "Please allow access to camera and microphone",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        // Send ICE candidate to signaling server
        try {
          await apiRequest("POST", "/api/video/signal", {
            roomId,
            sender: userId,
            type: "ice-candidate",
            data: event.candidate,
          });
        } catch (error) {
          console.error("Error sending ICE candidate:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track");
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus("Connected");

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
          setIsConnected(true);
          setIsConnecting(false);
          break;
        case "disconnected":
          setConnectionStatus("Disconnected");
          setIsConnected(false);
          break;
        case "failed":
          setConnectionStatus("Connection failed");
          toast({
            title: "Connection Failed",
            description: "Unable to establish video connection",
            variant: "destructive",
          });
          break;
        case "connecting":
          setConnectionStatus("Connecting...");
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    return pc;
  }, [roomId, userId, toast]);

  // Start call (create offer)
  const startCall = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus("Initializing...");

      const stream = await initializeMedia();
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to signaling server
      await apiRequest("POST", "/api/video/signal", {
        roomId,
        sender: userId,
        type: "offer",
        data: offer,
      });

      setConnectionStatus("Waiting for other participant...");

      // Start polling for signals
      startSignalPolling();
    } catch (error) {
      console.error("Error starting call:", error);
      setIsConnecting(false);
      setConnectionStatus("Failed to start call");
    }
  }, [initializeMedia, createPeerConnection, roomId, userId]);

  // Handle incoming signals
  const handleSignal = useCallback(
    async (signal: { type: string; data: any; sender: string }) => {
      if (signal.sender === userId) return; // Ignore own signals

      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        switch (signal.type) {
          case "offer":
            console.log("Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer
            await apiRequest("POST", "/api/video/signal", {
              roomId,
              sender: userId,
              type: "answer",
              data: answer,
            });
            break;

          case "answer":
            console.log("Received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
            break;

          case "ice-candidate":
            console.log("Received ICE candidate");
            if (signal.data) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.data));
            }
            break;

          case "end-call":
            console.log("Remote user ended call");
            handleEndCall();
            break;
        }
      } catch (error) {
        console.error("Error handling signal:", error);
      }
    },
    [roomId, userId]
  );

  // Poll for signals
  const startSignalPolling = useCallback(() => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/video/signals/${roomId}?userId=${userId}`
        );
        const data = await response.json();

        if (data.signals && data.signals.length > 0) {
          for (const signal of data.signals) {
            await handleSignal(signal);
          }
        }
      } catch (error) {
        console.error("Error polling signals:", error);
      }
    }, 1000);
  }, [roomId, userId, handleSignal]);

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
    if (localStreamRef.current) {
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
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Notify server
    try {
      await apiRequest("POST", "/api/video/signal", {
        roomId,
        sender: userId,
        type: "end-call",
        data: null,
      });
    } catch (error) {
      console.error("Error sending end-call signal:", error);
    }

    onEndCall();
  }, [roomId, userId, onEndCall]);

  // Initialize call on mount
  useEffect(() => {
    // Join room first
    const joinRoom = async () => {
      try {
        await apiRequest("POST", "/api/video/join", {
          roomId,
          userId,
          userName,
          userType,
        });
        await startCall();
      } catch (error) {
        console.error("Error joining room:", error);
        toast({
          title: "Error",
          description: "Failed to join video call",
          variant: "destructive",
        });
      }
    };

    joinRoom();

    // Cleanup on unmount
    return () => {
      handleEndCall();
    };
  }, []);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Video className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">
              Video Consultation with {remoteName}
            </h3>
            <div className="flex items-center gap-2">
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={isConnected ? "bg-green-500" : "bg-yellow-500"}
              >
                {connectionStatus}
              </Badge>
              {isConnected && (
                <span className="text-gray-400 text-sm">
                  {formatDuration(callDuration)}
                </span>
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
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Remote Video (Large) */}
        <div className="relative w-full h-full max-w-5xl rounded-2xl overflow-hidden bg-gray-800">
          {isConnecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <Users className="h-12 w-12 text-white" />
              </div>
              <p className="text-white text-xl font-medium">{connectionStatus}</p>
              <p className="text-gray-400 mt-2">Waiting for {remoteName} to join...</p>
            </div>
          )}

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${
              isConnecting ? "hidden" : "block"
            }`}
          />

          {/* Remote user info overlay */}
          {isConnected && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
              <span className="text-white text-sm">{remoteName}</span>
              {isRemoteMuted && <MicOff className="h-4 w-4 text-red-400" />}
            </div>
          )}
        </div>

        {/* Local Video (Small - Picture in Picture) */}
        <div className="absolute bottom-8 right-8 w-64 h-48 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 bg-gray-800">
          {isVideoOff ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
              <div className="h-16 w-16 rounded-full bg-purple-600 flex items-center justify-center mb-2">
                <VideoOff className="h-8 w-8 text-white" />
              </div>
              <p className="text-gray-400 text-sm">Camera Off</p>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          )}

          {/* Local user label */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
            <span className="text-white text-xs">You</span>
            {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 bg-gray-800/80 backdrop-blur">
        {/* Mute Button */}
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          onClick={toggleMute}
          className={`h-14 w-14 rounded-full ${
            isMuted
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        {/* Video Toggle Button */}
        <Button
          variant={isVideoOff ? "destructive" : "secondary"}
          size="lg"
          onClick={toggleVideo}
          className={`h-14 w-14 rounded-full ${
            isVideoOff
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isVideoOff ? (
            <VideoOff className="h-6 w-6" />
          ) : (
            <Video className="h-6 w-6" />
          )}
        </Button>

        {/* End Call Button */}
        <Button
          variant="destructive"
          size="lg"
          onClick={handleEndCall}
          className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>

      {/* CSS for mirroring local video */}
      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
