import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Shield,
  User,
  Stethoscope,
  PhoneCall,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessagingCall from "./MessagingCall";

// Message notification sound
const playMessageSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Soft pop sound
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (error) {
    console.log('Audio playback not supported');
  }
};

interface Conversation {
  id: string;
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserType: string;
  otherUserSpecialty?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
}

interface MessagingProps {
  userId: string;
  userType: string;
  userName: string;
  initialDoctorId?: string;
  initialDoctorName?: string;
}

interface CallState {
  isActive: boolean;
  callType: "audio" | "video";
  roomId: string;
  isIncoming: boolean;
  callerInfo?: {
    id: string;
    name: string;
    type: "patient" | "doctor";
  };
}

export function Messaging({ userId, userType, userName, initialDoctorId, initialDoctorName }: MessagingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef<number>(0);
  const isInitialMessageLoad = useRef(true);

  // Call state
  const [callState, setCallState] = useState<CallState | null>(null);

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const conversations: Conversation[] = conversationsData?.conversations || [];

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", selectedConversation?.conversationId],
    queryFn: async () => {
      if (!selectedConversation?.conversationId) return { messages: [] };
      const res = await fetch(
        `/api/messages/${selectedConversation.conversationId}?userId=${userId}`
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      // Refresh conversations to update unread count
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      return data;
    },
    enabled: !!selectedConversation?.conversationId,
    refetchInterval: 5000, // Refresh every 5 seconds when in conversation
  });

  const messages: Message[] = messagesData?.messages || [];

  // Play sound when new messages arrive from other user
  useEffect(() => {
    if (!messages.length) return;

    // Skip on initial load
    if (isInitialMessageLoad.current) {
      isInitialMessageLoad.current = false;
      previousMessageCount.current = messages.length;
      return;
    }

    // Check if there are new messages
    if (messages.length > previousMessageCount.current) {
      // Check if the last message is from someone else
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.senderId !== userId) {
        playMessageSound();
      }
    }

    previousMessageCount.current = messages.length;
  }, [messages.length, userId]);

  // Reset message count when changing conversations
  useEffect(() => {
    isInitialMessageLoad.current = true;
    previousMessageCount.current = 0;
  }, [selectedConversation?.conversationId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: userId,
          receiverId: selectedConversation?.otherUserId,
          content,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation?.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      setMessageInput("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Create conversation mutation (for starting new chats)
  const createConversationMutation = useMutation({
    mutationFn: async ({ patientId, doctorId }: { patientId: string; doctorId: string }) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, doctorId }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      // Set the new conversation as selected
      if (data.conversation) {
        setSelectedConversation({
          id: data.conversation.id,
          conversationId: data.conversation.conversationId,
          otherUserId: userType === 'patient' ? data.conversation.doctorId : data.conversation.patientId,
          otherUserName: userType === 'patient' ? data.conversation.doctorName : data.conversation.patientName,
          otherUserType: userType === 'patient' ? 'doctor' : 'patient',
          unreadCount: 0,
        });
      }
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start conversation with initial doctor if provided
  useEffect(() => {
    if (initialDoctorId && initialDoctorName && !selectedConversation) {
      const existingConv = conversations.find(c => c.otherUserId === initialDoctorId);
      if (existingConv) {
        setSelectedConversation(existingConv);
      } else if (userType === 'patient') {
        createConversationMutation.mutate({
          patientId: userId,
          doctorId: initialDoctorId,
        });
      }
    }
  }, [initialDoctorId, initialDoctorName, conversations]);

  const handleSendMessage = () => {
    if (messageInput.trim() && selectedConversation) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start a call
  const startCall = (type: "audio" | "video") => {
    if (!selectedConversation) return;

    const roomId = `call_${userId}_${selectedConversation.otherUserId}_${Date.now()}`;

    setCallState({
      isActive: true,
      callType: type,
      roomId,
      isIncoming: false,
    });

    toast({
      title: `Starting ${type} call`,
      description: `Calling ${selectedConversation.otherUserType === 'doctor' ? 'Dr. ' : ''}${selectedConversation.otherUserName}...`,
    });
  };

  // End call
  const endCall = () => {
    setCallState(null);
  };

  // Poll for incoming calls
  useEffect(() => {
    const checkIncomingCalls = async () => {
      try {
        const response = await fetch(`/api/call/incoming/${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.call && !callState) {
            setCallState({
              isActive: true,
              callType: data.call.callType,
              roomId: data.call.roomId,
              isIncoming: true,
              callerInfo: {
                id: data.call.callerId,
                name: data.call.callerName,
                type: data.call.callerType,
              },
            });
          }
        }
      } catch (error) {
        // Silently fail - endpoint may not exist yet
      }
    };

    const interval = setInterval(checkIncomingCalls, 3000);
    return () => clearInterval(interval);
  }, [userId, callState]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUserName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-200px)] flex bg-background rounded-lg overflow-hidden border">
      {/* Conversations List */}
      <div className={`w-full md:w-80 border-r flex flex-col ${selectedConversation ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </h2>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Encrypted
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm mt-2">
                {userType === 'patient'
                  ? "Start a conversation with a doctor from the Find Doctors page"
                  : "Patients will message you here"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={conv.otherUserType === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}>
                        {conv.otherUserType === 'doctor' ? (
                          <Stethoscope className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">
                          {conv.otherUserType === 'doctor' ? 'Dr. ' : ''}{conv.otherUserName}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      {conv.otherUserSpecialty && (
                        <p className="text-xs text-muted-foreground">{conv.otherUserSpecialty}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage || "No messages yet"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={selectedConversation.otherUserType === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}>
                    {selectedConversation.otherUserType === 'doctor' ? (
                      <Stethoscope className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedConversation.otherUserType === 'doctor' ? 'Dr. ' : ''}
                    {selectedConversation.otherUserName}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3 text-green-500" />
                    End-to-end encrypted
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startCall("audio")}
                  title="Start audio call"
                  className="hover:bg-green-100 hover:text-green-600"
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startCall("video")}
                  title="Start video call"
                  className="hover:bg-blue-100 hover:text-blue-600"
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Send a message to start the conversation</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderId === userId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <span className="text-xs">
                              {formatTime(message.createdAt)}
                            </span>
                            {isOwnMessage && (
                              message.isRead ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Select a conversation</h3>
              <p className="text-sm mt-2">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Component */}
      {callState?.isActive && selectedConversation && (
        <MessagingCall
          callType={callState.callType}
          roomId={callState.roomId}
          callerId={callState.isIncoming ? callState.callerInfo!.id : userId}
          callerName={callState.isIncoming ? callState.callerInfo!.name : userName}
          callerType={callState.isIncoming ? callState.callerInfo!.type : (userType as "patient" | "doctor")}
          receiverId={callState.isIncoming ? userId : selectedConversation.otherUserId}
          receiverName={callState.isIncoming ? userName : selectedConversation.otherUserName}
          receiverType={callState.isIncoming ? (userType as "patient" | "doctor") : (selectedConversation.otherUserType as "patient" | "doctor")}
          isIncoming={callState.isIncoming}
          onEndCall={endCall}
          onCallAccepted={() => {
            toast({
              title: "Call connected",
              description: "You are now connected",
            });
          }}
          onCallRejected={() => {
            toast({
              title: "Call rejected",
              description: "The call was declined",
            });
          }}
        />
      )}
    </div>
  );
}

export default Messaging;
