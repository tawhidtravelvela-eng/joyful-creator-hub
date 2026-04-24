import type { BlockInstance, SkinKey } from "./types";
import { getSkin } from "./registry";

/**
 * Deterministic homepage auto-composer.
 *
 * Picks a sensible skin and curated block stack from the tenant's enabled
 * modules. Designed to be a zero-cost baseline: no AI calls, fully predictable,
 * and safe to re-run. The Studio surfaces this as "Generate homepage".
 */

export interface AutoComposeInput {
  enabledModules: Record<string, boolean>;
  audience?: "b2c" | "b2b" | "hybrid" | "corporate" | null;
}

export interface AutoComposeResult {
  skin_key: SkinKey;
  blocks: BlockInstance[];
  rationale: string;
}

function isOn(modules: Record<string, boolean>, key: string): boolean {
  return modules?.[key] === true;
}

/** Choose the best skin from enabled modules + declared audience. */
function chooseSkin(input: AutoComposeInput): SkinKey {
  const { enabledModules, audience } = input;
  if (audience === "corporate") return "b2b-corporate";
  if (audience === "hybrid") return "hybrid-full";

  const flights = isOn(enabledModules, "flights");
  const hotels = isOn(enabledModules, "hotels");
  const tours = isOn(enabledModules, "tours");
  const enabledCount = [flights, hotels, tours].filter(Boolean).length;

  // Single-vertical specialists
  if (enabledCount === 1) {
    if (flights) return "b2c-flight";
    if (hotels) return "b2c-hotel";
    if (tours) return "b2c-tour";
  }

  // Multi-vertical or unspecified → balanced consumer skin
  return "b2c-general";
}

/**
 * Build a homepage block stack tailored to the chosen skin AND the tenant's
 * actually-enabled modules (so we never show, e.g., "Trending flights" if
 * flights are turned off).
 */
export function autoComposeHomepage(input: AutoComposeInput): AutoComposeResult {
  const skin_key = chooseSkin(input);
  const skin = getSkin(skin_key);
  const modules = input.enabledModules || {};

  // Filter the skin's defaults against enabled modules.
  const filtered = skin.default_blocks.filter((b) => {
    if (b.block_key.startsWith("trending.flights") || b.block_key === "hero.search-flight") {
      return isOn(modules, "flights");
    }
    if (b.block_key === "destination.hotel-cities" || b.block_key === "hero.search-hotel") {
      return isOn(modules, "hotels");
    }
    if (b.block_key === "hero.search-tour") {
      return isOn(modules, "tours");
    }
    return true;
  });

  // Always guarantee a hero block at index 0.
  const hasHero = filtered.some((b) => b.block_key.startsWith("hero."));
  const blocks: BlockInstance[] = hasHero
    ? filtered
    : [{ block_key: "hero.search-mixed" }, ...filtered];

  const enabledLabels = ["flights", "hotels", "tours"]
    .filter((m) => isOn(modules, m))
    .join(", ") || "general";
  const rationale = `Picked "${skin.display_name}" based on enabled modules: ${enabledLabels}.`;

  return { skin_key, blocks, rationale };
}