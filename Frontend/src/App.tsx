import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { onAuthChange, logout as firebaseLogout } from "@/lib/firebase";
import type { FirebaseUser } from "@/lib/firebase";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import AdminLogin from "@/pages/admin-login";
import Dashboard from "@/pages/dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

export interface User {
  id: string;
  name: string;
  userType: 'patient' | 'doctor' | 'admin';
  generatedId: string;
  isNewUser?: boolean;
}

// Storage keys for persisting user session
const USER_STORAGE_KEY = "quantum_health_user";
const PROFILE_COMPLETE_KEY = "quantum_health_profile_complete";

// Immediately check and clear invalid cached users (Firebase UIDs instead of MongoDB ObjectIds)
// MongoDB ObjectIds are 24 hex characters, Firebase UIDs contain dashes
(function clearInvalidCache() {
  try {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      // Firebase UIDs contain dashes, MongoDB ObjectIds don't
      if (parsed.id && parsed.id.includes('-')) {
        console.warn('Clearing invalid cached user (Firebase UID detected)');
        localStorage.removeItem(USER_STORAGE_KEY);
        // Clear all profile complete keys
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(PROFILE_COMPLETE_KEY)) {
            localStorage.removeItem(key);
          }
        });
      }
    }
  } catch (e) {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
})();

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Listen to Firebase auth state changes and restore session
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Firebase user exists - try to restore user from localStorage
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            // Verify user exists in database before restoring
            const verifyResponse = await fetch(`/api/users/profile/${parsedUser.id}`);
            if (verifyResponse.ok) {
              setUser(parsedUser);
            } else {
              // User doesn't exist in database - clear cache
              console.warn("Cached user not found in database, clearing cache");
              localStorage.removeItem(USER_STORAGE_KEY);
              setUser(null);
            }
          } catch (e) {
            console.error("Failed to restore user session:", e);
            localStorage.removeItem(USER_STORAGE_KEY);
            setUser(null);
          }
        }
      } else {
        // Firebase user logged out - clear local state and storage
        setUser(null);
        localStorage.removeItem(USER_STORAGE_KEY);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await firebaseLogout();
      setUser(null);
      setFirebaseUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      setLocation("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleLogin = (userData: User, isNewRegistration: boolean = false) => {
    // Check if profile is already complete
    const profileComplete = localStorage.getItem(`${PROFILE_COMPLETE_KEY}_${userData.id}`);
    const userWithNewFlag = {
      ...userData,
      isNewUser: isNewRegistration && !profileComplete
    };

    setUser(userWithNewFlag);
    // Persist user to localStorage for session restoration
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithNewFlag));
    setLocation("/dashboard");
  };

  const handleProfileComplete = () => {
    if (user) {
      // Mark profile as complete
      localStorage.setItem(`${PROFILE_COMPLETE_KEY}_${user.id}`, "true");
      // Update user state to remove new user flag
      const updatedUser = { ...user, isNewUser: false };
      setUser(updatedUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Landing Page - accessible to all */}
      <Route path="/">
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} onProfileComplete={handleProfileComplete} />
        ) : (
          <Landing />
        )}
      </Route>

      {/* Login Page */}
      <Route path="/login">
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} onProfileComplete={handleProfileComplete} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </Route>

      {/* Dashboard - protected route */}
      <Route path="/dashboard">
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} onProfileComplete={handleProfileComplete} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </Route>

      {/* Admin Login */}
      <Route path="/admin/login">
        {user?.userType === 'admin' ? (
          <AdminDashboard />
        ) : (
          <AdminLogin onLogin={(userData) => handleLogin(userData, false)} />
        )}
      </Route>

      {/* Admin Dashboard - requires admin role */}
      <Route path="/admin">
        {user?.userType === 'admin' ? (
          <AdminDashboard />
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="text-center text-white">
              <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
              <p className="text-slate-400 mb-4">You need admin privileges to access this page.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setLocation("/admin/login")}
                  className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
                >
                  Admin Login
                </button>
                <button
                  onClick={() => setLocation("/")}
                  className="px-4 py-2 bg-slate-600 rounded-lg hover:bg-slate-700"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        )}
      </Route>

      {/* 404 Not Found */}
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
