import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, adminTenantId, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Super admins (no tenant scope) get the admin panel.
  // Tenant-scoped admins (B2B agents who own a tenant) belong on /dashboard.
  if (!isAdmin) return <Navigate to="/" replace />;
  if (adminTenantId) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedAdminRoute;
