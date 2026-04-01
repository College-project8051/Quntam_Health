import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit2,
  Save,
  X,
  Shield,
  Activity,
  AlertCircle,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@/App";

interface UserProfileProps {
  user: UserType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNewUser?: boolean;
  onProfileComplete?: () => void;
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  bloodGroup: string;
  emergencyContact: string;
  emergencyPhone: string;
  allergies: string;
  medicalNotes: string;
  specialty: string;
}

export default function UserProfile({
  user,
  open,
  onOpenChange,
  isNewUser = false,
  onProfileComplete
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(isNewUser);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [profileData, setProfileData] = useState<ProfileData>({
    name: user.name,
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    bloodGroup: "",
    emergencyContact: "Ambulance",
    emergencyPhone: "112",
    allergies: "",
    medicalNotes: "",
    specialty: "",
  });

  // Fetch user profile data
  const { data: fetchedProfile, isLoading } = useQuery({
    queryKey: ["/api/users/profile", user.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/profile/${user.id}`);
      return res.json();
    },
    enabled: open,
  });

  // Update profile data when fetched
  useEffect(() => {
    if (fetchedProfile?.profile) {
      setProfileData({
        name: fetchedProfile.profile.name || user.name,
        email: fetchedProfile.profile.email || "",
        phone: fetchedProfile.profile.phone || "",
        address: fetchedProfile.profile.address || "",
        dateOfBirth: fetchedProfile.profile.dateOfBirth || "",
        bloodGroup: fetchedProfile.profile.bloodGroup || "",
        emergencyContact: "Ambulance",
        emergencyPhone: "112",
        allergies: fetchedProfile.profile.allergies || "",
        medicalNotes: fetchedProfile.profile.medicalNotes || "",
        specialty: fetchedProfile.profile.specialty || "",
      });
    }
  }, [fetchedProfile, user.name]);

  // Auto-enable editing for new users
  useEffect(() => {
    if (isNewUser) {
      setIsEditing(true);
    }
  }, [isNewUser]);

  // Validate mandatory fields - different for patients and doctors
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Common validations
    if (!profileData.name.trim()) {
      errors.name = "Full name is required";
    }
    if (!profileData.phone.trim()) {
      errors.phone = "Phone number is required";
    }

    if (user.userType === "doctor") {
      // Doctor-specific validations
      if (!profileData.specialty.trim()) {
        errors.specialty = "Specialty is required";
      }
      if (!profileData.email.trim()) {
        errors.email = "Email is required";
      }
    } else {
      // Patient-specific validations
      if (!profileData.dateOfBirth.trim()) {
        errors.dateOfBirth = "Date of birth is required";
      }
      if (!profileData.address.trim()) {
        errors.address = "Address is required";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const res = await apiRequest("PUT", `/api/users/profile/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
      setIsEditing(false);
      setValidationErrors({});
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile", user.id] });

      if (isNewUser && onProfileComplete) {
        onProfileComplete();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(profileData);
  };

  const handleCancel = () => {
    if (isNewUser) {
      toast({
        title: "Profile Required",
        description: "Please complete your profile to continue",
        variant: "destructive",
      });
      return;
    }
    setIsEditing(false);
    setValidationErrors({});
    // Reset to fetched data
    if (fetchedProfile?.profile) {
      setProfileData({
        name: fetchedProfile.profile.name || user.name,
        email: fetchedProfile.profile.email || "",
        phone: fetchedProfile.profile.phone || "",
        address: fetchedProfile.profile.address || "",
        dateOfBirth: fetchedProfile.profile.dateOfBirth || "",
        bloodGroup: fetchedProfile.profile.bloodGroup || "",
        emergencyContact: "Ambulance",
        emergencyPhone: "112",
        allergies: fetchedProfile.profile.allergies || "",
        medicalNotes: fetchedProfile.profile.medicalNotes || "",
        specialty: fetchedProfile.profile.specialty || "",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (isNewUser && !newOpen) {
      toast({
        title: "Profile Required",
        description: "Please complete your profile to continue",
        variant: "destructive",
      });
      return;
    }
    onOpenChange(newOpen);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isNewUser ? "Complete Your Profile" : "User Profile"}
          </SheetTitle>
          <SheetDescription>
            {isNewUser
              ? "Please fill in your basic information to continue"
              : "View and manage your personal information"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" alt={profileData.name} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(profileData.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{profileData.name}</h3>
              <p className="text-sm text-muted-foreground font-mono">{user.generatedId}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="capitalize">
                  {user.userType}
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Shield className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>
            </div>
            {!isNewUser && (
              <Button
                variant={isEditing ? "destructive" : "outline"}
                size="icon"
                onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              </Button>
            )}
          </div>

          <Separator />

          {/* Basic Information */}
          <Card className={validationErrors.name || validationErrors.phone || validationErrors.dateOfBirth || validationErrors.address ? "border-red-300" : ""}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Basic Information
                </h4>
                <Badge variant="destructive" className="text-xs">Required</Badge>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    disabled={!isEditing}
                    className={validationErrors.name ? "border-red-500" : ""}
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                {/* Email field - only show for patients (doctors have it in Professional section) */}
                {user.userType === "patient" && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (from signup)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-9 bg-muted"
                        value={profileData.email}
                        disabled={true}
                        placeholder="Email used during signup"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the email you used to sign up and cannot be changed
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      className={`pl-9 ${validationErrors.phone ? "border-red-500" : ""}`}
                      placeholder="+91 98765 43210"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {validationErrors.phone && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.phone}
                    </p>
                  )}
                </div>

                {/* Date of Birth - required for patients, optional for doctors */}
                <div className="space-y-2">
                  <Label htmlFor="dob">
                    Date of Birth {user.userType === "patient" && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dob"
                      type="date"
                      className={`pl-9 ${validationErrors.dateOfBirth ? "border-red-500" : ""}`}
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {validationErrors.dateOfBirth && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.dateOfBirth}
                    </p>
                  )}
                </div>

                {/* Address - required for patients, optional for doctors */}
                <div className="space-y-2">
                  <Label htmlFor="address">
                    Address {user.userType === "patient" && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="address"
                      className={`pl-9 min-h-[80px] ${validationErrors.address ? "border-red-500" : ""}`}
                      placeholder="Enter your full address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {validationErrors.address && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.address}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Doctor Information - ONLY FOR DOCTORS */}
          {user.userType === "doctor" && (
            <Card className={`border-primary/20 ${validationErrors.specialty || validationErrors.email ? "border-red-300" : ""}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Professional Information
                  </h4>
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="specialty">
                      Specialty <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="specialty"
                      placeholder="e.g., Dental Specialist, Cardiologist, General Physician"
                      value={profileData.specialty}
                      onChange={(e) => setProfileData({ ...profileData, specialty: e.target.value })}
                      disabled={!isEditing}
                      className={validationErrors.specialty ? "border-red-500" : ""}
                    />
                    {validationErrors.specialty && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validationErrors.specialty}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doctorEmail">
                      Professional Email <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="doctorEmail"
                        type="email"
                        className={`pl-9 ${validationErrors.email ? "border-red-500" : ""}`}
                        placeholder="doctor@hospital.com"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medical Information - OPTIONAL */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Medical Information
                </h4>
                <Badge variant="secondary" className="text-xs">Optional</Badge>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Input
                    id="bloodGroup"
                    placeholder="e.g., A+, B-, O+"
                    value={profileData.bloodGroup}
                    onChange={(e) => setProfileData({ ...profileData, bloodGroup: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Known Allergies</Label>
                  <Textarea
                    id="allergies"
                    placeholder="List any known allergies (optional)"
                    value={profileData.allergies}
                    onChange={(e) => setProfileData({ ...profileData, allergies: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalNotes">Medical Notes</Label>
                  <Textarea
                    id="medicalNotes"
                    placeholder="Any additional medical information (optional)"
                    value={profileData.medicalNotes}
                    onChange={(e) => setProfileData({ ...profileData, medicalNotes: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact - DISABLED with defaults */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-500" />
                  Emergency Contact
                </h4>
                <Badge variant="outline" className="text-xs">Default</Badge>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Contact Name</Label>
                  <Input
                    id="emergencyContact"
                    value="Ambulance"
                    disabled={true}
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Contact Number</Label>
                  <Input
                    id="emergencyPhone"
                    value="112"
                    disabled={true}
                    className="bg-muted font-mono text-lg"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Default emergency contact is set to national emergency number. This cannot be changed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : isNewUser ? "Complete Profile" : "Save Changes"}
              </Button>
              {!isNewUser && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
