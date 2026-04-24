import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import {
  Star, Clock, MapPin, Check, Loader2, Search, SlidersHorizontal, X,
  ArrowUpDown, Globe, Camera, Sparkles,
  TrendingUp, Heart, Map as MapIcon, LayoutGrid, Lightbulb, ChevronRight,
  Ticket, Ship, UtensilsCrossed, Mountain, Compass, Landmark, Moon,
} from "lucide-react";
import ImageCarousel from "@/components/ui/image-carousel";
import TourLocationPicker from "@/components/home/TourLocationPicker";
import TourSearchLoader from "@/components/tours/TourSearchLoader";
import HybridSearchLoader from "@/components/site/hybrid/HybridSearchLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { getImage } from "@/utils/images";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import HybridTourCard from "@/components/site/hybrid/cards/HybridTourCard";
import {
  HybridResultsHeader,
  HybridInsightsRail,
} from "@/components/site/hybrid/results";
import { cn } from "@/lib/utils";
import { hydrateTourDataFromWire } from "@/lib/tourWireAdapter";

// ── Types ──
interface Tour {
  id: string;
  productCode?: string;
  velaId?: string;
  name: string;
  title?: string;
  slug?: string;
  destination: string;
  duration: string;
  price: number;
  category: string;
  rating: number;
  image: string | null;
  images?: string[];
  highlights: string[];
  reviewCount?: number;
  source?: "local" | "experience";
  shortDescription?: string;
  pricingType?: string;
  lat?: number | null;
  lng?: number | null;
  tagIds?: number[];
  placesCovered?: string[];
  _matchMeta?: {
    matchedTerms: string[];
    matchCount: number;
    totalTerms: number;
    matchDetails: { term: string; fields: string[] }[];
  };
  _matchedOption?: {
    optionName: string;
    optionCode: string;
    optionPrice: number;
    optionCurrency: string;
  };
  _pickType?: "best_match" | "best_value" | "cheapest" | "top_rated" | "best_option_match";
}

interface TrendingDest {
  name: string;
  destinationId?: string;
  activityCount?: number;
  image?: string;
}

type SortOption = "recommended" | "price-low" | "price-high" | "rating" | "duration" | "newest";
type ViewMode = "grid" | "map";

// ── Category definitions with comprehensive Viator tagId mapping ──
const ALL_CATEGORIES = [
  { key: "recommended", label: "⭐ Recommended", icon: Sparkles, tagIds: [] as number[] },
  { key: "tickets", label: "Tickets & Passes", icon: Ticket, tagIds: [21972, 11889, 12716, 21917] },
  { key: "tours", label: "Guided Tours", icon: Compass, tagIds: [21510, 11873, 21503, 21514, 21515] },
  { key: "transfers", label: "Transfers", icon: Ship, tagIds: [11881, 21885] },
  { key: "food", label: "Food & Drink", icon: UtensilsCrossed, tagIds: [12718, 21911, 21917, 21916, 21913] },
  { key: "adventure", label: "Adventure", icon: Mountain, tagIds: [21880, 11874, 21879, 21881, 21882] },
  { key: "cruises", label: "Cruises & Boats", icon: Ship, tagIds: [11876, 21866, 21867] },
  { key: "culture", label: "Culture & History", icon: Landmark, tagIds: [21511, 21512, 21513, 21870] },
  { key: "nightlife", label: "Nightlife", icon: Moon, tagIds: [21874, 21875] },
  { key: "nature", label: "Nature & Parks", icon: Mountain, tagIds: [11878, 21883, 21884, 21871] },
  { key: "water", label: "Water Sports", icon: Ship, tagIds: [21886, 21887, 21888] },
  { key: "wellness", label: "Wellness & Spa", icon: Heart, tagIds: [21889, 21890, 21891] },
  { key: "classes", label: "Classes & Workshops", icon: Sparkles, tagIds: [21892, 21893, 21894] },
  { key: "photography", label: "Photography", icon: Camera, tagIds: [21895, 21896] },
];

// ── Destination hero images (self-hosted in Supabase storage — never expires) ──
const STORAGE_BASE = "https://vqvkgdjuzqmysmhhaswm.supabase.co/storage/v1/object/public/assets/destinations";
const destImg = (slug: string) => `${STORAGE_BASE}/dest-${slug}.jpg`;

