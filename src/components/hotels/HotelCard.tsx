import { Star, MapPin, ArrowRight, Loader2, Heart, Sparkles, Users, Clock, ShieldCheck, Coffee, Ban, Layers } from "lucide-react";
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
  /** When >1, the same hotel was returned by multiple suppliers and merged into one card (cheapest shown). */
  _supplierCount?: number;
  /** Highest per-night rate observed across suppliers — used to show "save up to" indicator. */
  _highestPriceAcrossSuppliers?: number;
}

interface HotelCardProps {
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
  // Use server-computed popularityScore (0-190 scale with traveler-aware signals) → map to 60-98 display range
  if (hotel.popularityScore && hotel.popularityScore > 0) {
    return Math.min(98, Math.max(60, Math.round(60 + (hotel.popularityScore / 190) * 38)));
  }
  // Fallback for hotels without server score
  let score = 70;
  if (hotel.rating >= 8) score += 10;
  if (hotel.rating >= 9) score += 5;
  if (hotel.stars >= 4) score += 5;
  if (hotel.mealBasis && hotel.mealBasis !== "Room Only") score += 5;
  if (hotel.amenities.length >= 4) score += 5;
  if (hotel.hasFreeCancellation || hotel.availableRooms?.some((r: any) => r.isRefundable)) score += 3;
  return Math.min(score, 98);
};

const HotelCard = ({ hotel, index, fetchingPrices, formatDirectPrice, onViewRooms, onHover }: HotelCardProps) => {
  const aiScore = getAiMatchScore(hotel);
  const isTopPick = index < 3 && hotel.rating >= 8;
  const isBestValue = hotel.price > 0 && hotel.rating >= 7 && hotel.stars >= 3;
  const hasFreeCancellation = hotel.hasFreeCancellation || hotel.availableRooms?.some((r: any) => r.isRefundable);
  const hasMeal = hotel.mealBasis && hotel.mealBasis !== "Room Only";
  const firstRoom = hotel.availableRooms?.[0];
  const isSoldOut = hotel.isSoldOut;
  const supplierCount = hotel._supplierCount && hotel._supplierCount > 1 ? hotel._supplierCount : 0;
  const highestRate = hotel._highestPriceAcrossSuppliers || 0;
  const savePct = supplierCount && highestRate > hotel.price && hotel.price > 0
    ? Math.round(((highestRate - hotel.price) / highestRate) * 100)
    : 0;

  return (
    <div
      className={cn(
        "bg-card rounded-2xl sm:rounded-3xl overflow-hidden border border-border/30 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.06] transition-all duration-300 flex flex-col xl:flex-row group/card",
        isSoldOut && "opacity-60 grayscale-[30%]"
      )}
      style={{ boxShadow: "var(--card-shadow)" }}
      onMouseEnter={() => onHover?.(hotel.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Image */}
      <div className="h-52 sm:h-60 xl:h-auto xl:w-[300px] 2xl:w-[340px] flex-shrink-0 relative overflow-hidden">
        <ImageCarousel
          images={hotel.images?.length ? hotel.images.slice(0, 8) : (hotel.image ? [hotel.image] : [])}
          alt={hotel.name}
          className="w-full h-full"
          eager={index < 3}
        />

        {/* Top badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
          {isTopPick && (
            <div className="bg-primary text-primary-foreground px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Top Pick
            </div>
          )}
          {isBestValue && !isTopPick && (
            <div className="bg-accent text-accent-foreground px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-lg">
              Best Value
            </div>
          )}
          {hotel.stars > 0 && (
            <div className="bg-card/90 backdrop-blur-sm text-foreground px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg">
              <Star className="w-3 h-3 fill-accent text-accent" />
              <span className="text-[10px] font-bold">{hotel.stars}-star</span>
            </div>
          )}
        </div>

        {/* Right badges stack */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          {hasFreeCancellation && (
            <div className="bg-[hsl(var(--success))]/90 backdrop-blur-sm text-[hsl(var(--success-foreground))] px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Free Cancel
            </div>
          )}
          {hasMeal && (
            <div className="bg-card/90 backdrop-blur-sm text-foreground px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg flex items-center gap-1">
              <Coffee className="w-3 h-3 text-accent" /> {hotel.mealBasis}
            </div>
          )}
        </div>

        {/* Save button */}
        <button className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-card shadow-lg">
          <Heart className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-extrabold text-foreground leading-tight line-clamp-2 tracking-tight">
                {hotel.name}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                <MapPin className="w-3 h-3 flex-shrink-0 text-accent" />
                <span className="truncate">{hotel.city}{hotel.country && `, ${hotel.country}`}</span>
              </p>
            </div>

            {/* Rating block */}
            {hotel.rating > 0 && (
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <div>
                    <p className="text-[10px] font-bold text-primary">{getRatingLabel(hotel.rating)}</p>
                    {hotel.reviews > 0 && (
                      <p className="text-[9px] text-muted-foreground">{hotel.reviews.toLocaleString()} reviews</p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <span className="text-sm font-extrabold">{hotel.rating}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Match Score */}
          {hotel.price > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 bg-primary/8 text-primary px-2 py-0.5 rounded-md">
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] font-bold">{aiScore}% match</span>
              </div>
              {hotel.propertyType && hotel.propertyType !== "HOTEL" && hotel.propertyType !== "Hotel" && (
                <Badge variant="outline" className="text-[10px] rounded-full font-bold">{hotel.propertyType}</Badge>
              )}
              {supplierCount > 1 && (
                <div
                  className="flex items-center gap-1 bg-success/10 text-success px-2 py-0.5 rounded-md"
                  title={`Showing the lowest of ${supplierCount} available rates`}
                >
                  <Layers className="w-3 h-3" />
                  <span className="text-[10px] font-bold">
                    {supplierCount} rates compared{savePct >= 3 ? ` · save ${savePct}%` : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Amenity highlights (max 3) */}
          {hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {hotel.amenities.slice(0, 3).map((a) => (
                <span key={a} className="text-[11px] bg-muted/50 text-muted-foreground px-2.5 py-1 rounded-lg font-medium">
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
            <div className="mt-3 p-2.5 bg-muted/30 rounded-xl border border-border/20">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-4 mt-4 border-t border-border/15">
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
                <span className="text-sm font-medium text-primary">Checking price...</span>
              </div>
            ) : hotel.price > 0 ? (
              <>
                <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">From</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground tracking-tight">
                    {formatDirectPrice(hotel.price)}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">/ night</span>
                </div>
                {(hotel as any).totalPrice > 0 && (hotel as any).numNights > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDirectPrice((hotel as any).totalPrice)} total · {(hotel as any).numNights} nights
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">Availability</p>
                <span className="text-sm font-medium text-primary">Check availability</span>
              </>
            )}
          </div>
          <Button
            className={cn(
              "rounded-full gap-2 w-full sm:w-auto font-bold px-7 h-11 shadow-lg transition-all",
              isSoldOut
                ? "bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/15 hover:shadow-xl hover:shadow-primary/25"
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

export default HotelCard;
