import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  LogIn,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Stethoscope,
  Heart,
  MapPin
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  resetPassword
} from "@/lib/firebase";
import type { User } from "@/App";

interface LoginProps {
  onLogin: (user: User, isNewRegistration?: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [selectedType, setSelectedType] = useState<"patient" | "doctor" | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // State for Google login additional info form
  const [showAdditionalInfoForm, setShowAdditionalInfoForm] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [pendingUserType, setPendingUserType] = useState<"patient" | "doctor">("patient");
  const [additionalInfo, setAdditionalInfo] = useState({
    name: "",
    aadhaarNumber: "",
    city: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    aadhaarNumber: "",
    city: "",
  });

  const { toast } = useToast();

  // Sync with backend after Firebase auth
  const syncWithBackend = async (
    firebaseUser: any,
    userType: string,
    additionalData?: { name: string; aadhaarNumber: string; city: string }
  ) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        name: additionalData?.name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        aadhaarNumber: additionalData?.aadhaarNumber,
        userType: userType,
        city: additionalData?.city,
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
      });
      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error("Backend sync error:", error);
      throw error;
    }
  };

  // Check if Google user exists in backend
  const checkGoogleUser = async (firebaseUser: any, userType: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/check-google-user", {
        firebaseUid: firebaseUser.uid,
        userType: userType,
      });
      return await response.json();
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error("Failed to check user");
    }
  };

  // Email login mutation
  const emailLoginMutation = useMutation({
    mutationFn: async (data: typeof loginData & { userType: "patient" | "doctor" }) => {
      const userCredential = await loginWithEmail(data.email, data.password);
      const user = await syncWithBackend(userCredential.user, data.userType);
      return user;
    },
    onSuccess: (user) => {
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.name}!`,
      });
      onLogin(user);
    },
    onError: (error: any) => {
      let message = error.message || "Login failed";
      if (error.code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (error.code === "auth/user-not-found") {
        message = "No account found with this email";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password";
      }
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Email register mutation
  const emailRegisterMutation = useMutation({
    mutationFn: async (data: typeof registerData & { userType: "patient" | "doctor" }) => {
      if (data.password !== data.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (data.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (!data.aadhaarNumber || data.aadhaarNumber.length !== 12) {
        throw new Error("Please enter valid 12-digit Aadhaar number");
      }
      if (!data.city || !data.city.trim()) {
        throw new Error("Please enter your city");
      }

      const userCredential = await registerWithEmail(data.email, data.password, data.name);
      const user = await syncWithBackend(userCredential.user, data.userType, {
        name: data.name,
        aadhaarNumber: data.aadhaarNumber,
        city: data.city.trim(),
      });
      return user;
    },
    onSuccess: (user) => {
      toast({
        title: "Registration Successful",
        description: `Welcome, ${user.name}! Your ID: ${user.generatedId}`,
      });
      onLogin(user, true); // New registration - needs profile completion
    },
    onError: (error: any) => {
      let message = error.message || "Registration failed";
      if (error.code === "auth/email-already-in-use") {
        message = "An account with this email already exists";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak. Use at least 8 characters";
      }
      toast({
        title: "Registration Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Google login mutation
  const googleLoginMutation = useMutation({
    mutationFn: async (userType: "patient" | "doctor") => {
      const userCredential = await loginWithGoogle();
      const checkResult = await checkGoogleUser(userCredential.user, userType);

      if (checkResult.exists && checkResult.user) {
        return { user: checkResult.user, needsAdditionalInfo: false };
      }

      return {
        needsAdditionalInfo: true,
        firebaseUser: userCredential.user,
        userType: userType,
      };
    },
    onSuccess: (result) => {
      if (result.needsAdditionalInfo) {
        setPendingGoogleUser(result.firebaseUser);
        setPendingUserType(result.userType as "patient" | "doctor");
        setAdditionalInfo({
          name: result.firebaseUser.displayName || "",
          aadhaarNumber: "",
          city: "",
        });
        setShowAdditionalInfoForm(true);
      } else if (result.user) {
        toast({
          title: "Login Successful",
          description: `Welcome, ${result.user.name}!`,
        });
        onLogin(result.user);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Google Login Failed",
        description: error.message || "Could not sign in with Google",
        variant: "destructive",
      });
    },
  });

  // Complete Google registration
  const completeGoogleRegistration = useMutation({
    mutationFn: async () => {
      if (!pendingGoogleUser) throw new Error("No pending Google user");

      if (!additionalInfo.name.trim()) {
        throw new Error("Name is required");
      }
      if (!additionalInfo.aadhaarNumber || additionalInfo.aadhaarNumber.length !== 12) {
        throw new Error("Please enter a valid 12-digit Aadhaar number");
      }
      if (!additionalInfo.city.trim()) {
        throw new Error("City is required");
      }

      const user = await syncWithBackend(pendingGoogleUser, pendingUserType, {
        name: additionalInfo.name.trim(),
        aadhaarNumber: additionalInfo.aadhaarNumber,
        city: additionalInfo.city.trim(),
      });
      return user;
    },
    onSuccess: (user) => {
      toast({
        title: "Registration Successful",
        description: `Welcome, ${user.name}! Your ID: ${user.generatedId}`,
      });
      setShowAdditionalInfoForm(false);
      setPendingGoogleUser(null);
      onLogin(user, true); // New Google registration - needs profile completion
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Could not complete registration",
        variant: "destructive",
      });
    },
  });

  // Password reset
  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your inbox for password reset instructions",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not send reset email",
        variant: "destructive",
      });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (!selectedType) return;
    emailLoginMutation.mutate({ ...loginData, userType: selectedType });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.email || !registerData.password || !registerData.aadhaarNumber || !registerData.city) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (!selectedType) return;
    emailRegisterMutation.mutate({ ...registerData, userType: selectedType });
  };

  // Additional info form for Google login
  if (showAdditionalInfoForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-8">
            <button
              onClick={() => {
                setShowAdditionalInfoForm(false);
                setPendingGoogleUser(null);
              }}
              className="flex items-center text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>

            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                {pendingUserType === "doctor" ? (
                  <Stethoscope className="h-8 w-8 text-white" />
                ) : (
                  <Heart className="h-8 w-8 text-white" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
              <p className="text-slate-500 mt-2">
                Registering as{" "}
                <span className="font-semibold text-teal-600 capitalize">{pendingUserType}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-2">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Enter your full name"
                    value={additionalInfo.name}
                    onChange={(e) => setAdditionalInfo({ ...additionalInfo, name: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Aadhaar Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Enter 12-digit Aadhaar number"
                  value={additionalInfo.aadhaarNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").substring(0, 12);
                    setAdditionalInfo({ ...additionalInfo, aadhaarNumber: value });
                  }}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {additionalInfo.aadhaarNumber.length}/12 digits
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  City <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Enter your city"
                    value={additionalInfo.city}
                    onChange={(e) => setAdditionalInfo({ ...additionalInfo, city: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={() => completeGoogleRegistration.mutate()}
                disabled={completeGoogleRegistration.isPending}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 mt-4"
              >
                {completeGoogleRegistration.isPending ? "Creating Account..." : "Complete Registration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-8">
            <button
              onClick={() => setShowForgotPassword(false)}
              className="flex items-center text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </button>

            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
              <p className="text-slate-500 mt-2">Enter your email to receive reset instructions</p>
            </div>

            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-slate-600">
                  We've sent a password reset link to <strong>{resetEmail}</strong>
                </p>
                <Button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                    setResetEmail("");
                  }}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <Button onClick={handlePasswordReset} className="w-full bg-teal-600 hover:bg-teal-700">
                  Send Reset Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main login page with toggle
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute bottom-0 left-0 w-64 h-64 opacity-20">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {[...Array(8)].map((_, i) => (
            <rect
              key={i}
              x={i * 25}
              y={200 - (i + 1) * 25}
              width="20"
              height={(i + 1) * 25}
              fill="currentColor"
              className="text-teal-300"
            />
          ))}
        </svg>
      </div>

      {/* Back to home */}
      <div className="absolute top-4 left-4 z-20">
        <Link href="/">
          <button className="flex items-center text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </button>
        </Link>
      </div>

      {/* Header */}
      <div className="text-center pt-8 pb-4">
        <h1 className="text-4xl font-bold text-white tracking-wide">QuantumHealth</h1>
        <p className="text-teal-200 mt-2">Secure Medical Data Management</p>
      </div>

      <div className="flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-8">

          {/* Selection Cards */}
          <div className={`flex flex-col sm:flex-row gap-6 transition-all duration-500 ease-in-out ${
            selectedType ? 'lg:w-1/2' : 'lg:w-full justify-center'
          }`}>

            {/* Patient Card */}
            <div
              onClick={() => setSelectedType(selectedType === "patient" ? null : "patient")}
              className={`
                relative cursor-pointer rounded-3xl overflow-hidden transition-all duration-500 ease-in-out
                ${selectedType === "patient"
                  ? 'bg-white scale-105 shadow-2xl ring-4 ring-blue-400'
                  : selectedType === "doctor"
                    ? 'bg-white/10 backdrop-blur scale-95 opacity-60 hover:opacity-80'
                    : 'bg-white/10 backdrop-blur hover:bg-white/20 hover:scale-105'
                }
                w-full sm:w-64 h-72
              `}
            >
              <div className="h-full flex flex-col">
                {/* Image Container */}
                <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-blue-100 to-blue-50">
                  <img
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=300&fit=crop&crop=faces"
                    alt="Patient"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  {/* Fallback icon */}
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                    <Heart className="w-20 h-20 text-blue-400" />
                  </div>
                </div>

                {/* Label */}
                <div className={`p-4 text-center ${
                  selectedType === "patient" ? 'bg-blue-600' : 'bg-black/20'
                }`}>
                  <h2 className="text-xl font-bold text-white">Patient</h2>
                  {selectedType === "patient" && (
                    <p className="text-blue-200 text-sm mt-1">Selected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Doctor Card */}
            <div
              onClick={() => setSelectedType(selectedType === "doctor" ? null : "doctor")}
              className={`
                relative cursor-pointer rounded-3xl overflow-hidden transition-all duration-500 ease-in-out
                ${selectedType === "doctor"
                  ? 'bg-white scale-105 shadow-2xl ring-4 ring-teal-400'
                  : selectedType === "patient"
                    ? 'bg-white/10 backdrop-blur scale-95 opacity-60 hover:opacity-80'
                    : 'bg-white/10 backdrop-blur hover:bg-white/20 hover:scale-105'
                }
                w-full sm:w-64 h-72
              `}
            >
              <div className="h-full flex flex-col">
                {/* Image Container */}
                <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-teal-100 to-teal-50">
                  <img
                    src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop&crop=faces"
                    alt="Doctor"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  {/* Fallback icon */}
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
                    <Stethoscope className="w-20 h-20 text-teal-400" />
                  </div>
                </div>

                {/* Label */}
                <div className={`p-4 text-center ${
                  selectedType === "doctor" ? 'bg-teal-600' : 'bg-black/20'
                }`}>
                  <h2 className="text-xl font-bold text-white">Doctor</h2>
                  {selectedType === "doctor" && (
                    <p className="text-teal-200 text-sm mt-1">Selected</p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Login/Register Form - Slides in from right */}
          <div className={`
            transition-all duration-500 ease-in-out overflow-hidden
            ${selectedType
              ? 'lg:w-1/2 opacity-100 translate-x-0'
              : 'lg:w-0 opacity-0 translate-x-full lg:translate-x-0'
            }
          `}>
            {selectedType && (
              <Card className="w-full max-w-sm mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur animate-in slide-in-from-right duration-500 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Compact Form Header */}
                  <div className={`px-6 py-4 ${
                    selectedType === "doctor"
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                        {selectedType === "doctor" ? (
                          <Stethoscope className="h-5 w-5 text-white" />
                        ) : (
                          <Heart className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white capitalize">{selectedType} Portal</h2>
                        <p className="text-xs text-white/70">Secure access to your account</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="p-5">
                    <Tabs defaultValue="login" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4 h-9">
                        <TabsTrigger value="login" className="text-sm">Login</TabsTrigger>
                        <TabsTrigger value="register" className="text-sm">Register</TabsTrigger>
                      </TabsList>

                      {/* Login Tab */}
                      <TabsContent value="login" className="mt-0">
                        <form onSubmit={handleLogin} className="space-y-3">
                          <div>
                            <Label className="text-xs font-medium text-slate-600">Email</Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                type="email"
                                placeholder="Enter your email"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                className="pl-9 h-9 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-slate-600">Password</Label>
                            <div className="relative mt-1">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                className="pl-9 pr-9 h-9 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setShowForgotPassword(true)}
                              className={`text-xs ${selectedType === "doctor" ? 'text-teal-600 hover:text-teal-700' : 'text-blue-600 hover:text-blue-700'}`}
                            >
                              Forgot password?
                            </button>
                          </div>

                          <Button
                            type="submit"
                            disabled={emailLoginMutation.isPending}
                            className={`w-full h-9 text-sm ${
                              selectedType === "doctor"
                                ? 'bg-teal-600 hover:bg-teal-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {emailLoginMutation.isPending ? "Signing in..." : (
                              <>
                                <LogIn className="h-4 w-4 mr-2" />
                                Sign In
                              </>
                            )}
                          </Button>

                          <div className="relative my-3">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <span className="px-2 bg-white text-xs text-slate-400">or continue with</span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => googleLoginMutation.mutate(selectedType)}
                            disabled={googleLoginMutation.isPending}
                            className="w-full h-9 text-sm border hover:bg-slate-50"
                          >
                            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            {googleLoginMutation.isPending ? "Signing in..." : "Google"}
                          </Button>
                        </form>
                      </TabsContent>

                      {/* Register Tab */}
                      <TabsContent value="register" className="mt-0">
                        <form onSubmit={handleRegister} className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs font-medium text-slate-600">Full Name *</Label>
                              <Input
                                type="text"
                                placeholder="Your name"
                                value={registerData.name}
                                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-slate-600">City *</Label>
                              <Input
                                type="text"
                                placeholder="Your city"
                                value={registerData.city}
                                onChange={(e) => setRegisterData({ ...registerData, city: e.target.value })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-slate-600">Email *</Label>
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              value={registerData.email}
                              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                              className="mt-1 h-8 text-sm"
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-slate-600">Aadhaar Number *</Label>
                            <Input
                              type="text"
                              placeholder="12-digit Aadhaar number"
                              value={registerData.aadhaarNumber}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').substring(0, 12);
                                setRegisterData({ ...registerData, aadhaarNumber: value });
                              }}
                              className="mt-1 h-8 text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs font-medium text-slate-600">Password *</Label>
                              <div className="relative mt-1">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Min 8 chars"
                                  value={registerData.password}
                                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                  className="h-8 text-sm pr-8"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                                >
                                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-slate-600">Confirm *</Label>
                              <Input
                                type="password"
                                placeholder="Confirm"
                                value={registerData.confirmPassword}
                                onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>

                          <Button
                            type="submit"
                            disabled={emailRegisterMutation.isPending}
                            className={`w-full h-9 text-sm mt-3 ${
                              selectedType === "doctor"
                                ? 'bg-teal-600 hover:bg-teal-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {emailRegisterMutation.isPending ? "Creating..." : "Create Account"}
                          </Button>

                          <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <span className="px-2 bg-white text-xs text-slate-400">or</span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => googleLoginMutation.mutate(selectedType)}
                            disabled={googleLoginMutation.isPending}
                            className="w-full h-8 text-sm border hover:bg-slate-50"
                          >
                            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign up with Google
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-4 pt-0">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <Shield className="h-3.5 w-3.5 text-green-500" />
                      <span>Quantum Encrypted</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Instructions when no selection */}
      {!selectedType && (
        <div className="text-center text-white/70 animate-pulse">
          <p className="text-lg">Click on Patient or Doctor to continue</p>
        </div>
      )}
    </div>
  );
}
