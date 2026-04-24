import { Sparkles, TrendingDown, TrendingUp, Clock, Plane, Briefcase, RefreshCw, BadgeCheck, Tag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvisorPayload, AdvisorEvidence } from "./types";

const ICON_MAP: Record<AdvisorEvidence["icon"], typeof Plane> = {
  price: Tag,
  time: Clock,
  comfort: BadgeCheck,
  stops: Plane,
  baggage: Briefcase,
  refund: RefreshCw,
  ontime: BadgeCheck,
  trend: TrendingUp,
};

const TONE_RING: Record<NonNullable<AdvisorEvidence["tone"]>, string> = {
  good: "bg-success/5 text-success ring-success/60 dark:bg-success/50/10 dark:text-success dark:ring-success/50/20",
  neutral: "bg-muted/60 text-foreground/85 ring-border/60",
  warn: "bg-warning/5 text-warning ring-warning/60 dark:bg-warning/50/10 dark:text-warning dark:ring-warning/50/20",
};

const VERDICT_PILL: Record<AdvisorPayload["verdict"]["tone"], string> = {
  good: "bg-success/10 text-success dark:bg-success/50/15 dark:text-success",
  neutral: "bg-info/10 text-info dark:bg-info/50/15 dark:text-info",
  warn: "bg-warning/10 text-warning dark:bg-warning/50/15 dark:text-warning",
};

interface Props {
  advisor: AdvisorPayload;
  variant?: "tip" | "pick";        // tip = right-rail Smart Tip, pick = inside flight card
  onAction?: (kind: AdvisorPayload["action"] extends infer A ? (A extends { kind: infer K } ? K : never) : never) => void;
  className?: string;
}

export function AdvisorBlock({ advisor, variant = "tip", onAction, className }: Props) {
  const isPick = variant === "pick";

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Verdict pill */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide",
          VERDICT_PILL[advisor.verdict.tone],
        )}>
          {advisor.verdict.tone === "good" && <TrendingDown className="h-2.5 w-2.5" />}
          {advisor.verdict.tone === "warn" && <TrendingUp className="h-2.5 w-2.5" />}
          {advisor.verdict.label}
        </span>
        {isPick && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider">
            <Sparkles className="h-2.5 w-2.5" />
            VELA PICK
          </span>
        )}
      </div>

      {/* Conversational lead */}
      <p className={cn(
        "leading-snug text-foreground/90",
        isPick ? "text-[12.5px]" : "text-[13px] font-medium",
      )}>
        {advisor.lead}
      </p>

      {/* Evidence chips */}
      {advisor.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {advisor.evidence.map((e, i) => {
            const Icon = ICON_MAP[e.icon] || Tag;
            const tone = e.tone || "neutral";
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold ring-1 leading-none",
                  TONE_RING[tone],
                )}
                title={e.detail}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {e.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Action */}
      {advisor.action && (
        <button
          onClick={() => onAction?.(advisor.action!.kind as any)}
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-[11px] font-bold transition-colors",
            advisor.action.kind === "book_now"
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {advisor.action.label}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default AdvisorBlock;
