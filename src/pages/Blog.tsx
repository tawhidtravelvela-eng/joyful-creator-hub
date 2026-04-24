import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ArrowRight, BookOpen, Sparkles,
  TrendingUp, ChevronRight, Globe, Shield, Award
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useTenant } from "@/hooks/useTenant";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { detectCountry } from "@/utils/geolocation";

import type { BlogPost, BlogCategory, CachedPrice } from "@/components/blog/blogTypes";
import BlogSkeleton from "@/components/blog/BlogSkeleton";
import CategoryBar from "@/components/blog/CategoryBar";
import FeaturedCard from "@/components/blog/FeaturedCard";
import ArticleCard from "@/components/blog/ArticleCard";
import AiConversionBlock from "@/components/blog/AiConversionBlock";
import MidPageCta from "@/components/blog/MidPageCta";
import StickyActionBar from "@/components/blog/StickyActionBar";
import BlogNewsletterCta from "@/components/blog/BlogNewsletterCta";
import BlogJsonLd from "@/components/blog/BlogJsonLd";
import LanguageFilter from "@/components/blog/LanguageFilter";
import ShareFloater from "@/components/blog/ShareFloater";

const ARTICLES_PER_PAGE = 6;

/** Map country codes to keywords for geo-relevance scoring */
const GEO_KEYWORDS: Record<string, string[]> = {
  BD: ["bangladesh", "dhaka", "chittagong", "cox's bazar", "sylhet", "sundarbans", "south asia", "bengali"],
  IN: ["india", "delhi", "mumbai", "kolkata", "goa", "kerala", "rajasthan", "south asia", "hindi"],
  PK: ["pakistan", "lahore", "karachi", "islamabad", "south asia"],
  LK: ["sri lanka", "colombo", "kandy", "south asia"],
  NP: ["nepal", "kathmandu", "pokhara", "south asia"],
  AE: ["dubai", "abu dhabi", "uae", "middle east"],
  SA: ["saudi", "riyadh", "jeddah", "middle east"],
  MY: ["malaysia", "kuala lumpur", "southeast asia", "langkawi"],
  SG: ["singapore", "southeast asia"],
  TH: ["thailand", "bangkok", "phuket", "southeast asia"],
  VN: ["vietnam", "hanoi", "southeast asia"],
  ID: ["indonesia", "bali", "jakarta", "southeast asia"],
  JP: ["japan", "tokyo", "osaka", "east asia"],
  KR: ["korea", "seoul", "east asia"],
  CN: ["china", "beijing", "shanghai", "east asia"],
  US: ["usa", "america", "new york", "california", "north america"],
  CA: ["canada", "toronto", "vancouver", "north america"],
  GB: ["uk", "london", "england", "europe"],
  DE: ["germany", "berlin", "europe"],
  FR: ["france", "paris", "europe"],
  IT: ["italy", "rome", "europe"],
  ES: ["spain", "barcelona", "madrid", "europe"],
  TR: ["turkey", "istanbul", "europe", "middle east"],
  AU: ["australia", "sydney", "melbourne", "oceania"],
  NZ: ["new zealand", "oceania"],
  EG: ["egypt", "cairo", "africa"],
  KE: ["kenya", "safari", "africa"],
  ZA: ["south africa", "cape town", "africa"],
  GH: ["ghana", "accra", "africa"],
  NG: ["nigeria", "lagos", "africa"],
  MX: ["mexico", "cancun", "americas", "latin america"],
  BR: ["brazil", "rio", "americas", "latin america"],
  MV: ["maldives", "south asia"],
};

/** Safely coerce tags (Json column) into a string[] */
function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") {
    try { const p = JSON.parse(tags); return Array.isArray(p) ? p.map(String) : []; }
    catch { return []; }
  }
  return [];
}

