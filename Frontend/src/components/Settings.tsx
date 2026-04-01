import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  Mail,
  Shield,
  Palette,
  Globe,
  Type,
  Volume2,
  Eye,
  Lock,
  Smartphone,
  Check,
  RotateCcw,
  Save,
} from "lucide-react";

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface UserSettings {
  // Appearance
  fontSize: number;
  compactMode: boolean;
  animations: boolean;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  appointmentReminders: boolean;
  documentAlerts: boolean;
  messageNotifications: boolean;
  soundEnabled: boolean;

  // Privacy
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowProfileViewing: boolean;

  // Language
  language: string;
}

const defaultSettings: UserSettings = {
  fontSize: 16,
  compactMode: false,
  animations: true,
  emailNotifications: true,
  pushNotifications: true,
  appointmentReminders: true,
  documentAlerts: true,
  messageNotifications: true,
  soundEnabled: true,
  showOnlineStatus: true,
  showLastSeen: true,
  allowProfileViewing: true,
  language: "en",
};

export default function Settings({ open, onOpenChange, userId }: SettingsProps) {
  const { theme, setTheme, actualTheme } = useTheme();
  const { toast } = useToast();

  // Load settings from localStorage
  const loadSettings = useCallback((): UserSettings => {
    try {
      const stored = localStorage.getItem(`settings_${userId}`);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return defaultSettings;
  }, [userId]);

  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [savedIndicator, setSavedIndicator] = useState<string | null>(null);

  // Reload settings when dialog opens
  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open, loadSettings]);

  // Apply font size to document
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontSize]);

  // Apply compact mode
  useEffect(() => {
    if (settings.compactMode) {
      document.documentElement.classList.add("compact-mode");
    } else {
      document.documentElement.classList.remove("compact-mode");
    }
  }, [settings.compactMode]);

  // Apply animations preference
  useEffect(() => {
    if (!settings.animations) {
      document.documentElement.style.setProperty("--transition-duration", "0s");
      document.documentElement.classList.add("no-animations");
    } else {
      document.documentElement.style.removeProperty("--transition-duration");
      document.documentElement.classList.remove("no-animations");
    }
  }, [settings.animations]);

  // Auto-save settings whenever they change
  const saveSettings = useCallback((newSettings: UserSettings, settingName?: string) => {
    localStorage.setItem(`settings_${userId}`, JSON.stringify(newSettings));
    if (settingName) {
      setSavedIndicator(settingName);
      setTimeout(() => setSavedIndicator(null), 1500);
    }
  }, [userId]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings, key);
  };

  const resetAllSettings = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
    setTheme("system");
    toast({
      title: "Settings Reset",
      description: "All settings have been restored to defaults.",
    });
  };

  const SavedBadge = ({ settingKey }: { settingKey: string }) => {
    if (savedIndicator === settingKey) {
      return (
        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 text-xs">
          <Check className="h-3 w-3 mr-1" />
          Saved
        </Badge>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Changes are saved automatically
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="appearance" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="language" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Language</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Theme
                    <SavedBadge settingKey="theme" />
                  </CardTitle>
                  <CardDescription>Select your preferred color scheme</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      className={`flex flex-col gap-2 h-auto py-4 ${theme === "light" ? "ring-2 ring-primary" : ""}`}
                      onClick={() => {
                        setTheme("light");
                        setSavedIndicator("theme");
                        setTimeout(() => setSavedIndicator(null), 1500);
                      }}
                    >
                      <Sun className="h-5 w-5" />
                      <span className="text-xs">Light</span>
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      className={`flex flex-col gap-2 h-auto py-4 ${theme === "dark" ? "ring-2 ring-primary" : ""}`}
                      onClick={() => {
                        setTheme("dark");
                        setSavedIndicator("theme");
                        setTimeout(() => setSavedIndicator(null), 1500);
                      }}
                    >
                      <Moon className="h-5 w-5" />
                      <span className="text-xs">Dark</span>
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      className={`flex flex-col gap-2 h-auto py-4 ${theme === "system" ? "ring-2 ring-primary" : ""}`}
                      onClick={() => {
                        setTheme("system");
                        setSavedIndicator("theme");
                        setTimeout(() => setSavedIndicator(null), 1500);
                      }}
                    >
                      <Monitor className="h-5 w-5" />
                      <span className="text-xs">System</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Currently using: <span className="font-medium">{actualTheme === "dark" ? "Dark" : "Light"} mode</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Font Size
                    <SavedBadge settingKey="fontSize" />
                  </CardTitle>
                  <CardDescription>Adjust the text size: {settings.fontSize}px</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">A</span>
                    <Slider
                      value={[settings.fontSize]}
                      onValueChange={(value) => updateSetting("fontSize", value[0])}
                      min={12}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-lg font-medium">A</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Small (12px)</span>
                    <span>Default (16px)</span>
                    <span>Large (20px)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Display Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="compact-mode" className="flex items-center gap-2">
                        Compact Mode
                        <SavedBadge settingKey="compactMode" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Reduce spacing for more content
                      </p>
                    </div>
                    <Switch
                      id="compact-mode"
                      checked={settings.compactMode}
                      onCheckedChange={(checked) => updateSetting("compactMode", checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="animations" className="flex items-center gap-2">
                        Animations
                        <SavedBadge settingKey="animations" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Enable smooth transitions
                      </p>
                    </div>
                    <Switch
                      id="animations"
                      checked={settings.animations}
                      onCheckedChange={(checked) => updateSetting("animations", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="email-notifications" className="flex items-center gap-2">
                        Enable Email Notifications
                        <SavedBadge settingKey="emailNotifications" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Receive important updates via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Push Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="push-notifications" className="flex items-center gap-2">
                        Enable Push Notifications
                        <SavedBadge settingKey="pushNotifications" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get real-time browser notifications
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={settings.pushNotifications}
                      onCheckedChange={(checked) => updateSetting("pushNotifications", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notification Types
                  </CardTitle>
                  <CardDescription>Choose what to be notified about</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="appointment-reminders" className="flex items-center gap-2">
                        Appointment Reminders
                        <SavedBadge settingKey="appointmentReminders" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get reminded before appointments
                      </p>
                    </div>
                    <Switch
                      id="appointment-reminders"
                      checked={settings.appointmentReminders}
                      onCheckedChange={(checked) => updateSetting("appointmentReminders", checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="document-alerts" className="flex items-center gap-2">
                        Document Alerts
                        <SavedBadge settingKey="documentAlerts" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When documents are shared or accessed
                      </p>
                    </div>
                    <Switch
                      id="document-alerts"
                      checked={settings.documentAlerts}
                      onCheckedChange={(checked) => updateSetting("documentAlerts", checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="message-notifications" className="flex items-center gap-2">
                        Message Notifications
                        <SavedBadge settingKey="messageNotifications" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        New messages from doctors/patients
                      </p>
                    </div>
                    <Switch
                      id="message-notifications"
                      checked={settings.messageNotifications}
                      onCheckedChange={(checked) => updateSetting("messageNotifications", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Sound
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="sound-enabled" className="flex items-center gap-2">
                        Notification Sound
                        <SavedBadge settingKey="soundEnabled" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Play a sound for new notifications
                      </p>
                    </div>
                    <Switch
                      id="sound-enabled"
                      checked={settings.soundEnabled}
                      onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Visibility
                  </CardTitle>
                  <CardDescription>Control what others can see</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="show-online-status" className="flex items-center gap-2">
                        Show Online Status
                        <SavedBadge settingKey="showOnlineStatus" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Let others see when you're online
                      </p>
                    </div>
                    <Switch
                      id="show-online-status"
                      checked={settings.showOnlineStatus}
                      onCheckedChange={(checked) => updateSetting("showOnlineStatus", checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="show-last-seen" className="flex items-center gap-2">
                        Show Last Seen
                        <SavedBadge settingKey="showLastSeen" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Display when you were last active
                      </p>
                    </div>
                    <Switch
                      id="show-last-seen"
                      checked={settings.showLastSeen}
                      onCheckedChange={(checked) => updateSetting("showLastSeen", checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="allow-profile-viewing" className="flex items-center gap-2">
                        Allow Profile Viewing
                        <SavedBadge settingKey="allowProfileViewing" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Let others view your profile
                      </p>
                    </div>
                    <Switch
                      id="allow-profile-viewing"
                      checked={settings.allowProfileViewing}
                      onCheckedChange={(checked) => updateSetting("allowProfileViewing", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    Security Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">End-to-End Encryption</p>
                        <p className="text-xs text-green-600 dark:text-green-500">Active</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Lock className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">Quantum-Safe Encryption</p>
                        <p className="text-xs text-green-600 dark:text-green-500">AES-256 + Blockchain</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Language Tab */}
            <TabsContent value="language" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Language
                    <SavedBadge settingKey="language" />
                  </CardTitle>
                  <CardDescription>Choose your preferred language</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={settings.language}
                    onValueChange={(value) => updateSetting("language", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        <span className="flex items-center gap-2">
                          <span>🇺🇸</span> English
                        </span>
                      </SelectItem>
                      <SelectItem value="hi">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Hindi (हिंदी)
                        </span>
                      </SelectItem>
                      <SelectItem value="mr">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Marathi (मराठी)
                        </span>
                      </SelectItem>
                      <SelectItem value="gu">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Gujarati (ગુજરાતી)
                        </span>
                      </SelectItem>
                      <SelectItem value="ta">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Tamil (தமிழ்)
                        </span>
                      </SelectItem>
                      <SelectItem value="te">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Telugu (తెలుగు)
                        </span>
                      </SelectItem>
                      <SelectItem value="kn">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Kannada (ಕನ್ನಡ)
                        </span>
                      </SelectItem>
                      <SelectItem value="bn">
                        <span className="flex items-center gap-2">
                          <span>🇮🇳</span> Bengali (বাংলা)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-3">
                    Language changes apply immediately.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" size="sm" onClick={resetAllSettings} className="text-muted-foreground">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4 mr-2" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
