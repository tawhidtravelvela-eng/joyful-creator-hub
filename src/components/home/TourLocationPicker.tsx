import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, Loader2, TrendingUp, Clock, Compass, Landmark, TreePalm, Globe, Mountain } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

// ── In-memory tour count cache (TTL: 5 min) ──
const tourCountCache = new Map<string, { count: number; ts: number }>();
const TOUR_COUNT_TTL = 5 * 60 * 1000;

async function fetchTourCounts(destinations: string[]): Promise<Map<string, number>> {
  const now = Date.now();
  const result = new Map<string, number>();
  const toFetch: string[] = [];

  for (const dest of destinations) {
    const key = dest.toLowerCase();
    const cached = tourCountCache.get(key);
    if (cached && now - cached.ts < TOUR_COUNT_TTL) {
      result.set(key, cached.count);
    } else {
      toFetch.push(dest);
    }
  }

  if (toFetch.length === 0) return result;

  // Batch query: count tours per destination
  try {
    const { data } = await supabase
      .from("tour_product_cache")
      .select("destination")
      .in("destination", toFetch)
      .eq("is_active", true);

    if (data) {
      const counts = new Map<string, number>();
      for (const row of data) {
        const k = (row.destination || "").toLowerCase();
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      for (const dest of toFetch) {
        const k = dest.toLowerCase();
        const count = counts.get(k) || 0;
        tourCountCache.set(k, { count, ts: now });
        result.set(k, count);
      }
    }
  } catch (e) {
    console.warn("[TourLocationPicker] tour count fetch error:", e);
  }

  return result;
}

export interface TourLocation {
  location_id: string;
  name: string;
  country: string;
  full_name: string;
  type: string; // COUNTRY, CITY, REGION, ISLAND, attraction, etc.
  activityCount?: number;
}

const RECENT_KEY = "tour_location_recent";

function getRecentLocations(): TourLocation[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function addRecentLocation(loc: TourLocation) {
  try {
    const recent = getRecentLocations().filter(r => r.location_id !== loc.location_id);
    recent.unshift(loc);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {}
}

// ── Type → UI mapping ──
const typeConfig: Record<string, { icon: typeof MapPin; label: string; color: string }> = {
  COUNTRY: { icon: Globe, label: "Country", color: "text-accent" },
  CITY: { icon: MapPin, label: "City", color: "text-primary" },
  TOWN: { icon: MapPin, label: "Town", color: "text-primary" },
  REGION: { icon: Mountain, label: "Region", color: "text-violet-500" },
  ISLAND: { icon: TreePalm, label: "Island", color: "text-info0" },
  STATE: { icon: Compass, label: "State", color: "text-violet-500" },
  PROVINCE: { icon: Compass, label: "Province", color: "text-violet-500" },
  NATIONAL_PARK: { icon: TreePalm, label: "National Park", color: "text-success0" },
  NEIGHBORHOOD: { icon: MapPin, label: "Area", color: "text-muted-foreground" },
  attraction: { icon: Landmark, label: "Attraction", color: "text-warning0" },
  museum: { icon: Landmark, label: "Museum", color: "text-warning0" },
  monument: { icon: Landmark, label: "Monument", color: "text-warning" },
  park: { icon: TreePalm, label: "Park", color: "text-success0" },
  beach: { icon: TreePalm, label: "Beach", color: "text-info0" },
  nature: { icon: Compass, label: "Nature", color: "text-success" },
  viewpoint: { icon: Compass, label: "Viewpoint", color: "text-violet-500" },
  theme_park: { icon: Landmark, label: "Theme Park", color: "text-pink-500" },
  search: { icon: Search, label: "Search", color: "text-primary" },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || typeConfig[type.toUpperCase()] || { icon: MapPin, label: "Location", color: "text-muted-foreground" };
}

interface TourLocationPickerProps {
  value: string;
  onSelect: (name: string, type?: string, productCode?: string) => void;
  placeholder?: string;
  variant?: "button" | "inline";
}

const TourLocationPicker = ({
  value,
  onSelect,
  placeholder = "Where do you want to go?",
  variant = "button",
}: TourLocationPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TourLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showingRecent, setShowingRecent] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchLocations = useCallback(async (keyword: string) => {
    if (keyword.length < 2) {
      setResults([]);
      setShowingRecent(true);
      return;
    }
    setLoading(true);
    setShowingRecent(false);
    try {
      const term = `%${keyword}%`;
      const keyLower = keyword.toLowerCase().trim();

      // 1. Check destination_classification_cache first (instant O(1) lookup)
      // 2. Query viator_destination_map (authoritative dest types: COUNTRY, CITY, ISLAND, REGION, etc.)
      // 3. Query attractions for landmarks
      // 4. Query tour_product_cache for specific experience names
      const [classificationRes, destMapRes, attractionsRes, productsRes] = await Promise.all([
        supabase
          .from("destination_classification_cache")
          .select("term, classification, resolved_cities, country, dest_id")
          .eq("term", keyLower)
          .maybeSingle(),
        supabase
          .from("viator_destination_map")
          .select("dest_id, city_name, country, dest_type")
          .or(`city_name.ilike.${term},country.ilike.${term}`)
          .order("dest_type")
          .limit(30),
        supabase
          .from("attractions")
          .select("id, name, city, country, category, popularity_score")
          .or(`name.ilike.${term},city.ilike.${term}`)
          .order("popularity_score", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from("tour_product_cache")
          .select("product_code, title, destination")
          .ilike("title", term)
          .eq("is_active", true)
          .order("review_count", { ascending: false })
          .limit(8),
      ]);

      const seen = new Set<string>();
      const locations: TourLocation[] = [];

      // ── Priority 1: Exact classification cache hit (fastest) ──
      if (classificationRes.data) {
        const c = classificationRes.data;
        if (c.classification === "country") {
          const displayName = keyword.replace(/\b\w/g, ch => ch.toUpperCase());
          seen.add(keyLower);
          locations.push({
            location_id: `country-${keyLower}`,
            name: displayName,
            country: displayName,
            full_name: `${displayName} — ${c.resolved_cities?.length || 0} cities`,
            type: "COUNTRY",
            activityCount: c.resolved_cities?.length,
          });
          // Also add top cities for this country
          if (c.resolved_cities) {
            for (const city of c.resolved_cities.slice(0, 4)) {
              const ck = city.toLowerCase();
              if (!seen.has(ck)) {
                seen.add(ck);
                locations.push({
                  location_id: `city-${ck}`,
                  name: city,
                  country: displayName,
                  full_name: `${city}, ${displayName}`,
                  type: "CITY",
                });
              }
            }
          }
        } else if (c.classification === "city") {
          const displayName = keyword.replace(/\b\w/g, ch => ch.toUpperCase());
          seen.add(keyLower);
          locations.push({
            location_id: `city-${keyLower}`,
            name: displayName,
            country: c.country || "",
            full_name: c.country ? `${displayName}, ${c.country}` : displayName,
            type: "CITY",
          });
        }
      }

      // ── Priority 2: viator_destination_map (authoritative types) ──
      if (destMapRes.data) {
        // Collect countries matched
        const countrySet = new Map<string, { count: number; destIds: string[] }>();
        // Collect cities/regions/islands
        const destEntries: Array<{ name: string; country: string; type: string; destId: string }> = [];

        for (const row of destMapRes.data) {
          const countryLower = (row.country || "").toLowerCase();
          const cityLower = (row.city_name || "").toLowerCase();
          const destType = row.dest_type || "CITY";

          // Check if the search term matches the country name
          if (countryLower.includes(keyLower) && destType === "CITY") {
            if (!countrySet.has(countryLower)) {
              countrySet.set(countryLower, { count: 0, destIds: [] });
            }
            countrySet.get(countryLower)!.count++;
          }

          // Check if city_name matches the search
          if (cityLower.includes(keyLower) || keyLower.includes(cityLower)) {
            destEntries.push({
              name: row.city_name,
              country: row.country || "",
              type: destType,
              destId: row.dest_id,
            });
          }
        }

        // Add country-level results
        for (const [countryKey, info] of Array.from(countrySet.entries())) {
          if (!seen.has(countryKey)) {
            seen.add(countryKey);
            const displayName = countryKey.replace(/\b\w/g, c => c.toUpperCase());
            locations.push({
              location_id: `country-${countryKey}`,
              name: displayName,
              country: displayName,
              full_name: `${displayName} — ${info.count} destinations`,
              type: "COUNTRY",
              activityCount: info.count,
            });
          }
        }

        // Add specific destination results (CITY, ISLAND, REGION, etc.)
        for (const entry of destEntries) {
          const dedup = entry.name.toLowerCase();
          if (!seen.has(dedup)) {
            seen.add(dedup);
            // Map dest_type correctly
            let displayType = entry.type;
            // "Maldives" with dest_type COUNTRY should show as country
            if (displayType === "COUNTRY") {
              locations.push({
                location_id: `country-${dedup}`,
                name: entry.name,
                country: entry.name,
                full_name: entry.name,
                type: "COUNTRY",
              });
            } else {
              locations.push({
                location_id: `dest-${entry.destId}`,
                name: entry.name,
                country: entry.country,
                full_name: entry.country ? `${entry.name}, ${entry.country}` : entry.name,
                type: displayType, // Preserves CITY, ISLAND, REGION, NATIONAL_PARK, etc.
              });
            }
          }
        }
      }

      // ── Priority 3: Attractions (landmarks, museums, etc.) ──
      if (attractionsRes.data) {
        // City-level entries from attraction matches
        const cityMatches = new Map<string, { country: string; count: number }>();
        for (const item of attractionsRes.data) {
          if (item.city.toLowerCase().includes(keyLower)) {
            const key = `${item.city.toLowerCase()}-${item.country.toLowerCase()}`;
            if (!cityMatches.has(key)) {
              cityMatches.set(key, { country: item.country, count: 1 });
            } else {
              cityMatches.get(key)!.count++;
            }
          }
        }
        for (const [key, val] of Array.from(cityMatches.entries())) {
          const cityName = key.split("-")[0].replace(/\b\w/g, c => c.toUpperCase());
          const dedup = cityName.toLowerCase();
          if (!seen.has(dedup)) {
            seen.add(dedup);
            locations.push({
              location_id: `city-${key}`,
              name: cityName,
              country: val.country,
              full_name: `${cityName}, ${val.country} — ${val.count} attractions`,
              type: "CITY",
              activityCount: val.count,
            });
          }
        }

        // Individual attractions (only if search is 3+ words or very specific)
        if (keyword.split(/\s+/).length >= 2) {
          for (const item of attractionsRes.data) {
            const dedup = `${item.name.toLowerCase()}-${item.country.toLowerCase()}`;
            if (!seen.has(dedup)) {
              seen.add(dedup);
              locations.push({
                location_id: item.id,
                name: item.name,
                country: item.country,
                full_name: `${item.name}, ${item.city}, ${item.country}`,
                type: item.category || "attraction",
              });
            }
            if (locations.length >= 12) break;
          }
        }
      }

      // ── Priority 4: Tour products (specific experience names) ──
      if (productsRes.data && keyword.split(/\s+/).length >= 2) {
        for (const prod of productsRes.data) {
          const dedup = prod.title.toLowerCase();
          if (!seen.has(dedup)) {
            seen.add(dedup);
            locations.push({
              location_id: `product-${prod.product_code}`,
              name: prod.title,
              country: prod.destination || "",
              full_name: prod.destination ? `${prod.title}, ${prod.destination}` : prod.title,
              type: "attraction",
            });
          }
          if (locations.length >= 15) break;
        }
      }

      // Sort: Countries first, then cities/regions/islands, then attractions
      const typePriority: Record<string, number> = {
        COUNTRY: 0, CITY: 1, ISLAND: 1, REGION: 2, TOWN: 2,
        STATE: 3, PROVINCE: 3, NATIONAL_PARK: 3,
        theme_park: 3.5,
        attraction: 5, museum: 5, monument: 5, park: 4.5, beach: 4.5,
        search: 10,
      };
      locations.sort((a, b) => {
        const pa = typePriority[a.type] ?? 5;
        const pb = typePriority[b.type] ?? 5;
        if (pa !== pb) return pa - pb;
        // Within same priority, prefer exact name match
        const aExact = a.name.toLowerCase() === keyLower ? 0 : 1;
        const bExact = b.name.toLowerCase() === keyLower ? 0 : 1;
        return aExact - bExact;
      });

      // Always offer free-text search option at the top unless there's an exact name match
      const hasExactMatch = locations.some(l => l.name.toLowerCase() === keyLower);
      if (!hasExactMatch) {
        locations.unshift({
          location_id: `freetext-${keyword}`,
          name: keyword,
          country: "",
          full_name: `Search for "${keyword}" experiences`,
          type: "search",
        });
      }

      const finalLocations = locations.slice(0, 15);

      // ── Enrich with tour counts (non-blocking for attractions/products) ──
      const destinationNames = finalLocations
        .filter(l => !["attraction", "museum", "monument", "search"].includes(l.type) && !l.location_id.startsWith("product-"))
        .map(l => l.name);

      if (destinationNames.length > 0) {
        const counts = await fetchTourCounts(destinationNames);
        for (const loc of finalLocations) {
          if (loc.location_id.startsWith("product-") || ["attraction", "museum", "monument", "search"].includes(loc.type)) continue;
          const count = counts.get(loc.name.toLowerCase());
          if (count && count > 0) {
            loc.activityCount = count;
            // Update full_name to include count
            const suffix = `${count} experience${count !== 1 ? "s" : ""}`;
            if (loc.type === "COUNTRY") {
              loc.full_name = `${loc.name} — ${suffix}`;
            } else {
              loc.full_name = loc.country
                ? `${loc.name}, ${loc.country} — ${suffix}`
                : `${loc.name} — ${suffix}`;
            }
          }
        }
      }

      setResults(finalLocations);
    } catch (e) {
      console.warn("[TourLocationPicker] search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults([]);
      setShowingRecent(true);
      return;
    }
    debounceRef.current = setTimeout(() => searchLocations(val), 200);
  };

  const handleSelect = (loc: TourLocation) => {
    addRecentLocation(loc);
    // Extract product code if it's a product-level entry
    const productCode = loc.location_id.startsWith("product-")
      ? loc.location_id.replace("product-", "")
      : undefined;
    onSelect(loc.name, loc.type, productCode);
    setOpen(false);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setShowingRecent(true);
    }
  }, [open]);

  const recentLocations = getRecentLocations();
  const displayList = showingRecent ? recentLocations : results;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "button" ? (
          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 h-[42px] sm:h-[44px] hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            {value ? (
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{value}</span>
            ) : (
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground truncate">{placeholder}</span>
            )}
          </button>
        ) : (
          <button className="w-full text-left border border-border/40 rounded-2xl px-4 py-3 h-[48px] sm:h-[52px] flex items-center gap-3 bg-muted/20 hover:border-primary/30 transition-all duration-300">
            <MapPin className="w-4.5 h-4.5 text-primary/50 flex-shrink-0" />
            {value ? (
              <span className="text-sm sm:text-base font-medium text-foreground truncate">{value}</span>
            ) : (
              <span className="text-sm sm:text-base font-medium text-muted-foreground/40 truncate">{placeholder}</span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={false}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search city, country or attraction..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />}
        </div>

        <div className="min-h-[120px] max-h-64 overflow-y-auto py-1">
          {showingRecent && recentLocations.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Clock className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recent Searches</span>
            </div>
          )}

          {!showingRecent && results.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Destinations</span>
            </div>
          )}

          {displayList.length === 0 ? (
            <div className="text-center py-6 px-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Searching locations...</p>
              ) : showingRecent ? (
                <div>
                  <Compass className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Search for a city, country or attraction</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">e.g. "Paris", "Maldives", "Taj Mahal"</p>
                </div>
              ) : query.length >= 2 ? (
                <p className="text-sm text-muted-foreground">No locations found</p>
              ) : (
                <p className="text-sm text-muted-foreground">Type at least 2 characters...</p>
              )}
            </div>
          ) : (
            displayList.map((loc, i) => {
              const config = getTypeConfig(loc.type);
              const Icon = config.icon;
              const isRecent = showingRecent;

              return (
                <button
                  key={`${loc.location_id}-${i}`}
                  onClick={() => handleSelect(loc)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    loc.type === "COUNTRY" ? "bg-accent/10" : "bg-primary/10"
                  }`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{loc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{loc.full_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-muted ${config.color}`}>
                      {config.label}
                    </span>
                    {isRecent && (
                      <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Recent</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TourLocationPicker;
