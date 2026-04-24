import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

const DEFAULT_CRISP_ID = "7b6ec17d-256a-41e8-9732-17ff58bd51e9";

const CrispChat = () => {
  const { tenant } = useTenant();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;

    const loadCrisp = async () => {
      let crispId = "";
      // For tenant sites, only load Crisp when the tenant has explicitly
      // configured their OWN crisp_website_id. Never leak the master
      // (Travel Vela) Crisp inbox onto a white-label tenant site.
      let enabled = false;

      if (tenant?.settings) {
        const ts = tenant.settings as Record<string, any>;
        const apps = (ts.apps || {}) as Record<string, any>;
        if (apps.crisp_website_id) {
          crispId = apps.crisp_website_id;
          enabled = apps.crisp_enabled !== false; // default on if id is set
        }
      } else {
        // No tenant context = master site. Use global settings + default.
        enabled = true;
        try {
          const { data } = await supabase
            .from("api_settings")
            .select("settings")
            .eq("provider", "site_apps")
            .maybeSingle();

          if (data?.settings) {
            const settings = data.settings as Record<string, any>;
            if (typeof settings.crisp_enabled === "boolean") enabled = settings.crisp_enabled;
            crispId = settings.crisp_website_id || DEFAULT_CRISP_ID;
          } else {
            crispId = DEFAULT_CRISP_ID;
          }
        } catch (e) {
          console.warn("[CrispChat] settings fetch failed, using default:", e);
          crispId = DEFAULT_CRISP_ID;
        }
      }

      if (!enabled || !crispId) return;
      if (document.querySelector('script[src="https://client.crisp.chat/l.js"]')) {
        setLoaded(true);
        return;
      }

      // Preserve any commands already pushed by the page.
      const existing = Array.isArray((window as any).$crisp) ? (window as any).$crisp : [];
      window.$crisp = existing;
      window.CRISP_WEBSITE_ID = crispId;
      // Make sure the launcher is visible by default.
      window.$crisp.push(["do", "chat:show"]);

      const script = document.createElement("script");
      script.src = "https://client.crisp.chat/l.js";
      script.async = true;
      script.onerror = () => console.warn("[CrispChat] script failed to load");
      document.head.appendChild(script);
      setLoaded(true);
    };

    loadCrisp();
  }, [tenant, loaded]);

  return null;
};

export default CrispChat;
