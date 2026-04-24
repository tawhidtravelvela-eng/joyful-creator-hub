import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SESSION_KEY = "tv_site_session_v1";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Fires a pageview to the tenant-site-track edge function for every
 * route change on a tenant white-label site. Uses keepalive: true so the
 * call never blocks navigation. Skips when no tenant id is provided
 * (i.e. on the platform default domain).
 */
export function useTenantSiteTracking(tenantId: string | null | undefined) {
  const location = useLocation();

  useEffect(() => {
    if (!tenantId) return;
    const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;

    const url = `https://${projectId}.functions.supabase.co/tenant-site-track`;
    const payload = {
      tenant_id: tenantId,
      page_path: location.pathname + (location.search || ""),
      page_title: typeof document !== "undefined" ? document.title : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      session_id: getSessionId(),
    };

    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Silent — analytics must never break the site.
    }
  }, [tenantId, location.pathname, location.search]);
}