const DEST_IMAGES: Record<string, string> = {
  // Asia — Tier 1
  Singapore: destImg("singapore"),
  Bangkok: destImg("bangkok"),
  "Kuala Lumpur": destImg("kuala-lumpur"),
  Penang: destImg("penang"),
  Langkawi: destImg("langkawi"),
  Pattaya: destImg("pattaya"),
  Tokyo: destImg("tokyo"),
  Bali: destImg("bali"),
  Phuket: destImg("phuket"),
  Seoul: destImg("seoul"),
  "Hong Kong": destImg("hong-kong"),
  Osaka: destImg("osaka"),
  Hanoi: destImg("hanoi"),
  "Ho Chi Minh City": destImg("ho-chi-minh-city"),
  Taipei: destImg("taipei"),
  Kyoto: destImg("kyoto"),
  "Chiang Mai": destImg("chiang-mai"),
  Jakarta: destImg("jakarta"),
  Manila: destImg("manila"),
  Cebu: destImg("cebu"),
  Colombo: destImg("colombo"),
  Yangon: destImg("yangon"),
  "Koh Samui": destImg("koh-samui"),
  // South Asia
  Delhi: destImg("delhi"),
  Mumbai: destImg("mumbai"),
  Jaipur: destImg("jaipur"),
  Goa: destImg("goa"),
  Kathmandu: destImg("kathmandu"),
  Maldives: destImg("maldives"),
  Kolkata: destImg("kolkata"),
  "Cox's Bazar": destImg("coxs-bazar"),
  // Middle East
  Dubai: destImg("dubai"),
  Istanbul: destImg("istanbul"),
  "Abu Dhabi": destImg("abu-dhabi"),
  Doha: destImg("doha"),
  Amman: destImg("amman"),
  Cappadocia: destImg("cappadocia"),
  // Europe
  Paris: destImg("paris"),
  London: destImg("london"),
  Rome: destImg("rome"),
  Barcelona: destImg("barcelona"),
  Amsterdam: destImg("amsterdam"),
  Prague: destImg("prague"),
  Vienna: destImg("vienna"),
  Lisbon: destImg("lisbon"),
  Athens: destImg("athens"),
  Berlin: destImg("berlin"),
  Venice: destImg("venice"),
  Florence: destImg("florence"),
  Santorini: destImg("santorini"),
  Dubrovnik: destImg("dubrovnik"),
  Edinburgh: destImg("edinburgh"),
  Budapest: destImg("budapest"),
  // Americas
  "New York": destImg("new-york"),
  Miami: destImg("miami"),
  Cancun: destImg("cancun"),
  "Rio de Janeiro": destImg("rio-de-janeiro"),
  "Buenos Aires": destImg("buenos-aires"),
  Lima: destImg("lima"),
  "Las Vegas": destImg("las-vegas"),
  "San Francisco": destImg("san-francisco"),
  // Africa & Oceania
  "Cape Town": destImg("cape-town"),
  Nairobi: destImg("nairobi"),
  Cairo: destImg("cairo"),
  Marrakech: destImg("marrakech"),
  Sydney: destImg("sydney"),
  Melbourne: destImg("melbourne"),
  Auckland: destImg("auckland"),
  Queenstown: destImg("queenstown"),
  Fiji: destImg("fiji"),
  Zanzibar: destImg("zanzibar"),
};

