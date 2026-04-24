import { Star, MapPin, ArrowRight, Loader2, Sparkles, Users, ShieldCheck, Coffee, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ImageCarousel from "@/components/ui/image-carousel";
import { cn } from "@/lib/utils";

interface Hotel {
  id: string;
  name: string;
  city: string;
  rating: number;
  reviews: number;
  price: number;
  image: string | null;
  amenities: string[];
  stars: number;
  source?: string;
  images?: string[];
  country?: string;
  propertyType?: string;
  availableRooms?: any[];
  mealBasis?: string;
  isPreview?: boolean;
  hasFreeCancellation?: boolean;
  popularityScore?: number;
  isSoldOut?: boolean;
}

interface HybridHotelCardProps {
  hotel: Hotel;
  index: number;
  fetchingPrices: boolean;
  formatDirectPrice: (price: number) => string;
  onViewRooms: () => void;
  onHover?: (id: string | null) => void;
}

const getRatingLabel = (rating: number): string => {
  if (rating >= 9) return "Exceptional";
  if (rating >= 8) return "Excellent";
  if (rating >= 7) return "Very Good";
  if (rating >= 6) return "Good";
  return "Pleasant";
};

const getAiMatchScore = (hotel: Hotel): number => {
  if (hotel.popularityScore && hotel.popularityScore > 0) {
    return Math.min(98, Math.max(60, Math.round(60 + (hotel.popularityScore / 190) * 38)));
  }
  let score = 70;
  if (hotel.rating >= 8) score += 10;
  if (hotel.rating >= 9) score += 5;
  if (hotel.stars >= 4) score += 5;
  if (hotel.mealBasis && hotel.mealBasis !== "Room Only") score += 5;
  if (hotel.amenities.length >= 4) score += 5;
  if (hotel.hasFreeCancellation || hotel.availableRooms?.some((r: any) => r.isRefundable)) score += 3;
  return Math.min(score, 98);
};

/**
 * Bespoke Hybrid editorial hotel card.
 * Drop-in replacement for the platform HotelCard — same props/contract.
 * Uses serif headings, glass shell, ambient gradient hover, primary CTAs.
 */
const HybridHotelCard = ({ hotel, index, fetchingPrices, formatDirectPrice, onViewRooms, onHover }: HybridHotelCardProps) => {
  const aiScore = getAiMatchScore(hotel);
  const isTopPick = index < 3 && hotel.rating >= 8;
  const isBestValue = hotel.price > 0 && hotel.rating >= 7 && hotel.stars >= 3;
  const hasFreeCancellation = hotel.hasFreeCancellation || hotel.availableRooms?.some((r: any) => r.isRefundable);
  const hasMeal = hotel.mealBasis && hotel.mealBasis !== "Room Only";
  const firstRoom = hotel.availableRooms?.[0];
  const isSoldOut = hotel.isSoldOut;

  return (
    <div
      className={cn(
        "bg-card/85 backdrop-blur-xl rounded-3xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-500 flex flex-col xl:flex-row group/card",
        "shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)] hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.28)]",
        "hover:-translate-y-0.5",
        isSoldOut && "opacity-60 grayscale-[30%]"
      )}
      onMouseEnter={() => onHover?.(hotel.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Image */}
      <div className="h-56 sm:h-64 xl:h-auto xl:w-[320px] 2xl:w-[360px] flex-shrink-0 relative overflow-hidden">
        <ImageCarousel
          images={hotel.images?.length ? hotel.images.slice(0, 8) : (hotel.image ? [hotel.image] : [])}
          alt={hotel.name}
          className="w-full h-full"
          eager={index < 3}
        />

        {/* Soft top vignette */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent z-[2]" />

        {/* Top badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
          {isTopPick && (
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase shadow-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Editor's Pick
            </div>
          )}
          {isBestValue && !isTopPick && (
            <div className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase shadow-lg">
              Best Value
            </div>
          )}
          {hotel.stars > 0 && (
            <div className="bg-card/90 backdrop-blur-md text-foreground px-3 py-1 rounded-full flex items-center gap-1 shadow-lg border border-white/20">
              <Star className="w-3 h-3 fill-accent text-accent" />
              <span className="text-[10px] font-bold">{hotel.stars}-star</span>
            </div>
          )}
        </div>

        {/* Right badges stack */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
          {hasFreeCancellation && (
            <div className="bg-success/50/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-lg flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Free Cancel
            </div>
          )}
          {hasMeal && (
            <div className="bg-card/90 backdrop-blur-md text-foreground px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1 border border-white/20">
              <Coffee className="w-3 h-3 text-accent" /> {hotel.mealBasis}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-6 sm:p-7 flex flex-col justify-between">
        <div>
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3
                className="text-xl text-foreground leading-tight line-clamp-2 tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {hotel.name}
              </h3>
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-1.5 font-semibold uppercase tracking-[0.1em]">
                <MapPin className="w-3 h-3 flex-shrink-0 text-accent" />
                <span className="truncate">{hotel.city}{hotel.country && `, ${hotel.country}`}</span>
              </p>
            </div>

            {/* Rating block */}
            {hotel.rating > 0 && (
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{getRatingLabel(hotel.rating)}</p>
                    {hotel.reviews > 0 && (
                      <p className="text-[9px] text-muted-foreground italic">{hotel.reviews.toLocaleString()} reviews</p>
                    )}
                  </div>
                  <div
                    className="w-11 h-11 rounded-2xl text-primary-foreground flex items-center justify-center shadow-md"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)" }}
                  >
                    <span className="text-sm font-extrabold" style={{ fontFamily: "'DM Serif Display', serif" }}>{hotel.rating}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Match Score */}
          {hotel.price > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex items-center gap-1 text-primary px-2.5 py-1 rounded-full border border-primary/15"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--accent) / 0.06) 100%)" }}
              >
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{aiScore}% match</span>
              </div>
              {hotel.propertyType && hotel.propertyType !== "HOTEL" && hotel.propertyType !== "Hotel" && (
                <Badge variant="outline" className="text-[10px] rounded-full font-bold uppercase tracking-wider">{hotel.propertyType}</Badge>
              )}
            </div>
          )}

          {/* Amenity highlights (max 3) */}
          {hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {hotel.amenities.slice(0, 3).map((a) => (
                <span key={a} className="text-[11px] bg-muted/40 text-muted-foreground px-2.5 py-1 rounded-full font-medium border border-border/30">
                  {a}
                </span>
              ))}
              {hotel.amenities.length > 3 && (
                <span className="text-[11px] text-muted-foreground/50 px-1.5 py-1 font-medium">+{hotel.amenities.length - 3}</span>
              )}
            </div>
          )}

          {/* Room preview */}
          {firstRoom && (
            <div
              className="mt-3 p-3 rounded-2xl border border-border/30"
              style={{ background: "linear-gradient(135deg, hsl(var(--muted) / 0.4) 0%, hsl(var(--muted) / 0.15) 100%)" }}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground line-clamp-1">{firstRoom.roomName || firstRoom.rooms?.[0]?.name || "Standard Room"}</span>
                {firstRoom.maxOccupancy && (
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Users className="w-3 h-3" /> {firstRoom.maxOccupancy}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-5 mt-5 border-t border-border/30">
          <div>
            {isSoldOut ? (
              <div className="flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-destructive" />
                <span className="text-sm font-bold text-destructive">Sold Out</span>
                <span className="text-[10px] text-muted-foreground ml-1">for selected dates</span>
              </div>
            ) : hotel.isPreview && hotel.price === 0 && fetchingPrices ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">Checking price…</span>
              </div>
            ) : hotel.price > 0 ? (
              <>
                <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase tracking-[0.14em]">From</p>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-[28px] text-foreground tracking-tight leading-none"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    {formatDirectPrice(hotel.price)}
                  </span>
                  <span className="text-sm text-muted-foreground italic">/ night</span>
                </div>
                {(hotel as any).totalPrice > 0 && (hotel as any).numNights > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    {formatDirectPrice((hotel as any).totalPrice)} total · {(hotel as any).numNights} nights
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground mb-0.5 font-bold uppercase tracking-[0.14em]">Availability</p>
                <span className="text-sm font-medium text-primary">Check availability</span>
              </>
            )}
          </div>
          <Button
            className={cn(
              "rounded-full gap-2 w-full sm:w-auto font-bold px-7 h-11 shadow-lg transition-all uppercase tracking-wider text-[12px]",
              isSoldOut
                ? "bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
                : "bg-gradient-to-r from-primary to-primary/85 hover:from-primary/95 hover:to-primary/80 text-primary-foreground shadow-primary/25 hover:shadow-xl hover:shadow-primary/35"
            )}
            onClick={onViewRooms}
            disabled={isSoldOut}
          >
            {isSoldOut ? "Unavailable" : "View Rooms"}
            {!isSoldOut && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HybridHotelCard;