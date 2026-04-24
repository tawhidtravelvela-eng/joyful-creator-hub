import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, Loader2, TrendingUp, Building2, Map, Landmark, Clock, Hotel, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

export interface HotelLocation {
  location_id: string;
  city_name: string;
  country_name: string;
  type: string;
  full_region_name: string;
  hotel_ids?: string[];
  search_type?: "city" | "hotel";
  actual_city_name?: string;
}

// ── Recent hotel locations (persisted) ──
const RECENT_KEY = "hotel_location_recent";

function getRecentLocations(): HotelLocation[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function addRecentLocation(loc: HotelLocation) {
  try {
    const recent = getRecentLocations().filter(
      (r) => r.location_id !== loc.location_id
    );
    recent.unshift(loc);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {
    /* ignore */
  }
}

// ── Nominatim type mapping ──
type NominatimResult = {
  place_id: number;
  display_name: string;
  type: string;
  class: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    tourism?: string;
  };
  name?: string;
};

function mapNominatimType(cls: string, type: string): string {
  if (cls === "tourism" || type === "hotel" || type === "hostel" || type === "motel" || type === "guest_house") return "HOTEL";
  if (cls === "tourism" && (type === "attraction" || type === "museum" || type === "viewpoint")) return "POINT_OF_INTEREST";
  if (type === "city" || type === "town" || type === "village" || type === "administrative") return "CITY";
  if (type === "suburb" || type === "neighbourhood" || type === "quarter" || type === "residential") return "NEIGHBORHOOD";
  if (cls === "amenity" || cls === "historic" || cls === "leisure") return "POINT_OF_INTEREST";
  return "CITY";
}

function extractCityName(result: NominatimResult): string {
  if (result.name) return result.name;
  const addr = result.address;
  if (addr) return addr.city || addr.town || addr.village || "";
  return result.display_name.split(",")[0];
}

function extractCountry(result: NominatimResult): string {
  return result.address?.country || result.display_name.split(",").pop()?.trim() || "";
}

function nominatimToLocation(result: NominatimResult): HotelLocation {
  const mappedType = mapNominatimType(result.class, result.type);
  return {
    location_id: String(result.place_id),
    city_name: extractCityName(result),
    country_name: extractCountry(result),
    type: mappedType,
    full_region_name: result.display_name,
    search_type: "city",
  };
}

// ── Catalogue hotel result ──
interface CatalogueHotel {
  tj_hotel_id: string;
  unica_id?: string | number | null;
  name: string;
  city_name: string;
  country_name: string;
  rating: number;
  property_type: string;
  image_url: string | null;
}

interface CatalogueCity {
  city_name: string;
  country_name: string;
  hotel_count: number;
}

const typeConfig: Record<string, { icon: typeof MapPin; label: string; color: string }> = {
  CITY: { icon: Map, label: "City", color: "text-primary" },
  NEIGHBORHOOD: { icon: MapPin, label: "Area", color: "text-accent" },
  POINT_OF_INTEREST: { icon: Landmark, label: "Landmark", color: "text-warning0" },
  HOTEL: { icon: Hotel, label: "Hotel", color: "text-success0" },
  CATALOGUE_CITY: { icon: Building2, label: "City", color: "text-primary" },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || { icon: MapPin, label: type?.replace(/_/g, " ") || "Location", color: "text-muted-foreground" };
}

interface HotelLocationPickerProps {
  selected: HotelLocation | null;
  onSelect: (location: HotelLocation) => void;
  placeholder?: string;
}

const HotelLocationPicker = ({
  selected,
  onSelect,
  placeholder = "Where are you going?",
}: HotelLocationPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [nominatimResults, setNominatimResults] = useState<HotelLocation[]>([]);
  const [catalogueHotels, setCatalogueHotels] = useState<CatalogueHotel[]>([]);
  const [catalogueCities, setCatalogueCities] = useState<CatalogueCity[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const [showingRecent, setShowingRecent] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const catalogueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nominatimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fast catalogue search (150ms debounce — DB is indexed)
  const searchCatalogue = useCallback(async (keyword: string) => {
    if (keyword.length < 2) {
      setCatalogueHotels([]);
      setCatalogueCities([]);
      return;
    }
    setCatalogueLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-hotels-catalogue", {
        body: { query: keyword, limit: 10 },
      });
      if (!error && data?.success) {
        setCatalogueHotels(data.hotels || []);
        setCatalogueCities(data.cities || []);
      }
    } catch { /* ignore */ }
    setCatalogueLoading(false);
  }, []);

  // Slower Nominatim search (500ms debounce — external API)
  const searchNominatim = useCallback(async (keyword: string) => {
    if (keyword.length < 3) {
      setNominatimResults([]);
      return;
    }
    setNominatimLoading(true);
    // Abort previous nominatim request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
        q: keyword,
        format: "json",
        addressdetails: "1",
        limit: "6",
        "accept-language": "en",
      });
      const res = await fetch(url, {
        headers: { "User-Agent": "LovableTravelApp/1.0" },
        signal: controller.signal,
      });
      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        const seen = new Set<string>();
        const locations: HotelLocation[] = [];
        for (const item of data) {
          const loc = nominatimToLocation(item);
          const key = `${loc.city_name.toLowerCase()}-${loc.country_name.toLowerCase()}-${loc.type}`;
          if (!seen.has(key) && loc.city_name) {
            seen.add(key);
            locations.push(loc);
          }
        }
        setNominatimResults(locations);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error("Nominatim error:", e);
      }
    }
    setNominatimLoading(false);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (catalogueDebounceRef.current) clearTimeout(catalogueDebounceRef.current);
    if (nominatimDebounceRef.current) clearTimeout(nominatimDebounceRef.current);

    if (!value.trim()) {
      setCatalogueHotels([]);
      setCatalogueCities([]);
      setNominatimResults([]);
      setShowingRecent(true);
      return;
    }

    setShowingRecent(false);

    // Catalogue: fast debounce (150ms) — indexed DB query
    catalogueDebounceRef.current = setTimeout(() => searchCatalogue(value), 150);

    // Nominatim: slower debounce (500ms) — external API, non-blocking
    nominatimDebounceRef.current = setTimeout(() => searchNominatim(value), 500);
  };

  const handleSelect = (loc: HotelLocation) => {
    addRecentLocation(loc);
    onSelect(loc);
    setOpen(false);
  };

  const handleSelectCatalogueHotel = (hotel: CatalogueHotel) => {
    const liveHotelId = String(hotel.unica_id || hotel.tj_hotel_id);
    const loc: HotelLocation = {
      location_id: String(hotel.tj_hotel_id),
      city_name: hotel.name,
      country_name: `${hotel.city_name}, ${hotel.country_name}`,
      type: "HOTEL",
      full_region_name: `${hotel.name}, ${hotel.city_name}, ${hotel.country_name}`,
      hotel_ids: [liveHotelId],
      search_type: "hotel",
      actual_city_name: hotel.city_name,
    };
    handleSelect(loc);
  };

  const handleSelectCatalogueCity = (city: CatalogueCity) => {
    const loc: HotelLocation = {
      location_id: `cat-${city.city_name.toLowerCase()}`,
      city_name: city.city_name,
      country_name: city.country_name,
      type: "CATALOGUE_CITY",
      full_region_name: `${city.city_name}, ${city.country_name}`,
      search_type: "city",
    };
    handleSelect(loc);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setCatalogueHotels([]);
      setCatalogueCities([]);
      setNominatimResults([]);
      setShowingRecent(true);
    }
  }, [open]);

  const recentLocations = getRecentLocations();
  const hasCatalogueResults = catalogueHotels.length > 0 || catalogueCities.length > 0;
  const hasNominatimResults = nominatimResults.length > 0;
  const hasResults = hasCatalogueResults || hasNominatimResults;
  const loading = catalogueLoading || nominatimLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          {selected ? (
            <div className="min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-semibold text-foreground block leading-tight truncate">
                {selected.city_name}
              </span>
              <span className="text-[10px] text-muted-foreground truncate block leading-tight">
                {selected.country_name}
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground truncate">
              {placeholder}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={false}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search city, hotel, or landmark..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          {loading && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Results list */}
        <div className="min-h-[120px] max-h-72 overflow-y-auto py-1">
          {/* Recent searches */}
          {showingRecent && recentLocations.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Searches
                </span>
              </div>
              {recentLocations.map((loc, i) => {
                const config = getTypeConfig(loc.type);
                const Icon = config.icon;
                return (
                  <button
                    key={`recent-${loc.location_id}-${i}`}
                    onClick={() => handleSelect(loc)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{loc.city_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{loc.full_region_name}</p>
                    </div>
                    <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Recent
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {showingRecent && recentLocations.length === 0 && (
            <div className="text-center py-6 px-4">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Search for a city, hotel, or landmark
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                e.g. "Dubai", "Hilton", "Taj Mahal"
              </p>
            </div>
          )}

          {/* Catalogue cities (from DB — fastest, shown first) */}
          {!showingRecent && catalogueCities.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
                <Map className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Cities
                </span>
              </div>
              {catalogueCities.map((city, i) => (
                <button
                  key={`cat-city-${i}`}
                  onClick={() => handleSelectCatalogueCity(city)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Map className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{city.city_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{city.country_name}</p>
                  </div>
                  <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {city.hotel_count} hotel{city.hotel_count > 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Catalogue hotels (from DB) */}
          {!showingRecent && catalogueHotels.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
                <Hotel className="w-3 h-3 text-success0" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hotels
                </span>
              </div>
              {catalogueHotels.map((hotel, i) => (
                <button
                  key={`cat-hotel-${hotel.tj_hotel_id}-${i}`}
                  onClick={() => handleSelectCatalogueHotel(hotel)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-success/50/10 flex items-center justify-center flex-shrink-0">
                    <Hotel className="w-4 h-4 text-success0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{hotel.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {hotel.city_name}, {hotel.country_name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-[9px] font-semibold text-success bg-success/50/10 px-1.5 py-0.5 rounded-full uppercase">
                      Hotel
                    </span>
                    {hotel.rating > 0 && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-warning text-warning" />
                        {hotel.rating}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Nominatim location results (arrive later, appended below) */}
          {!showingRecent && nominatimResults.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Locations
                </span>
              </div>
              {nominatimResults.map((loc, i) => {
                const config = getTypeConfig(loc.type);
                const Icon = config.icon;
                return (
                  <button
                    key={`nom-${loc.location_id}-${i}`}
                    onClick={() => handleSelect(loc)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{loc.city_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{loc.full_region_name}</p>
                    </div>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${config.color} bg-primary/5`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* Loading state — only show if no results yet */}
          {!showingRecent && !hasResults && catalogueLoading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {/* No results */}
          {!showingRecent && !hasResults && !loading && query.length >= 2 && (
            <div className="text-center py-6 px-4">
              <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a different search term
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HotelLocationPicker;
