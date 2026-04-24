import { motion } from "framer-motion";
import { MapPin, Clock, Star, Check, Sparkles, TrendingUp, Heart, Ticket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageCarousel from "@/components/ui/image-carousel";

interface HybridTourCardProps {
  tour: any;
  index?: number;
  formatDuration: (d: string) => string;
  formatDirectPrice: (p: number) => string;
  onClick: () => void;
}

/**
 * Bespoke Hybrid editorial tour card.
 * Drop-in replacement for the inline Tours.tsx TourCard — same props/contract.
 */
const HybridTourCard = ({ tour, index = 0, formatDuration, formatDirectPrice, onClick }: HybridTourCardProps) => {
  const matchMeta = tour._matchMeta;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index < 12 ? index * 0.04 : 0, duration: 0.4 }}
      className="group bg-card/85 backdrop-blur-xl rounded-3xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-500 cursor-pointer hover:-translate-y-1 shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)] hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.32)]"
      onClick={onClick}
    >
      <div className="relative h-60 sm:h-64 overflow-hidden">
        <ImageCarousel
          images={tour.images?.length ? tour.images.slice(0, 6) : (tour.image ? [tour.image] : [])}
          alt={tour.name}
          className="h-60 sm:h-64"
        />
        {/* Editorial gradient veil */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/20 to-transparent pointer-events-none z-[2]" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-[2]" />

        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {tour._pickType && (() => {
            const pickConfig: Record<string, { label: string; icon: typeof TrendingUp }> = {
              best_match: { label: "Editor's Pick", icon: Sparkles },
              cheapest: { label: "Best Price", icon: Ticket },
              top_rated: { label: "Top Rated", icon: TrendingUp },
              best_value: { label: "Best Value", icon: Heart },
              best_option_match: { label: "Option Match", icon: Check },
            };
            const cfg = pickConfig[tour._pickType];
            if (!cfg) return null;
            const PickIcon = cfg.icon;
            return (
              <span
                className="text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-[0.1em] backdrop-blur-md"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)" }}
              >
                <PickIcon className="w-3 h-3" /> {cfg.label}
              </span>
            );
          })()}
          {!tour._pickType && tour.rating >= 4.7 && (tour.reviewCount || 0) >= 50 && (
            <span className="bg-accent/90 backdrop-blur-md text-accent-foreground text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-[0.1em]">
              <TrendingUp className="w-3 h-3" /> Top Rated
            </span>
          )}
        </div>

        {tour.duration && (
          <div className="absolute bottom-4 left-4 z-10">
            <span className="bg-black/55 backdrop-blur-xl text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/15">
              <Clock className="w-3 h-3 opacity-80" /> {formatDuration(tour.duration)}
            </span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col">
        {/* Place / match badges */}
        {(matchMeta?.matchedTerms?.length || tour.placesCovered?.length) ? (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {matchMeta?.matchedTerms?.map((t: string) => (
              <span key={`m-${t}`} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize border border-primary/20">
                ✓ {t}
              </span>
            ))}
            {tour.placesCovered?.filter((p: string) =>
              !matchMeta?.matchedTerms?.some((m: string) => p.toLowerCase().includes(m) || m.includes(p.toLowerCase()))
            ).slice(0, 4).map((p: string) => (
              <span key={`p-${p}`} className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground capitalize">
                {p}
              </span>
            ))}
            {matchMeta && matchMeta.matchCount === matchMeta.totalTerms && matchMeta.totalTerms > 1 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-wider">
                Full Match
              </span>
            )}
          </div>
        ) : null}

        {tour.destination && (
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3 h-3 text-accent" />
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{tour.destination}</span>
          </div>
        )}

        <h3
          className="text-[18px] sm:text-[19px] text-foreground leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors duration-300"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          {tour.name}
        </h3>

        {tour.rating > 0 && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 fill-accent text-accent" />
              <span className="text-xs font-bold text-foreground tabular-nums">{tour.rating.toFixed(1)}</span>
            </div>
            {(tour.reviewCount || 0) > 0 && (
              <span className="text-[10px] text-muted-foreground italic">({tour.reviewCount?.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        {tour.shortDescription && (
          <p className="text-[12px] text-muted-foreground/80 line-clamp-2 mb-4 leading-relaxed">{tour.shortDescription}</p>
        )}

        {(() => {
          const BLOCKED = /viator|tripadvisor|getyourguide|klook|tiqets|musement|civitatis|headout/i;
          const GENERIC_INCLUSIONS = /^(bottled water|water|wifi|wi-fi|air.?condition|taxes|vat|gst|insurance|snack|lunch box|hotel pickup|hotel drop|pickup|drop.?off|gratuities|tips|parking|fuel|tolls|entry fee|entrance fee|admission|guide|local guide|driver|transport|vehicle|car|van|bus|boat|ferry|transfer|all taxes|service charge|convenience fee|booking fee|food|drinks?|beverage|refreshment|commentary|narration|headset|audio guide|map|brochure|itinerary|confirmation|voucher|receipt)$/i;
          const cleanHighlights = (tour.highlights || [])
            .filter((h: string) => h && h.length > 3 && h.length < 80 && !BLOCKED.test(h) && !GENERIC_INCLUSIONS.test(h.trim()))
            .slice(0, 3);
          const titleLower = (tour.name || "").toLowerCase();
          const highlightsLower = (tour.highlights || []).map((h: string) => (h || "").toLowerCase()).join(" ");
          const categoryLower = (tour.category || "").toLowerCase();
          const places = (tour.placesCovered || [])
            .filter((p: string) => {
              if (BLOCKED.test(p)) return false;
              if (cleanHighlights.some((h: string) => h.toLowerCase().includes(p.toLowerCase()))) return false;
              const pLow = p.toLowerCase();
              const inTitle = titleLower.includes(pLow);
              const inHighlights = highlightsLower.includes(pLow);
              const inCategory = categoryLower.includes(pLow);
              if (!inTitle && !inHighlights && !inCategory) {
                const matchDetail = tour._matchMeta?.matchDetails?.find(
                  (d: any) => pLow.includes(d.term) || d.term.includes(pLow)
                );
                if (matchDetail) {
                  const reliableFields = ["title", "highlights", "places_covered", "inclusions"];
                  const hasReliableMatch = matchDetail.fields.some((f: string) => reliableFields.includes(f));
                  if (!hasReliableMatch) return false;
                }
                return true;
              }
              return true;
            })
            .slice(0, Math.max(0, 4 - cleanHighlights.length));
          const hasContent = cleanHighlights.length > 0 || places.length > 0;
          return hasContent ? (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cleanHighlights.map((h: string) => (
                <span key={h} className="flex items-center gap-1 text-[10.5px] text-muted-foreground bg-muted/30 rounded-full px-2.5 py-1 font-medium border border-border/20">
                  <Check className="w-2.5 h-2.5 text-primary" /> {h}
                </span>
              ))}
              {places.map((p: string) => (
                <span key={p} className="flex items-center gap-1 text-[10.5px] text-muted-foreground/80 bg-muted/20 rounded-full px-2.5 py-1 font-medium">
                  <MapPin className="w-2.5 h-2.5 text-muted-foreground/50" /> {p}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        <div className="flex items-end justify-between pt-4 mt-auto border-t border-border/30">
          <div>
            {tour._matchedOption ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent mb-1 uppercase tracking-wider">
                <Ticket className="w-2.5 h-2.5" /> {tour._matchedOption.optionName.length > 30 ? tour._matchedOption.optionName.slice(0, 30) + "…" : tour._matchedOption.optionName}
              </span>
            ) : (
              <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase tracking-[0.14em]">From</p>
            )}
            <div className="flex items-baseline gap-1">
              <span
                className="text-[24px] sm:text-[26px] text-foreground tracking-tight leading-none"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {formatDirectPrice(tour.price)}
              </span>
            </div>
            <span className="text-[10.5px] text-muted-foreground italic">
              {tour._matchedOption ? "matched option" : `per ${tour.pricingType === "PER_GROUP" ? "group" : "person"}`}
            </span>
          </div>
          <Button
            size="sm"
            className="rounded-full bg-gradient-to-r from-primary to-primary/85 hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-bold px-5 h-10 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 transition-all duration-300 text-[11.5px] uppercase tracking-wider gap-1.5"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            View <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default HybridTourCard;