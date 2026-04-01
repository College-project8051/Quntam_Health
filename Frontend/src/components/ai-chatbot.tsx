import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Headphones,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  MessageCircle,
  Calendar,
  FileText,
  Stethoscope,
  HelpCircle,
  Shield,
  Share2,
  Clock,
  UserPlus,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  relatedQuestions?: string[];
}

interface SuggestedQuestion {
  icon: React.ReactNode;
  text: string;
}

interface AIChatbotProps {
  userId: string;
  userName: string;
}

const initialSuggestions: SuggestedQuestion[] = [
  {
    icon: <Calendar className="h-4 w-4" />,
    text: "How can I book an appointment with a doctor?",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    text: "How do I view my medical records?",
  },
  {
    icon: <Stethoscope className="h-4 w-4" />,
    text: "Which doctors are available today?",
  },
  {
    icon: <MessageCircle className="h-4 w-4" />,
    text: "How can I message my doctor?",
  },
  {
    icon: <Shield className="h-4 w-4" />,
    text: "How is my data protected on this platform?",
  },
];

// Topic-based follow-up suggestions
const topicSuggestions: Record<string, string[]> = {
  appointment: [
    "How do I cancel or reschedule an appointment?",
    "Can I book a video consultation?",
    "How do I check my appointment history?",
    "What happens after I book an appointment?",
  ],
  document: [
    "How do I share my documents with a doctor?",
    "Are my documents encrypted?",
    "How do I upload a new document?",
    "Can I revoke access to my documents?",
  ],
  doctor: [
    "How do I find a specialist?",
    "Can I see doctor availability before booking?",
    "How do I message a doctor?",
    "Which doctors are available?",
  ],
  message: [
    "Are my messages encrypted?",
    "Can I send attachments in messages?",
    "How do I start a new conversation?",
    "Will I get notified of new messages?",
  ],
  security: [
    "How does quantum encryption work?",
    "Who can access my medical records?",
    "How is my data protected?",
    "What is blockchain verification?",
  ],
  suggestion: [
    "How do I view all doctor suggestions?",
    "Can I message a doctor about their suggestion?",
    "What do the priority levels mean?",
    "How do I follow up on a prescription?",
  ],
  share: [
    "How do I grant access to a doctor?",
    "Can I see who viewed my documents?",
    "How do I revoke document access?",
    "Is sharing my documents secure?",
  ],
  logout: [
    "How do I update my profile?",
    "How do I change my password?",
    "Is my session secure?",
    "How do I enable notifications?",
  ],
  profile: [
    "How do I logout securely?",
    "How do I add emergency contacts?",
    "Can I update my medical notes?",
    "How do I change my email?",
  ],
  notification: [
    "How do I mute notification sounds?",
    "What notifications will I receive?",
    "How do I clear all notifications?",
    "Can I get email notifications?",
  ],
  general: [
    "Which doctors are available?",
    "How do I book an appointment?",
    "How do I update my profile?",
    "How is my data protected?",
  ],
};

// Detect topic from message
const detectTopic = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("logout") || lowerMessage.includes("log out") || lowerMessage.includes("sign out")) {
    return "logout";
  }
  if (lowerMessage.includes("profile") || lowerMessage.includes("update my") || lowerMessage.includes("change my")) {
    return "profile";
  }
  if (lowerMessage.includes("notification") || lowerMessage.includes("alert") || lowerMessage.includes("notify")) {
    return "notification";
  }
  if (lowerMessage.includes("appointment") || lowerMessage.includes("book") || lowerMessage.includes("schedule")) {
    return "appointment";
  }
  if (lowerMessage.includes("document") || lowerMessage.includes("record") || lowerMessage.includes("upload") || lowerMessage.includes("file")) {
    return "document";
  }
  if (lowerMessage.includes("doctor") || lowerMessage.includes("specialist") || lowerMessage.includes("available")) {
    return "doctor";
  }
  if (lowerMessage.includes("message") || lowerMessage.includes("chat") || lowerMessage.includes("contact")) {
    return "message";
  }
  if (lowerMessage.includes("security") || lowerMessage.includes("encrypt") || lowerMessage.includes("safe") || lowerMessage.includes("quantum")) {
    return "security";
  }
  if (lowerMessage.includes("suggestion") || lowerMessage.includes("recommendation") || lowerMessage.includes("advice") || lowerMessage.includes("prescription")) {
    return "suggestion";
  }
  if (lowerMessage.includes("share") || lowerMessage.includes("access") || lowerMessage.includes("grant") || lowerMessage.includes("revoke")) {
    return "share";
  }

  return "general";
};

