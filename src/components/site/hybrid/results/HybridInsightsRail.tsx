import { ReactNode } from "react";
import { Sparkles, TrendingUp, ShieldCheck, Headphones, Calendar as CalIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HybridInsightsRail — editorial right-side rail for Hybrid skin
 * results pages. Replaces B2CRightInsightsPanel with a leaner, more
 * editorial set of cards focused on trust + curation rather than dense
 * analytics. Variants: "flights" | "hotels" | "tours".
 */

type Variant = "flights" | "hotels" | "tours";

interface Props {
  variant: Variant;
  currencySymbol?: string;
  cheapestPrice?: number;
  origin?: string;
  destination?: string;
  highlightTitle?: string;
  highlightBody?: string;
  onSupportClick?: () => void;
}

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      "relative rounded-3xl overflow-hidden",
      "bg-card/70 backdrop-blur-xl",
      "border border-border/40",
      "shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)]",
      className,
    )}
  >
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 mb-1.5">
    {children}
  </div>
);

const Headline = ({ children }: { children: ReactNode }) => (
  <h3
    className="text-[16px] font-semibold text-foreground leading-snug tracking-tight"
    style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
  >
    {children}
  </h3>
);

const variantCopy: Record<Variant, { eyebrow: string; headline: string; body: string }> = {
  flights: {
    eyebrow: "Editor's note",
    headline: "How we chose these flights",
    body:
      "Our editors weight schedule reliability, cabin quality and on-time performance — not just price — so each result is genuinely worth your time.",
  },
  hotels: {
    eyebrow: "Editor's note",
    headline: "How we chose these stays",
    body:
      "Each property is hand-vetted for location, hospitality and guest reviews. We surface a small, curated set instead of an exhausting catalogue.",
  },
  tours: {
    eyebrow: "Editor's note",
    headline: "How we curate experiences",
    body:
      "Local guides, small-group sizes and standout reviews are weighted ahead of price. You'll see the experiences our editors would book themselves.",
  },
};

export const HybridInsightsRail = ({
  variant,
  currencySymbol,
  cheapestPrice,
  origin,
  destination,
  highlightTitle,
  highlightBody,
  onSupportClick,
}: Props) => {
  const v = variantCopy[variant];
  return (
    <div className="space-y-4">
      {/* Lead price card (hidden on tours when no cheapest price provided) */}
      {typeof cheapestPrice === "number" && cheapestPrice > 0 && (
        <Card>
          <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[hsl(var(--primary)/0.18)] blur-2xl" />
          <div className="relative p-5">
            <Eyebrow>From</Eyebrow>
            <div className="flex items-baseline gap-2">
              <div
                className="text-[34px] font-semibold text-foreground tabular-nums leading-none"
                style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
              >
                {currencySymbol}{Math.round(cheapestPrice).toLocaleString()}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {variant === "flights" ? "per traveler" : variant === "hotels" ? "per night" : "per person"}
              </span>
            </div>
            {origin && destination && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                <span>{origin}</span>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span>{destination}</span>
              </div>
            )}
            <div className="mt-4 flex items-center gap-1.5 text-[10.5px] text-success font-semibold">
              <TrendingUp className="w-3 h-3" /> Live pricing — updated this minute
            </div>
          </div>
        </Card>
      )}

      {/* Editor's note */}
      <Card>
        <div className="relative p-5">
          <Eyebrow>{v.eyebrow}</Eyebrow>
          <Headline>{v.headline}</Headline>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{v.body}</p>
          <div className="mt-4 flex items-center gap-2 text-[10.5px] text-primary/90 font-semibold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> Vela editors
          </div>
        </div>
      </Card>

      {/* Optional dynamic highlight (e.g. price tip / route insight) */}
      {(highlightTitle || highlightBody) && (
        <Card>
          <div className="relative p-5">
            <Eyebrow>Insight</Eyebrow>
            {highlightTitle && <Headline>{highlightTitle}</Headline>}
            {highlightBody && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{highlightBody}</p>
            )}
          </div>
        </Card>
      )}

      {/* Trust card */}
      <Card>
        <div className="relative p-5 grid grid-cols-2 gap-4">
          <div>
            <ShieldCheck className="w-4 h-4 text-primary mb-2" />
            <div className="text-[12.5px] font-semibold text-foreground leading-tight">Secure booking</div>
            <p className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed">
              Encrypted checkout. No hidden fees.
            </p>
          </div>
          <div>
            <CalIcon className="w-4 h-4 text-primary mb-2" />
            <div className="text-[12.5px] font-semibold text-foreground leading-tight">Flexible options</div>
            <p className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed">
              Many fares with free changes.
            </p>
          </div>
        </div>
      </Card>

      {/* Concierge */}
      <Card>
        <div className="pointer-events-none absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-[hsl(var(--accent)/0.14)] blur-2xl" />
        <div className="relative p-5">
          <Eyebrow>Need a hand?</Eyebrow>
          <Headline>Talk to a travel specialist</Headline>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Our concierge desk responds in minutes. Get itinerary advice, fare holds and group quotes.
          </p>
          <button
            onClick={onSupportClick}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.6)]"
          >
            <Headphones className="w-3.5 h-3.5" /> Start a chat
          </button>
        </div>
      </Card>
    </div>
  );
};

export default HybridInsightsRail;
