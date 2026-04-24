import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Vanity CNAME-target guard.
 *
 * `custom.travelvela.com` exists ONLY as a branded CNAME target for tenant
 * custom domains. Direct visits must NEVER load the platform app, and the
 * hostname must NEVER be indexed by search engines. We:
 *   1. Inject <meta name="robots" content="noindex,nofollow"> immediately.
 *   2. Hard-redirect to the marketing site before React mounts.
 */
(function guardVanityHost() {
  if (typeof window === "undefined") return;
  if (window.location.hostname !== "custom.travelvela.com") return;

  // 1. Block indexing as early as possible (before any render / crawler parse).
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex,nofollow,noarchive,nosnippet";
  document.head.appendChild(robots);

  // 2. Redirect direct visitors to the public marketing site.
  window.location.replace("https://www.travelvela.com");
})();

createRoot(document.getElementById("root")!).render(<App />);

/**
 * Stale-chunk recovery.
 *
 * After a redeploy, the cached index.js may reference old hashed chunks
 * (e.g. DashboardRouter-OLDHASH.js) that no longer exist. The dynamic
 * import then throws and the screen goes blank. We catch that error once
 * per session and trigger a single hard reload to fetch the new manifest.
 */
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("__chunk_reloaded__")) return;
  sessionStorage.setItem("__chunk_reloaded__", "1");
  window.location.reload();
});

window.addEventListener("error", (event) => {
  const msg = event?.message || "";
  if (!msg.includes("Failed to fetch dynamically imported module")) return;
  if (sessionStorage.getItem("__chunk_reloaded__")) return;
  sessionStorage.setItem("__chunk_reloaded__", "1");
  window.location.reload();
});