function geoScorePost(post: BlogPost, keywords: string[]): number {
  if (!keywords.length) return 0;
  const haystack = (
    post.title + " " +
    (post.excerpt || "") + " " +
    parseTags(post.tags).join(" ")
  ).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 1;
  }
  return score;
}

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [geoKeywords, setGeoKeywords] = useState<string[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [cachedPrices, setCachedPrices] = useState<Record<string, CachedPrice>>({});
  const [loading, setLoading] = useState(true);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ARTICLES_PER_PAGE);
  const { tenant } = useTenant();
  const { branding } = useSiteBranding();
  const stickyRef = useRef<HTMLDivElement>(null);
  const articlesRef = useRef<HTMLDivElement>(null);

  /* ── URL-based filter state ── */
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const selectedCategory = searchParams.get("cat") || null;
  const selectedLanguage = searchParams.get("lang") || null;

  const setSearch = useCallback((q: string) => {
    setSearchParams(prev => {
      if (q) prev.set("q", q); else prev.delete("q");
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setSelectedCategory = useCallback((cat: string | null) => {
    setSearchParams(prev => {
      if (cat) prev.set("cat", cat); else prev.delete("cat");
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setSelectedLanguage = useCallback((lang: string | null) => {
    setSearchParams(prev => {
      if (lang) prev.set("lang", lang); else prev.delete("lang");
      return prev;
    }, { replace: true });
  }, [setSearchParams]);
  /* ── Detect visitor country for geo-prioritization ── */
  useEffect(() => {
    detectCountry().then(info => {
      if (info) {
        const kws = GEO_KEYWORDS[info.code] || [];
        setGeoKeywords(kws);
        console.log("[Blog] Geo keywords for", info.name, ":", kws);
      }
    });
  }, []);

  const siteName = branding.site_name || "Travel Vela";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  /* ── Sticky bar visibility ── */
  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── OG meta + page title ── */
  useEffect(() => {
    document.title = `Travel Blog — ${siteName} | Stories, Guides & Travel Inspiration`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ||
               document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(property.startsWith("og:") || property.startsWith("twitter:") ? "property" : "name", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const desc = `Read the latest travel stories, destination guides, and insider tips on the ${siteName} blog. Plan smarter trips with expert advice.`;
    setMeta("description", desc);
    setMeta("og:type", "website");
    setMeta("og:title", `Travel Blog — ${siteName}`);
    setMeta("og:description", desc);
    setMeta("og:url", `${siteUrl}/blog`);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", `Travel Blog — ${siteName}`);
    setMeta("twitter:description", desc);

    if (posts[0]?.featured_image) {
      setMeta("og:image", posts[0].featured_image);
      setMeta("twitter:image", posts[0].featured_image);
    }

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${siteUrl}/blog`;

    return () => { document.title = `${siteName} - Book Flights at Best Prices`; };
  }, [siteName, siteUrl, posts]);

  /* ── Fetch posts — NO content field ── */
  useEffect(() => {
    const load = async () => {
      let postsQuery = supabase
        .from("blog_posts")
        .select("id,title,slug,excerpt,featured_image,tags,author_name,published_at,created_at,category_id,word_count,language")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (tenant) {
        // Strict isolation: tenants only see their own posts
        postsQuery = postsQuery.eq("tenant_id", tenant.id);
      } else {
        postsQuery = postsQuery.is("tenant_id", null);
      }

      const [postsRes, catsRes] = await Promise.all([
        postsQuery,
        supabase.from("blog_categories").select("*").order("name"),
      ]);
      if (postsRes.data) setPosts(postsRes.data as any);
      if (catsRes.data) setCategories(catsRes.data as any);
      setLoading(false);
    };
    load();
  }, [tenant]);

  /* ── Fetch cached prices ── */
  useEffect(() => {
    const loadPrices = async () => {
      const { data } = await supabase
        .from("popular_routes")
        .select("to_code, lowest_price, currency")
        .gt("lowest_price", 0);
      if (data) {
        const priceMap: Record<string, CachedPrice> = {};
        for (const row of data) {
          const existing = priceMap[row.to_code];
          if (!existing || row.lowest_price < existing.price) {
            priceMap[row.to_code] = { price: row.lowest_price, currency: row.currency || "BDT" };
          }
        }
        setCachedPrices(priceMap);
      }
    };
    loadPrices();
  }, []);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ARTICLES_PER_PAGE);
  }, [search, selectedCategory, selectedLanguage]);

  const filtered = useMemo(() => {
    const base = posts.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        p.title.toLowerCase().includes(q) ||
        (p.excerpt || "").toLowerCase().includes(q) ||
        parseTags(p.tags).some(t => t.toLowerCase().includes(q));
      const matchesCat = !selectedCategory || p.category_id === selectedCategory;
      const matchesLang = !selectedLanguage || p.language === selectedLanguage;
      return matchesSearch && matchesCat && matchesLang;
    });
    // Geo-sort: boost posts matching visitor's region to the top
    if (geoKeywords.length > 0 && !search) {
      const scored = base.map(p => ({ post: p, geo: geoScorePost(p, geoKeywords) }));
      scored.sort((a, b) => b.geo - a.geo || 0); // stable: same-score keeps original order
      return scored.map(s => s.post);
    }
    return base;
  }, [posts, search, selectedCategory, selectedLanguage, geoKeywords]);

  const getCategoryName = (id: string | null) =>
    categories.find(c => c.id === id)?.name || "Travel";

  // When no language filter is active, ensure the featured post is English
  // so local-language posts don't dominate the hero spot for all visitors
  const featured = useMemo(() => {
    if (selectedLanguage || filtered.length === 0) return filtered[0] || null;
    const englishPost = filtered.find(p => !p.language || p.language === "en");
    return englishPost || filtered[0];
  }, [filtered, selectedLanguage]);

  const rest = useMemo(() => {
    if (!featured) return filtered;
    return filtered.filter(p => p.id !== featured.id);
  }, [filtered, featured]);
  const visibleRest = rest.slice(0, visibleCount);
  const hasMore = rest.length > visibleCount;

  const fmtDate = (post: BlogPost) =>
    format(new Date(post.published_at || post.created_at), "MMM d, yyyy");

  const getBadge = (index: number): "popular" | "editors_pick" | null => {
    if (index === 0 || index === 3) return "popular";
    if (index === 1 || index === 5) return "editors_pick";
    return null;
  };

  const scrollToArticles = () => {
    articlesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout>
      {!loading && posts.length > 0 && (
        <BlogJsonLd posts={posts} siteName={siteName} siteUrl={siteUrl} />
      )}

      <main className="min-h-screen bg-background">
        {/* ══════ HERO ══════ */}
        <header className="relative overflow-hidden bg-[hsl(var(--blog-hero-bg,222_50%_8%))]" role="banner">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222_55%_14%)] via-[hsl(222_50%_8%)] to-[hsl(222_45%_5%)]" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-accent/[0.06] blur-[120px]" />
            <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full bg-primary/[0.08] blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.03]" />
          </div>

          <div className="container mx-auto px-4 py-14 sm:py-28 lg:py-36 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-3xl mx-auto"
            >
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-accent text-[11px] font-bold tracking-[0.2em] uppercase mb-7">
                <BookOpen className="w-3.5 h-3.5" />
                Travel Journal
              </span>
              <h1
                className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.06]"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Stories, Guides &<br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-accent to-[hsl(30,100%,65%)] bg-clip-text text-transparent">
                  Travel Inspiration
                </span>
              </h1>
              <p className="text-white/65 text-sm sm:text-base lg:text-lg max-w-xl mx-auto leading-relaxed font-medium mb-10">
                Expert tips, destination deep-dives, and insider knowledge — read, plan, and book in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Button asChild className="h-12 px-7 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-lg shadow-accent/30">
                  <Link to="/trip-planner">
                    Plan My Trip with AI <Sparkles className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={scrollToArticles}
                  className="h-12 px-7 rounded-xl border-white/15 text-white hover:bg-white/10 hover:text-white font-bold text-sm bg-transparent"
                >
                  Explore Articles <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {[
                   { icon: Shield, label: "Trusted by 50K+ Travelers" },
                   { icon: Award, label: "Best Price Guarantee" },
                   { icon: Globe, label: "100+ Destinations" },
                ].map(b => (
                  <span key={b.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/60 font-semibold backdrop-blur-sm">
                    <b.icon className="w-3 h-3 text-accent/70" /> {b.label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </header>

        {/* ══════ CONTENT ══════ */}
        <div ref={articlesRef} className="container mx-auto px-4 pt-4 pb-12 sm:pb-20">
          <CategoryBar
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            stickyRef={stickyRef}
            posts={posts}
          />

          {/* Search + Language Filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 mb-10 sm:mb-14 space-y-4"
          >
            <div className="relative max-w-2xl mx-auto">
              <label htmlFor="blog-search" className="sr-only">Search articles</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                id="blog-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search destinations, guides, tips..."
                className="pl-11 pr-24 h-12 rounded-2xl border-border/40 bg-card shadow-sm focus:shadow-md focus:border-accent/30 transition-all text-sm font-medium"
              />
              {!loading && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground/40">
                  {filtered.length} article{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex justify-center">
              <LanguageFilter posts={posts} selected={selectedLanguage} onSelect={setSelectedLanguage} />
            </div>
          </motion.div>

          {loading ? (
            <BlogSkeleton />
          ) : filtered.length === 0 ? (
            <section className="text-center py-20 sm:py-28">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <div className="w-20 h-20 rounded-3xl bg-accent/5 border border-accent/10 flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-9 h-9 text-accent/30" />
                </div>
                <p className="text-foreground font-bold text-2xl mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>No articles found</p>
                <p className="text-muted-foreground/60 text-sm mb-6 max-w-sm mx-auto">Try a different search term or explore one of our popular categories below</p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-8">
                    {categories.slice(0, 6).map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSearch(""); setSelectedCategory(c.id); }}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-card border border-border/40 text-muted-foreground hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all duration-300"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => { setSearch(""); setSelectedCategory(null); setSelectedLanguage(null); }}
                    className="rounded-xl px-6 h-11 font-bold text-sm"
                  >
                    Clear All Filters
                  </Button>
                  <Button asChild className="rounded-xl px-6 h-11 bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-lg shadow-accent/20">
                    <Link to="/trip-planner">
                      <Sparkles className="w-4 h-4 mr-1" /> Plan a Trip with AI
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </section>
          ) : (
            <div className="space-y-16 sm:space-y-20">
              {featured && (
                <FeaturedCard
                  post={featured}
                  categoryName={getCategoryName(featured.category_id)}
                  formatDate={fmtDate}
                  cachedPrices={cachedPrices}
                />
              )}

              {visibleRest.length > 0 && (
                <section aria-label="Latest articles">
                  <div className="flex items-center gap-3 mb-8">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'DM Serif Display', serif" }}>
                      Latest Articles
                    </h2>
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-xs text-muted-foreground/50 font-semibold">{rest.length} articles</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                    {visibleRest.map((post, i) => (
                      <React.Fragment key={post.id}>
                        <div className={i > 0 && i % 4 === 0 ? "md:col-span-2" : ""}>
                          <ArticleCard
                            post={post}
                            index={i}
                            categoryName={getCategoryName(post.category_id)}
                            formatDate={fmtDate}
                            showBadge={getBadge(i)}
                            cachedPrices={cachedPrices}
                          />
                        </div>
                        {i === 5 && (
                          <div className="md:col-span-2 lg:col-span-3">
                            <AiConversionBlock />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="text-center mt-12 space-y-4">
                      {/* Progress indicator */}
                      <div className="max-w-xs mx-auto">
                        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/60 transition-all duration-500"
                            style={{ width: `${Math.min(100, (visibleCount / rest.length) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground/50 font-semibold mt-2">
                          {visibleCount} of {rest.length} articles
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setVisibleCount(prev => prev + ARTICLES_PER_PAGE)}
                        className="rounded-xl px-8 h-12 border-border/40 hover:bg-accent hover:text-white hover:border-accent font-bold text-sm transition-all duration-300 shadow-sm"
                      >
                        Load More Articles <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* Newsletter CTA */}
              <BlogNewsletterCta />

              {visibleCount >= 6 && <MidPageCta />}
            </div>
          )}
        </div>
      </main>

      <ShareFloater />
      <StickyActionBar visible={showStickyBar} />
    </Layout>
  );
};

export default Blog;
