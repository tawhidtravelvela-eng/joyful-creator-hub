import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import Layout from "@/components/site/hybrid/SkinAwareLayout";

/**
 * Resilient lazy loader — retries a failed dynamic import once before giving
 * up, then forces a hard reload. This protects against transient Vite HMR /
 * network blips that would otherwise leave the user on a blank screen with
 * "Failed to fetch dynamically imported module".
 */
const lazyWithRetry = <T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // Wait a beat and retry once — covers HMR reconnects and flaky chunks.
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (err2) {
        // Last resort: reload the page so the user gets fresh chunks instead
        // of a blank screen. Guard against reload loops with a session flag.
        if (typeof window !== "undefined") {
          const key = "tv_chunk_reload_once";
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            window.location.reload();
          }
        }
        throw err2;
      }
    }
  });

const B2CDashboard = lazyWithRetry(() => import("./Dashboard"));
const B2BAgentDashboard = lazyWithRetry(() => import("./B2BAgentDashboard"));
const CorporateDashboard = lazyWithRetry(() => import("./CorporateDashboard"));

const PageLoader = () => (
  <Layout>
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
    </div>
  </Layout>
);

// Persistent cache (survives reloads) keyed by user id
const CACHE_KEY = "tv_user_type_cache_v1";
const readCache = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeCache = (uid: string, type: string) => {
  try {
    const c = readCache();
    c[uid] = type;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
};

const DashboardRouter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const cached = user ? readCache()[user.id] : null;
  const [userType, setUserType] = useState<string | null>(cached);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    // Background refresh — don't block render
    supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const type = data?.user_type || "b2c";
        writeCache(user.id, type);
        if (type !== userType) setUserType(type);
      });
  }, [user, authLoading, navigate, userType]);

  // Only block if we have no cached type AND auth is still loading
  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;
  // Optimistic: if no cache yet, assume b2c (most common) — swap on background fetch
  const effectiveType = userType || "b2c";

  return (
    <Suspense fallback={<PageLoader />}>
      {effectiveType === "b2b_agent" ? (
        <B2BAgentDashboard />
      ) : effectiveType === "corporate" ? (
        <CorporateDashboard />
      ) : (
        <B2CDashboard />
      )}
    </Suspense>
  );
};

export default DashboardRouter;
