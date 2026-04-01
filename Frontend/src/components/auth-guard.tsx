import { useEffect } from "react";
import { useLocation } from "wouter";
import type { User } from "@/App";

interface AuthGuardProps {
  user: User | null;
  children: React.ReactNode;
}

export default function AuthGuard({ user, children }: AuthGuardProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
