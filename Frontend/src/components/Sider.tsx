import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Search,
  Upload,
  History,
  LogOut,
  User,
  Settings as SettingsIcon,
  ChevronUp,
  Home,
  FileText,
  Share2,
  Bell,
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  Users,
  MessageSquare,
  Calendar,
  CalendarClock,
} from "lucide-react";
import type { User as UserType } from "@/App";
import UserProfile from "./UserProfile";
import Notifications from "./Notifications";
import SettingsDialog from "./Settings";

interface SiderProps {
  user: UserType;
  onLogout: () => void;
  children: React.ReactNode;
  activePage?: string;
  onPageChange?: (page: string) => void;
  isNewUser?: boolean;
  onProfileComplete?: () => void;
}

// Patient-specific menu items
const patientMenuItems = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: Home,
  },
  {
    id: "search",
    title: "Find Doctors",
    icon: Search,
  },
  {
    id: "appointments",
    title: "Appointments",
    icon: Calendar,
  },
  {
    id: "messages",
    title: "Messages",
    icon: MessageSquare,
  },
  {
    id: "upload",
    title: "Upload Documents",
    icon: Upload,
  },
  {
    id: "documents",
    title: "My Documents",
    icon: FileText,
  },
  {
    id: "shared",
    title: "Manage Access",
    icon: Share2,
  },
  {
    id: "suggestions",
    title: "Doctor Suggestions",
    icon: Stethoscope,
  },
  {
    id: "history",
    title: "Access History",
    icon: History,
  },
  {
    id: "settings",
    title: "Settings",
    icon: SettingsIcon,
  },
];

// Doctor-specific menu items
const doctorMenuItems = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: Home,
  },
  {
    id: "appointments",
    title: "Appointments",
    icon: Calendar,
  },
  {
    id: "availability",
    title: "My Availability",
    icon: CalendarClock,
  },
  {
    id: "messages",
    title: "Messages",
    icon: MessageSquare,
  },
  {
    id: "patients",
    title: "Patient Documents",
    icon: Users,
  },
  {
    id: "my-suggestions",
    title: "My Suggestions",
    icon: ClipboardList,
  },
  {
    id: "history",
    title: "Access History",
    icon: History,
  },
  {
    id: "settings",
    title: "Settings",
    icon: SettingsIcon,
  },
];

export default function Sider({ user, onLogout, children, activePage = "dashboard", onPageChange, isNewUser = false, onProfileComplete }: SiderProps) {
  const [profileOpen, setProfileOpen] = useState(isNewUser);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Auto-open profile for new users
  useEffect(() => {
    if (isNewUser) {
      setProfileOpen(true);
    }
  }, [isNewUser]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleMenuClick = (pageId: string) => {
    if (pageId === "settings") {
      setSettingsOpen(true);
      return;
    }
    if (onPageChange) {
      onPageChange(pageId);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Quantum Healthcare</span>
              <span className="text-xs text-muted-foreground">Secure Medical Records</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600">Quantum Secured</span>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              {user.userType === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(user.userType === 'doctor' ? doctorMenuItems : patientMenuItems).map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activePage === item.id}
                      onClick={() => handleMenuClick(item.id)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin Section - only visible to admin users */}
          {user.userType === 'admin' && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setLocation("/admin")}
                        tooltip="Admin Dashboard"
                        className="text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Quick Info</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">User Type</span>
                  <span className="font-medium capitalize bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {user.userType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono text-xs">{user.generatedId}</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src="" alt={user.name} />
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.generatedId}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src="" alt={user.name} />
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.generatedId}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPageChange?.("notifications")}>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Notifications userId={user.id} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="gap-2"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline-block text-sm">{user.name}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </SidebarInset>

      <UserProfile
        user={user}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        isNewUser={isNewUser}
        onProfileComplete={onProfileComplete}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={user.id}
      />
    </SidebarProvider>
  );
}
