import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useAdminTheme } from "@/hooks/useAdminTheme";
import { useAdminBrandTheme } from "@/hooks/useAdminBrandTheme";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { branding } = useSiteBranding();
  const siteName = branding.site_name || "Travel Vela";
  const { style, hasTheme } = useAdminTheme();
  // Auto-derives a palette from the tenant admin's uploaded logo and applies
  // it to the admin chrome. Super admins (no tenant) get null → platform default.
  // The explicit preset (useAdminTheme) wins when configured.
  const { themeVars: brandVars } = useAdminBrandTheme();
  const mergedStyle = hasTheme ? style : (brandVars ?? style);

  return (
    <SidebarProvider>
      <div
        className="min-h-screen flex w-full bg-background"
        style={mergedStyle}
        data-admin-theme={hasTheme ? "tenant-preset" : (brandVars ? "tenant-brand" : "default")}
      >
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold text-foreground">{siteName} Admin</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