const Tours = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isHybrid } = useIsHybridSkin();
  const [localTours, setLocalTours] = useState<Tour[]>([]);
  const [experienceTours, setViatorTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [experienceLoading, setViatorLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentQuery, setCurrentQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || searchParams.get("keyword") || "");
  const { currency, formatDirectPrice } = useCurrency();
  const searchAbortRef = useRef<AbortController | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("category") || null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  

  // Phase 2: Trending destinations — instant from DB, no loading state
  const [trendingDests, setTrendingDests] = useState<TrendingDest[]>([]);

  // Phase 5: AI suggestions
  const [aiTip, setAiTip] = useState<string>("");

  // Whether we're in "discovery" mode (no search yet)
  const hasSearched = experienceTours.length > 0 || experienceLoading || currentQuery.length > 0;

  // ── Infinite scroll: reveal more cards as user scrolls ──
  useEffect(() => {
    setVisibleCount(30); // Reset on new results
  }, [experienceTours]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 30);
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  // ── Load local tours ──
  useEffect(() => {
    const fetchTours = async () => {
      const { data } = await supabase.from("tours").select("*");
      setLocalTours(
        (data as any[])?.filter((t) => t.is_active !== false).map((t) => ({
          ...t, highlights: Array.isArray(t.highlights) ? t.highlights : [], source: "local" as const,
        })) || []
      );
      setLoading(false);
    };
    fetchTours();
  }, []);

  // ── Load trending destinations instantly from DB ──
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        // Query destinations table (public read) — these are proper cities
        const { data: destinations } = await supabase
          .from("destinations")
          .select("name, country, image_url, rating, flights")
          .eq("is_active", true)
          .order("flights", { ascending: false })
          .limit(30);

        if (!destinations || destinations.length === 0) return;

        // Get real activity counts from tour_sync_state (efficient — one row per destination)
        const { data: syncStates } = await supabase
          .from("tour_sync_state")
          .select("destination_name, products_detailed")
          .eq("status", "completed")
          .gt("products_detailed", 0);

        // Count products per destination city
        const countMap = new Map<string, number>();
        if (syncStates) {
          for (const s of syncStates) {
            const dest = s.destination_name?.toLowerCase();
            if (dest) countMap.set(dest, s.products_detailed || 0);
          }
        }

        // Build trending list — only cities that have actual tour products
        const trending: TrendingDest[] = [];
        for (const d of destinations) {
          const realCount = countMap.get(d.name.toLowerCase()) || 0;
          // Only show cities with synced products
          if (realCount === 0) continue;

          trending.push({
            name: d.name,
            activityCount: realCount,
            image: DEST_IMAGES[d.name] || d.image_url || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop`,
          });
        }

        // Sort by activity count descending
        trending.sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0));
        setTrendingDests(trending.slice(0, 12));
      } catch (e) { console.warn("Trending fetch error:", e); }
    };
    fetchTrending();
  }, []);

  // ── AI suggestion on destination ──
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) { setAiTip(""); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("unified-tour-search", {
          body: { action: "suggestions", destination: searchQuery },
        });
        if (data) hydrateTourDataFromWire(data);
        if (data?.success && data.suggestions?.seasonTip) {
          setAiTip(data.suggestions.seasonTip);
        } else { setAiTip(""); }
      } catch { setAiTip(""); }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const mapProducts = (products: any[], query: string) =>
    products.map((p: any) => ({
      id: p.id, productCode: p.productCode, velaId: p.velaId || null,
      name: p.name, slug: p.slug || null, destination: p.destination || query,
      duration: p.duration || "", price: p.price || 0, category: p.category || "Tour",
      rating: p.rating || 0, image: p.image, images: Array.isArray(p.images) ? p.images : [],
      highlights: Array.isArray(p.highlights) ? p.highlights.map(String) : [],
      reviewCount: p.reviewCount || 0, source: "experience" as const,
      shortDescription: p.shortDescription || "", pricingType: p.pricingType || "PER_PERSON",
      lat: p.lat || null, lng: p.lng || null, tagIds: p.tagIds || [],
      placesCovered: Array.isArray(p.placesCovered) ? p.placesCovered : [],
      _matchMeta: p._matchMeta || undefined,
      _matchedOption: p._matchedOption || undefined,
      _pickType: p._pickType || undefined,
    }));

  const searchExperiences = async (query: string, opts: { tags?: number[]; category?: string } = {}) => {
    const { tags, category } = opts;
    const searchText = query.trim();
    if (!searchText || searchText.length < 2) {
      setViatorTours([]); setHasMore(false); setTotalProducts(0); return;
    }
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setViatorLoading(true);

    try {
      const useTags = tags || (category ? ALL_CATEGORIES.find(c => c.key === category)?.tagIds : undefined);
      const action = useTags ? "search" : "freetext";

      const body: any = {
        action,
        targetCurrency: currency,
        limit: 2000,
        start: 1,
        cacheOnly: true,
      };

      if (action === "search") {
        body.searchText = searchText;
        if (useTags) body.tags = useTags;
        body.sortOrder = sortBy === "price-low" ? "PRICE" : sortBy === "rating" ? "TRAVELER_RATING" : "DEFAULT";
      } else {
        body.searchText = searchText;
        body.progressive = false;
      }

      const { data, error } = await supabase.functions.invoke("unified-tour-search", { body });
      if (data) hydrateTourDataFromWire(data);
      if (error) throw error;
      if (controller.signal.aborted) return;

      const products = data?.products || data?.tours || [];
      if (data?.success && products.length > 0) {
        const mapped = mapProducts(products, query);
        // Server already sorts by conversion score — no client re-sort needed
        setViatorTours(mapped);
        setTotalProducts(data.totalProducts || data.totalCount || mapped.length);
        setCurrentQuery(query);
        setHasMore(false);
      } else {
        setViatorTours([]);
      }
      setViatorLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Experience search error:", err);
      setViatorTours([]);
      setViatorLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (selectedCategory) params.category = selectedCategory;
    setSearchParams(params);
    searchExperiences(searchQuery, { category: selectedCategory || undefined });
  };

  // Auto-search on load if q param present
  useEffect(() => {
    const q = searchParams.get("q");
    const cat = searchParams.get("category");
    const locType = searchParams.get("locType");
    if (cat) setSelectedCategory(cat);
    
    if (q) { setSearchQuery(q); searchExperiences(q, { category: cat || undefined }); }
  }, []);

  // Handle category change

  // Handle destination click
  const handleDestinationClick = (dest: TrendingDest) => {
    setSearchQuery(dest.name);
    setSearchParams({ q: dest.name });
    searchExperiences(dest.name);
  };

  const allTours = [...localTours, ...experienceTours];

  // Smart dynamic categories derived from actual search results
  const smartCategories = useMemo(() => {
    if (experienceTours.length === 0) return [];
    
    // Count how many results match each category's tagIds
    const counted = ALL_CATEGORIES
      .filter(cat => cat.key !== "recommended") // handled separately
      .map(cat => {
        const matchCount = experienceTours.filter(tour => 
          (tour.tagIds || []).some(tid => cat.tagIds.includes(tid))
        ).length;
        return { ...cat, count: matchCount };
      })
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count);
    
    // Always prepend "Recommended" with total count
    return [
      { ...ALL_CATEGORIES[0], count: experienceTours.length },
      ...counted.slice(0, 7), // Show top 7 relevant categories
    ];
  }, [experienceTours]);


  const budgetTiers = useMemo(() => {
    const prices = allTours.map((t) => t.price).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length === 0) return [];
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];
    const max = prices[prices.length - 1];
    return [
      { key: "budget", label: "Budget", icon: "💚", max: q1, desc: `Under ${formatDirectPrice(q1)}`, count: prices.filter(p => p <= q1).length },
      { key: "mid", label: "Mid-Range", icon: "💙", min: q1, max: q3, desc: `${formatDirectPrice(q1)} – ${formatDirectPrice(q3)}`, count: prices.filter(p => p > q1 && p <= q3).length },
      { key: "premium", label: "Premium", icon: "💜", min: q3, max, desc: `${formatDirectPrice(q3)}+`, count: prices.filter(p => p > q3).length },
    ].filter(t => t.count > 0);
  }, [allTours, currency]);

  const getDurationMinutes = (dur: string): number => {
    if (!dur) return 0;
    const d = dur.toLowerCase();
    const hourMatch = d.match(/(\d+)\s*(?:hour|hr|h)/);
    const dayMatch = d.match(/(\d+)\s*day/);
    const minMatch = d.match(/(\d+)\s*min/);
    if (dayMatch) return parseInt(dayMatch[1]) * 1440;
    if (hourMatch) return parseInt(hourMatch[1]) * 60;
    if (minMatch) return parseInt(minMatch[1]);
    return 0;
  };

  const formatDuration = (dur: string): string => {
    if (!dur) return "";
    const d = dur.toLowerCase().trim();
    const dayMatch = d.match(/(\d+)\s*(?:day|days|d\b)/);
    const hourMatch = d.match(/(\d+)\s*(?:hour|hours|hr|hrs|h\b)/);
    const minMatch = d.match(/(\d+)\s*(?:min|mins|minutes|m\b)/);
    const rangeMatch = d.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:h|hour|hours|hr|hrs)?/);

    if (dayMatch) { const days = parseInt(dayMatch[1]); return days === 1 ? "1 Day" : `${days} Days`; }
    if (rangeMatch && !dayMatch) {
      const from = parseInt(rangeMatch[1]); const to = parseInt(rangeMatch[2]);
      if (from >= 24 || to >= 24) { const fromD = Math.round(from / 24) || 1; const toD = Math.round(to / 24) || 1; return fromD === toD ? `${fromD} Day${fromD > 1 ? "s" : ""}` : `${fromD}–${toD} Days`; }
      return `${from}–${to} Hours`;
    }
    if (hourMatch) {
      const h = parseInt(hourMatch[1]); const m = minMatch ? parseInt(minMatch[1]) : 0;
      if (h >= 24) { const days = Math.round(h / 24) || 1; return days === 1 ? "1 Day" : `${days} Days`; }
      if (m > 0) return `${h}h ${m}m`;
      return h === 1 ? "1 Hour" : `${h} Hours`;
    }
    if (minMatch) { const m = parseInt(minMatch[1]); if (m >= 60) { const h = Math.floor(m / 60); const rem = m % 60; return rem > 0 ? `${h}h ${rem}m` : h === 1 ? "1 Hour" : `${h} Hours`; } return `${m} Min`; }
    return dur;
  };

  const matchesDurationFilter = (dur: string) => {
    if (selectedDurations.length === 0) return true;
    return selectedDurations.some((bucket) => {
      const mins = getDurationMinutes(dur);
      switch (bucket) {
        case "1-3h": return mins >= 60 && mins <= 180;
        case "half-day": return mins > 180 && mins <= 420;
        case "full-day": return mins > 420 && mins <= 1440;
        case "multi-day": return mins > 1440;
        default: return true;
      }
    });
  };

  const filtered = useMemo(() => {
    let result = allTours;
    if (selectedBudget) {
      const tier = budgetTiers.find(t => t.key === selectedBudget);
      if (tier) {
        result = result.filter((t) => {
          if (t.price === 0) return true;
          const min = (tier as any).min ?? 0;
          const max = (tier as any).max ?? Infinity;
          return t.price >= min && t.price <= max;
        });
      }
    }
    if (selectedDurations.length > 0) result = result.filter((t) => matchesDurationFilter(t.duration));
    // Category filter: client-side tagId matching (skip for "recommended" which shows all)
    if (selectedCategory && selectedCategory !== "recommended") {
      const catDef = ALL_CATEGORIES.find(c => c.key === selectedCategory);
      if (catDef && catDef.tagIds.length > 0) {
        result = result.filter(t => (t.tagIds || []).some(tid => catDef.tagIds.includes(tid)));
      }
    }
    // Smart ranking: score by purchase likelihood
    const scoreTour = (t: Tour): number => {
      let score = 0;
      // Review volume is strongest purchase signal
      score += Math.min(t.reviewCount || 0, 5000) / 50; // max 100 pts
      // High rating boosts (4.0+ matters most)
      score += t.rating >= 4.5 ? 40 : t.rating >= 4.0 ? 25 : t.rating >= 3.5 ? 10 : 0;
      // Sweet-spot pricing (not too cheap = scam, not too expensive = niche)
      const p = t.price;
      if (p > 0 && p <= 100) score += 15; // budget-friendly = high conversion
      else if (p > 100 && p <= 300) score += 20; // mid-range = highest conversion
      else if (p > 300 && p <= 500) score += 10;
      // Free cancellation flag
      if (t.category === "Free Cancellation") score += 12;
      // Has images = more trustworthy
      if (t.image) score += 5;
      // Duration sweet spot (2-6 hours converts best)
      const mins = getDurationMinutes(t.duration);
      if (mins >= 120 && mins <= 360) score += 8;
      return score;
    };

    switch (sortBy) {
      case "recommended":
        // Always preserve server ranking order — backend sorts by query relevance,
        // conversion score, and price tiebreaker. No client-side re-sort.
        break;
      case "price-low": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price-high": result = [...result].sort((a, b) => b.price - a.price); break;
      case "rating": result = [...result].sort((a, b) => (b.rating * (b.reviewCount || 1)) - (a.rating * (a.reviewCount || 1))); break;
      case "duration": result = [...result].sort((a, b) => getDurationMinutes(a.duration) - getDurationMinutes(b.duration)); break;
      case "newest": result = [...result].reverse(); break;
    }
    return result;
  }, [allTours, selectedBudget, sortBy, selectedDurations, selectedCategory, budgetTiers, searchQuery]);

  const activeFilterCount = [selectedBudget !== null, selectedDurations.length > 0, selectedCategory !== null].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedBudget(null); setSelectedDurations([]); setSelectedCategory(null); setSortBy("recommended");
  };

  const navigateToTour = (tour: Tour) => {
    if (tour.source === "experience") {
      const dest = (tour.destination || 'experience').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      const slug = tour.slug || `${(tour.name || tour.title || '').trim()}-${tour.destination || ''}`.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      // Append velaId as query param for deterministic resolution
      const vidParam = tour.velaId ? `?vid=${tour.velaId}` : '';
      navigate(`/tours/${dest}/${slug}${vidParam}`, { state: { images: tour.images } });
    } else {
      navigate(`/tours/${tour.id}`, { state: { images: tour.images } });
    }
  };

  // Map view disabled — no coordinates available from Viator search results

  return (
    <Layout>
      {/* ── HERO SECTION ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,12%)] via-[hsl(222,50%,9%)] to-[hsl(222,60%,6%)]" />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(ellipse at 20% 20%, hsl(var(--primary) / 0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, hsl(var(--accent) / 0.08) 0%, transparent 50%)"
        }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/[0.04] blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px"
        }} />

        <div className="container mx-auto px-4 pt-12 sm:pt-16 pb-14 sm:pb-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">Curated Experiences Worldwide</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Discover Unforgettable<br />
                <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">Experiences</span>
              </h1>
              <p className="text-white/35 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed">
                Search thousands of tours, activities & attractions across every destination
              </p>
            </motion.div>
          </div>

          {/* ── SEARCH CARD ── */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-4xl mx-auto bg-card/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/20 border border-white/[0.06] overflow-hidden"
          >
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] flex items-center gap-1.5">
                    <Search className="w-3 h-3" /> Where do you want to explore?
                  </label>
                  <TourLocationPicker
                    value={searchQuery}
                    onSelect={(name, type, productCode) => {
                      // If user picked a specific product/attraction, go directly to its detail page
                      if (productCode) {
                        navigate(`/tours/experience/${productCode}`);
                        return;
                      }
                      setSearchQuery(name);
                      setSearchParams({ q: name });
                      searchExperiences(name);
                    }}
                    placeholder="Paris, Eiffel Tower, Snorkeling in Bali..."
                    variant="inline"
                  />
                </div>
                <Button type="submit" className="w-full sm:w-auto gap-2.5 h-[48px] sm:h-[52px] rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 sm:px-10 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 transition-all duration-300 text-sm sm:text-base" size="lg">
                  <Search className="w-4.5 h-4.5" /> Search
                </Button>
              </div>
            </div>


            {/* AI Tip */}
            <AnimatePresence>
              {aiTip && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mx-5 sm:mx-6 mb-4 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/15 flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-accent/80 font-medium leading-relaxed">{aiTip}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category bar removed — moved into filter panel */}
          </motion.form>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── DISCOVERY SECTION (Phase 2) — shown before search ── */}
      {/* ═══════════════════════════════════════════════════ */}
      {!hasSearched && !loading && (
        <div className="container mx-auto px-4 py-10 sm:py-14">
          {/* Trending Destinations */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  Trending Destinations
                </h2>
                <p className="text-sm text-muted-foreground/50 mt-1">Popular cities to explore activities</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary/30" />
            </div>

            {trendingDests.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {trendingDests.map((dest, i) => (
                  <motion.div
                    key={dest.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => handleDestinationClick(dest)}
                    className="group cursor-pointer rounded-2xl overflow-hidden bg-card border border-border/10 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.06] hover:-translate-y-1 transition-all duration-500"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={dest.image}
                        alt={dest.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-sm font-bold text-white drop-shadow-lg">{dest.name}</h3>
                        {dest.activityCount && dest.activityCount > 0 && (
                          <p className="text-[10px] text-white/70 font-medium mt-0.5">{dest.activityCount} activities</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden">
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>


          {/* Local tours if any */}
          {localTours.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-14">
              <h2 className="text-2xl font-bold text-foreground mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>Our Curated Tours</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {localTours.slice(0, 6).map((tour) => {
                  const Comp = isHybrid ? HybridTourCard : TourCard;
                  return <Comp key={tour.id} tour={tour} formatDuration={formatDuration} formatDirectPrice={formatDirectPrice} onClick={() => navigateToTour(tour)} />;
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── RESULTS SECTION ── */}
      {/* ═══════════════════════════════════════════════════ */}
      {(hasSearched || loading) && (
        <div className="container mx-auto px-4 py-8 sm:py-10">
          {/* Hybrid editorial header (hybrid skin only) */}
          {isHybrid && filtered.length > 0 && (
            <div className="mb-5">
              <HybridResultsHeader
                eyebrow="Curated experiences"
                headline={`${(totalProducts > filtered.length ? totalProducts : filtered.length).toLocaleString()} experience${(totalProducts > filtered.length ? totalProducts : filtered.length) === 1 ? "" : "s"} ready to book`}
                meta="Hand-picked tours · Local guides · Skip-the-line"
                tabs={[
                  { key: "recommended", label: "Recommended" },
                  { key: "price-low", label: "Price ↑" },
                  { key: "price-high", label: "Price ↓" },
                  { key: "rating", label: "Top Rated" },
                  { key: "duration", label: "Duration" },
                ]}
                active={sortBy as any}
                onChange={(k) => setSortBy(k as SortOption)}
              />
            </div>
          )}
          {/* Premium Toolbar — hidden in hybrid mode (replaced by HybridResultsHeader above) */}
          <div className={cn("flex items-center justify-between gap-4 mb-6 sm:mb-8", isHybrid && "hidden")}>
            <div className="flex items-center gap-3">
              {filtered.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{(totalProducts > filtered.length ? totalProducts : filtered.length).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground/50 font-medium leading-tight">
                    experience{(totalProducts > filtered.length ? totalProducts : filtered.length) !== 1 ? "s" : ""}<br />found
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center">

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[160px] h-10 text-xs rounded-2xl border-border/15 bg-card shadow-sm hover:shadow-md transition-all font-semibold">
                  <ArrowUpDown className="w-3 h-3 mr-1.5 text-muted-foreground/40" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price-low">Price: Low → High</SelectItem>
                  <SelectItem value="price-high">Price: High → Low</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "gap-2 rounded-2xl h-10 font-bold text-xs px-5 transition-all duration-300",
                  showFilters ? "shadow-lg shadow-primary/20" : "border-border/15 bg-card text-muted-foreground hover:text-foreground shadow-sm hover:shadow-md"
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] flex items-center justify-center font-bold animate-in zoom-in-50">{activeFilterCount}</span>
                )}
              </Button>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs text-accent font-bold hover:text-accent/80 rounded-2xl h-10 px-4">
                  <X className="w-3.5 h-3.5" /> Reset
                </Button>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={{ duration: 0.35 }} className="overflow-hidden">
                <div className="bg-card border border-border/10 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl shadow-primary/[0.03] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-60 h-60 rounded-full bg-primary/[0.02] blur-[80px] pointer-events-none" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {/* Budget Tiers */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-sm"><span className="text-sm">💰</span></div>
                        <div>
                          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em]">Budget</h4>
                          <p className="text-[10px] text-muted-foreground/50">Based on available prices</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {budgetTiers.map((tier) => {
                          const isActive = selectedBudget === tier.key;
                          return (
                            <button key={tier.key} onClick={() => setSelectedBudget(isActive ? null : tier.key)}
                              className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                                isActive ? "bg-primary/10 border border-primary/25 shadow-sm shadow-primary/10" : "bg-muted/20 border border-border/10 hover:bg-muted/40")}>
                              <span className="flex items-center gap-2"><span className="text-base">{tier.icon}</span><span className={cn("text-[11px] font-bold", isActive ? "text-primary" : "text-foreground/80")}>{tier.label}</span></span>
                              <span className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground/50">{tier.desc}</span><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", isActive ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground/40")}>{tier.count}</span></span>
                            </button>
                          );
                        })}
                        {budgetTiers.length === 0 && <p className="text-[11px] text-muted-foreground/40 text-center py-4">Search to see budget tiers</p>}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-sm"><Clock className="w-4 h-4 text-primary" /></div>
                        <div>
                          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em]">Duration</h4>
                          <p className="text-[10px] text-muted-foreground/50">How long?</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "1-3h", label: "1–3 Hours", icon: "⚡", desc: "Quick visit" },
                          { key: "half-day", label: "Half Day", icon: "🌤️", desc: "3–7 hours" },
                          { key: "full-day", label: "Full Day", icon: "☀️", desc: "7–24 hours" },
                          { key: "multi-day", label: "Multi-Day", icon: "🗓️", desc: "2+ days" },
                        ].map((d) => {
                          const isActive = selectedDurations.includes(d.key);
                          return (
                            <button key={d.key} onClick={() => setSelectedDurations(prev => isActive ? prev.filter(x => x !== d.key) : [...prev, d.key])}
                              className={cn("flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all duration-200",
                                isActive ? "bg-primary/10 border border-primary/25 shadow-sm shadow-primary/10" : "bg-muted/20 border border-border/10 hover:bg-muted/40")}>
                              <span className="flex items-center gap-1.5">
                                <span className="text-sm">{d.icon}</span>
                                <span className={cn("text-[11px] font-bold", isActive ? "text-primary" : "text-foreground/80")}>{d.label}</span>
                              </span>
                              <span className="text-[9px] text-muted-foreground/40 mt-0.5 ml-6">{d.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Categories */}
                    {smartCategories.length > 1 && (
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-sm"><Compass className="w-4 h-4 text-primary" /></div>
                        <div>
                          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em]">Category</h4>
                          <p className="text-[10px] text-muted-foreground/50">Filter by experience type</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {smartCategories.map((cat) => {
                          const isActive = selectedCategory === cat.key || (!selectedCategory && cat.key === "recommended");
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => setSelectedCategory(isActive && cat.key !== "recommended" ? null : cat.key === "recommended" ? null : cat.key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200",
                                isActive
                                  ? "bg-primary/10 text-primary border border-primary/25 shadow-sm shadow-primary/10"
                                  : "bg-muted/20 text-muted-foreground/60 border border-border/10 hover:bg-muted/40 hover:text-foreground/70"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{cat.label}</span>
                              <span className="text-[9px] opacity-50">({cat.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive loader overlay for experience search */}
          <AnimatePresence>
            {experienceLoading && (isHybrid ? <HybridSearchLoader variant="tours" /> : <TourSearchLoader />)}
          </AnimatePresence>

          {/* Loading skeletons */}
          {loading || experienceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl border border-border/15 overflow-hidden" style={{ boxShadow: "0 2px 24px -6px hsl(222 30% 12% / 0.06)" }}>
                  <div className="h-60 bg-muted animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-muted animate-pulse rounded-lg w-4/5" />
                    <div className="h-3.5 bg-muted animate-pulse rounded-lg w-1/2" />
                    <div className="h-3 bg-muted animate-pulse rounded-lg w-full" />
                    <div className="flex justify-between pt-3 border-t border-border/10 mt-2">
                      <div className="h-8 bg-muted animate-pulse rounded-lg w-28" />
                      <div className="h-10 bg-muted animate-pulse rounded-full w-28" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={cn(isHybrid && filtered.length > 0 ? "flex flex-col lg:flex-row gap-6" : "")}>
                <div className="flex-1 min-w-0">
                  {/* Tour cards grid — progressive reveal */}
                  <div className={cn(
                    "grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 wl-results",
                    isHybrid ? "xl:grid-cols-2" : "lg:grid-cols-3",
                  )} data-wl-surface="results">
                    {filtered.slice(0, visibleCount).map((tour, i) => {
                      const Comp = isHybrid ? HybridTourCard : TourCard;
                      return <Comp key={tour.id} tour={tour} index={i} formatDuration={formatDuration} formatDirectPrice={formatDirectPrice} onClick={() => navigateToTour(tour)} />;
                    })}
                  </div>

                  {visibleCount < filtered.length && (
                    <div ref={sentinelRef} className="mt-6 flex items-center justify-center gap-2.5 text-sm text-muted-foreground/50 py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
                      <span className="font-medium">Loading more experiences...</span>
                    </div>
                  )}
                </div>

                {/* Hybrid insights rail */}
                {isHybrid && filtered.length > 0 && (
                  <aside className="hidden lg:block lg:w-[280px] xl:w-[300px] flex-shrink-0">
                    <div className="sticky top-[120px]">
                      <HybridInsightsRail
                        variant="tours"
                        currencySymbol={CURRENCIES[currency]?.symbol || "$"}
                        cheapestPrice={
                          filtered.reduce(
                            (min, t) => (t.price > 0 && t.price < min ? t.price : min),
                            Number.POSITIVE_INFINITY,
                          ) === Number.POSITIVE_INFINITY
                            ? 0
                            : filtered.reduce(
                                (min, t) => (t.price > 0 && t.price < min ? t.price : min),
                                Number.POSITIVE_INFINITY,
                              )
                        }
                        destination={searchQuery || currentQuery}
                      />
                    </div>
                  </aside>
                )}
              </div>

              {filtered.length > 0 && (
                <div className="mt-8 sm:mt-10 text-center">
                  <p className="text-xs text-muted-foreground/40 font-medium">
                    Showing {Math.min(visibleCount, filtered.length)} of {totalProducts > filtered.length ? `${totalProducts.toLocaleString()}+` : filtered.length.toLocaleString()} experiences
                  </p>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!loading && !experienceLoading && filtered.length === 0 && hasSearched && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>No experiences found</h3>
              <p className="text-sm text-muted-foreground/50 max-w-sm mx-auto">Try searching for a destination, landmark, or activity type to discover amazing experiences.</p>
              <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setViatorTours([]); setCurrentQuery(""); setSearchQuery(""); }}>
                Back to Discovery
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

// ── Tour Card Component ──
function TourCard({ tour, index = 0, formatDuration, formatDirectPrice, onClick }: {
  tour: Tour; index?: number; formatDuration: (d: string) => string; formatDirectPrice: (p: number) => string; onClick: () => void;
}) {
  const matchMeta = tour._matchMeta;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index < 12 ? index * 0.04 : 0, duration: 0.4 }}
      className="group bg-card rounded-2xl overflow-hidden border border-border/10 hover:border-border/25 hover:shadow-2xl hover:shadow-primary/[0.06] hover:-translate-y-1 transition-all duration-500 cursor-pointer"
      style={{ boxShadow: "0 2px 24px -6px hsl(222 30% 12% / 0.05)" }}
      onClick={onClick}
    >
      <div className="relative h-56 sm:h-60 overflow-hidden">
        <ImageCarousel
          images={tour.images?.length ? tour.images.slice(0, 6) : (tour.image ? [tour.image] : [getImage("")])}
          alt={tour.name}
          className="h-56 sm:h-60"
          fallback={getImage("")}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-[2]" />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {tour._pickType && (() => {
            const pickConfig: Record<string, { label: string; icon: typeof TrendingUp; bg: string }> = {
              best_match: { label: "Best Match", icon: Sparkles, bg: "bg-primary/90" },
              cheapest: { label: "Cheapest", icon: Ticket, bg: "bg-emerald-500/90" },
              top_rated: { label: "Top Rated", icon: TrendingUp, bg: "bg-accent/90" },
              best_value: { label: "Best Value", icon: Heart, bg: "bg-violet-500/90" },
              best_option_match: { label: "Option Match", icon: Check, bg: "bg-sky-500/90" },
            };
            const cfg = pickConfig[tour._pickType];
            if (!cfg) return null;
            const PickIcon = cfg.icon;
            return (
              <span className={`${cfg.bg} backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1`}>
                <PickIcon className="w-3 h-3" /> {cfg.label}
              </span>
            );
          })()}
          {!tour._pickType && tour.rating >= 4.7 && (tour.reviewCount || 0) >= 50 && (
            <span className="bg-accent/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Top Rated
            </span>
          )}
        </div>
        {tour.duration && (
          <div className="absolute bottom-3 left-3 z-10">
            <span className="bg-black/60 backdrop-blur-xl text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
              <Clock className="w-3 h-3 opacity-80" /> {formatDuration(tour.duration)}
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col">
        {/* Place badges: matched terms first (blue), then other places covered (gray) */}
        {(matchMeta?.matchedTerms?.length || tour.placesCovered?.length) ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {matchMeta?.matchedTerms?.map(t => (
              <span key={`m-${t}`} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                ✓ {t}
              </span>
            ))}
            {/* Show other places covered that aren't already in matched terms */}
            {tour.placesCovered?.filter(p => 
              !matchMeta?.matchedTerms?.some(m => p.toLowerCase().includes(m) || m.includes(p.toLowerCase()))
            ).slice(0, 4).map(p => (
              <span key={`p-${p}`} className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                {p}
              </span>
            ))}
            {matchMeta && matchMeta.matchCount === matchMeta.totalTerms && matchMeta.totalTerms > 1 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                Full Match
              </span>
            )}
          </div>
        ) : null}
        {tour.destination && (
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3 h-3 text-primary/60" />
            <span className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">{tour.destination}</span>
          </div>
        )}
        <h3 className="text-[15px] sm:text-base font-bold text-foreground leading-snug line-clamp-2 mb-1.5 group-hover:text-primary transition-colors duration-300">{tour.name}</h3>
        {tour.rating > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-foreground">{tour.rating.toFixed(1)}</span>
            </div>
            {(tour.reviewCount || 0) > 0 && (
              <span className="text-[10px] text-muted-foreground/60">({tour.reviewCount?.toLocaleString()} reviews)</span>
            )}
          </div>
        )}
        {tour.shortDescription && <p className="text-xs text-muted-foreground/50 line-clamp-2 mb-3 leading-relaxed">{tour.shortDescription}</p>}
        {(() => {
          const BLOCKED = /viator|tripadvisor|getyourguide|klook|tiqets|musement|civitatis|headout/i;
          // Generic inclusions that aren't meaningful as featured badges
          const GENERIC_INCLUSIONS = /^(bottled water|water|wifi|wi-fi|air.?condition|taxes|vat|gst|insurance|snack|lunch box|hotel pickup|hotel drop|pickup|drop.?off|gratuities|tips|parking|fuel|tolls|entry fee|entrance fee|admission|guide|local guide|driver|transport|vehicle|car|van|bus|boat|ferry|transfer|all taxes|service charge|convenience fee|booking fee|food|drinks?|beverage|refreshment|commentary|narration|headset|audio guide|map|brochure|itinerary|confirmation|voucher|receipt)$/i;
          // Filter highlights: only show actual tour features, not generic service items
          const cleanHighlights = tour.highlights
            .filter(h => h && h.length > 3 && h.length < 80 && !BLOCKED.test(h) && !GENERIC_INCLUSIONS.test(h.trim()))
            .slice(0, 3);
          // For placesCovered: only show places that are also mentioned in title or highlights (verified as actual tour content)
          const titleLower = (tour.name || "").toLowerCase();
          const highlightsLower = tour.highlights.map(h => (h || "").toLowerCase()).join(" ");
          const categoryLower = (tour.category || "").toLowerCase();
          const descLower = (tour.shortDescription || "").toLowerCase();
          const places = (tour.placesCovered || [])
            .filter((p: string) => {
              if (BLOCKED.test(p)) return false;
              if (cleanHighlights.some(h => h.toLowerCase().includes(p.toLowerCase()))) return false; // avoid duplicate
              const pLow = p.toLowerCase();
              // Verify: place must appear in title, highlights, or category — not ONLY in description
              const inTitle = titleLower.includes(pLow);
              const inHighlights = highlightsLower.includes(pLow);
              const inCategory = categoryLower.includes(pLow);
              // If place is only in description but nowhere else, skip it as an unverified suggestion
              if (!inTitle && !inHighlights && !inCategory) {
                // Last check: if _matchMeta confirms this place was matched in reliable fields, allow it
                const matchDetail = tour._matchMeta?.matchDetails?.find(d => pLow.includes(d.term) || d.term.includes(pLow));
                if (matchDetail) {
                  const reliableFields = ["title", "highlights", "places_covered", "inclusions"];
                  const hasReliableMatch = matchDetail.fields.some(f => reliableFields.includes(f));
                  if (!hasReliableMatch) return false;
                }
                return true; // places_covered from itinerary POIs are generally reliable
              }
              return true;
            })
            .slice(0, Math.max(0, 4 - cleanHighlights.length));
          const hasContent = cleanHighlights.length > 0 || places.length > 0;
          return hasContent ? (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cleanHighlights.map((h) => (
                <span key={h} className="flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/30 rounded-lg px-2 py-1 font-medium">
                  <Check className="w-2.5 h-2.5 text-primary/60" /> {h}
                </span>
              ))}
              {places.map((p: string) => (
                <span key={p} className="flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-muted/20 rounded-lg px-2 py-1 font-medium">
                  <MapPin className="w-2.5 h-2.5 text-muted-foreground/40" /> {p}
                </span>
              ))}
            </div>
          ) : null;
        })()}
        <div className="flex items-end justify-between pt-4 mt-auto border-t border-border/10">
          <div>
            {tour._matchedOption ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent mb-1">
                <Ticket className="w-2.5 h-2.5" /> {tour._matchedOption.optionName.length > 30 ? tour._matchedOption.optionName.slice(0, 30) + "…" : tour._matchedOption.optionName}
              </span>
            ) : (
              <p className="text-[9px] text-muted-foreground/40 mb-0.5 font-bold uppercase tracking-[0.15em]">From</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{formatDirectPrice(tour.price)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground/40 font-medium">
              {tour._matchedOption ? "matched option" : `per ${tour.pricingType === "PER_GROUP" ? "group" : "person"}`}
            </span>
          </div>
          <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9 shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 text-xs"
            onClick={(e) => { e.stopPropagation(); onClick(); }}>
            View Details
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default Tours;
