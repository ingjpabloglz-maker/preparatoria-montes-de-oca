import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";

export default function RoleRedirect() {
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !user) return;

    if (user.role === "admin") {
      window.location.replace(createPageUrl("AdminDashboard"));
    } else {
      window.location.replace(createPageUrl("Dashboard"));
    }
  }, [user, isLoadingAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}