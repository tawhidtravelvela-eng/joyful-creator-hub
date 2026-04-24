import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plane, Eye, EyeOff } from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);
  const { branding } = useSiteBranding();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const { tenant } = useTenant();
  const siteName = branding.site_name || "Travel Vela";
  const { isHybrid } = useIsHybridSkin();
  const nameParts = siteName.length > 3 ? [siteName.slice(0, -2), siteName.slice(-2)] : [siteName, ""];

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [referralCode, setReferralCode] = useState(() => sessionStorage.getItem("affiliate_ref") || "");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Parallel: check admin + profile + tenant-scoped access
      const [adminRes, profileRes, tenantAdminRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: data.user.id, _role: "super_admin" }),
        supabase.from("profiles").select("approval_status, user_type, tenant_id").eq("user_id", data.user.id).maybeSingle(),
        tenant
          ? supabase.rpc("is_tenant_admin_of", { _tenant_id: tenant.id })
          : Promise.resolve({ data: false }),
      ]);
      const profileData = profileRes.data as any;

      // Tenant-scoped login: on a tenant's custom domain, only that tenant's
      // members (or its admins / platform super-admins) may sign in.
      if (tenant) {
        const belongsToTenant = profileData?.tenant_id === tenant.id;
        const isTenantAdmin = !!tenantAdminRes.data;
        const isSuperAdmin = !!adminRes.data;
        if (!belongsToTenant && !isTenantAdmin && !isSuperAdmin) {
          await supabase.auth.signOut();
          toast.error(`This account doesn't have access to ${tenant.name}.`);
          return;
        }
      }

      if (profileData && profileData.user_type !== "b2c" && profileData.approval_status === "pending") {
        await supabase.auth.signOut();
        toast.error("Your account is pending admin approval. You'll be notified once approved.");
        return;
      }
      if (profileData && profileData.approval_status === "rejected") {
        await supabase.auth.signOut();
        toast.error("Your registration was not approved. Please contact support.");
        return;
      }
      
      // Prime dashboard router cache so it renders instantly (no extra round-trip)
      try {
        const t = (profileData?.user_type as string) || "b2c";
        const raw = localStorage.getItem("tv_user_type_cache_v1");
        const c = raw ? JSON.parse(raw) : {};
        c[data.user.id] = t;
        localStorage.setItem("tv_user_type_cache_v1", JSON.stringify(c));
      } catch {}

      if (adminRes.data) {
        toast.success("Welcome back, Admin!");
        navigate("/admin");
      } else {
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: {
          full_name: regName,
          ...(tenant ? { tenant_id: tenant.id } : {}),
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Clear stored affiliate ref after successful signup
      if (referralCode) sessionStorage.removeItem("affiliate_ref");
      toast.success("Check your email to confirm your account!");
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-background p-4${isHybrid ? " hybrid-skin-active" : ""}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={siteName} className="h-9 w-auto object-contain" />
            ) : (
              <>
                <Plane className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  {nameParts[0]}<span className="text-primary">{nameParts[1]}</span>
                </span>
              </>
            )}
          </Link>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div><Label>Email</Label><Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><div className="relative"><Input type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="pr-10" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowLoginPassword(!showLoginPassword)} tabIndex={-1}>{showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div><Label>Full Name</Label><Input value={regName} onChange={(e) => setRegName(e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><div className="relative"><Input type={showRegPassword ? "text" : "password"} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} className="pr-10" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowRegPassword(!showRegPassword)} tabIndex={-1}>{showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <div><Label>Referral / Coupon Code <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="e.g. AFF1234ABCD" /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create Account"}</Button>
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs text-center text-muted-foreground">Register as a business?</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 text-xs" onClick={() => navigate("/register/corporate")}>Corporate</Button>
                    <Button type="button" variant="outline" className="flex-1 text-xs" onClick={() => navigate("/register/agent")}>B2B Agent</Button>
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