// Get icon for suggestion
const getIconForSuggestion = (text: string): React.ReactNode => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("logout") || lowerText.includes("sign out") || lowerText.includes("session")) {
    return <Shield className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("profile") || lowerText.includes("update") || lowerText.includes("change")) {
    return <User className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("notification") || lowerText.includes("alert") || lowerText.includes("mute")) {
    return <Bot className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("appointment") || lowerText.includes("book") || lowerText.includes("schedule")) {
    return <Calendar className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("document") || lowerText.includes("record") || lowerText.includes("upload")) {
    return <FileText className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("doctor") || lowerText.includes("specialist") || lowerText.includes("available")) {
    return <Stethoscope className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("message") || lowerText.includes("chat")) {
    return <MessageCircle className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("security") || lowerText.includes("encrypt") || lowerText.includes("protected")) {
    return <Shield className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("share") || lowerText.includes("access")) {
    return <Share2 className="h-3.5 w-3.5" />;
  }
  if (lowerText.includes("history") || lowerText.includes("time")) {
    return <Clock className="h-3.5 w-3.5" />;
  }

  return <HelpCircle className="h-3.5 w-3.5" />;
};

export default function AIChatbot({ userId, userName }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [lastTopic, setLastTopic] = useState<string>("general");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto greeting when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: `Hi ${userName}! 👋 I'm Quantum AI, your dedicated assistant for the Quantum Healthcare platform.\n\n**I can help you with:**\n• 📅 Booking appointments with doctors\n• 📋 Viewing and managing your medical records\n• 👨‍⚕️ Finding available doctors\n• 💬 Messaging healthcare providers\n• 🔐 Understanding our security features\n\nHow can I assist you today?`,
        timestamp: new Date(),
      };
      setMessages([greetingMessage]);
    }
  }, [isOpen, userName]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Detect topic from user message
    const topic = detectTopic(text);
    setLastTopic(topic);

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setCurrentSuggestions([]); // Clear suggestions while loading
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        userId,
        message: text,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const data = await response.json();

      // Get related suggestions based on topic
      const relatedQuestions = topicSuggestions[topic] || topicSuggestions.general;
      // Shuffle and pick 3 suggestions
      const shuffled = [...relatedQuestions].sort(() => Math.random() - 0.5);
      const selectedSuggestions = shuffled.slice(0, 3);

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_ai`,
        role: "assistant",
        content: data.response || "I apologize, but I couldn't process your request. Please try again.",
        timestamp: new Date(),
        relatedQuestions: selectedSuggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentSuggestions(selectedSuggestions);
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again later or contact support if the issue persists.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentSuggestions(topicSuggestions.general.slice(0, 3));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (question: string) => {
    handleSend(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Floating AI Support Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center ring-4 ring-purple-400/30 ${
          isOpen ? "hidden" : "flex"
        }`}
        title="AI Support"
      >
        <div className="relative">
          <Headphones className="h-8 w-8" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>
      </button>

      {/* Floating label */}
      {!isOpen && (
        <div className="fixed bottom-24 right-6 z-50 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-bounce">
          AI Support
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] animate-in slide-in-from-bottom-5 duration-300">
          <Card className="flex flex-col h-[600px] max-h-[calc(100vh-100px)] shadow-2xl border-0 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                  <Bot className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Quantum AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                    <p className="text-xs text-purple-100">Online • Ready to help</p>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 bg-gradient-to-b from-gray-50 to-white">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white"
                          : "bg-gradient-to-br from-purple-500 to-blue-600 text-white ring-2 ring-purple-200"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm shadow-lg"
                          : "bg-white text-gray-800 shadow-md border border-gray-100 rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === "user" ? "text-purple-200" : "text-gray-400"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-purple-200">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-md border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-gray-500">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Initial Suggested Questions - Show only at start */}
                {messages.length <= 1 && !isLoading && (
                  <div className="mt-4">
                    <p className="text-xs text-purple-600 mb-3 font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Quick suggestions:
                    </p>
                    <div className="space-y-2">
                      {initialSuggestions.map((q, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(q.text)}
                          className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-white border-2 border-purple-100 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md transition-all text-sm text-gray-700 group"
                        >
                          <span className="text-purple-500 group-hover:scale-110 transition-transform">{q.icon}</span>
                          <span className="flex-1">{q.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Follow-up Suggestions - Show after AI response */}
                {!isLoading && currentSuggestions.length > 0 && messages.length > 1 && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                    <p className="text-xs text-purple-700 mb-3 font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      You might also ask:
                    </p>
                    <div className="space-y-2">
                      {currentSuggestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(question)}
                          className="flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg bg-white border border-purple-200 hover:border-purple-400 hover:bg-purple-50 hover:shadow-sm transition-all text-sm text-gray-700 group"
                        >
                          <span className="text-purple-500 group-hover:scale-110 transition-transform">{getIconForSuggestion(question)}</span>
                          <span className="flex-1">{question}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-white shadow-inner">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 h-12 rounded-xl border-purple-200 focus:border-purple-400 focus:ring-purple-400 text-base px-4"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="h-12 w-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-400" />
                Powered by Quantum AI
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
