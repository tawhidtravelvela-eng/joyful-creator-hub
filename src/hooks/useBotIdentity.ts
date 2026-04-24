import { useMemo } from "react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";

/**
 * useBotIdentity — derives the AI assistant's brand identity per tenant.
 *
 * Resolution order:
 *   name:     settings.ai.bot_name → settings.ai_bot_name → "{site_name} AI" → "Trip AI"
 *   tagline:  settings.ai.bot_tagline → settings.ai_bot_tagline → default copy
 *   avatar:   settings.ai.bot_avatar_url → settings.ai_bot_avatar_url
 *             → branding.favicon_url → branding.logo_url → null (UI shows initial)
 *
 * Returns initials so the UI can render a clean fallback badge instead of a
 * broken `/images/vela-ai-avatar.jpg` request when nothing is configured.
 */
export interface BotIdentity {
  name: string;
  shortName: string;
  tagline: string;
  avatarUrl: string | null;
  initials: string;
}

const DEFAULT_TAGLINE = "Your Smart Travel Assistant";

function makeInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AI"
  );
}

export function useBotIdentity(): BotIdentity {
  const { branding } = useSiteBranding();
  const { tenant } = useTenant();

  return useMemo(() => {
    const ts = (tenant?.settings || {}) as Record<string, any>;
    const ai = (ts.ai || {}) as Record<string, any>;

    const siteName = (branding.site_name || tenant?.name || "").trim();
    const overrideName =
      (ai.bot_name as string) || (ts.ai_bot_name as string) || "";
    const name =
      overrideName ||
      (siteName ? `${siteName.split(/\s+/)[0]} AI` : "Trip AI");

    const shortName = name.split(/\s+/)[0];

    const tagline =
      (ai.bot_tagline as string) ||
      (ts.ai_bot_tagline as string) ||
      DEFAULT_TAGLINE;

    const avatarUrl =
      (ai.bot_avatar_url as string) ||
      (ts.ai_bot_avatar_url as string) ||
      branding.favicon_url ||
      branding.logo_url ||
      null;

    return {
      name,
      shortName,
      tagline,
      avatarUrl: avatarUrl || null,
      initials: makeInitials(name),
    };
  }, [branding.site_name, branding.favicon_url, branding.logo_url, tenant?.name, tenant?.settings]);
}
