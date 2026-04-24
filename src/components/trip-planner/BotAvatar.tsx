import { cn } from "@/lib/utils";
import { useBotIdentity } from "@/hooks/useBotIdentity";

/**
 * BotAvatar — brand-aware avatar for the AI trip planner.
 *
 * Renders the configured bot avatar (favicon/logo per tenant) or a clean
 * primary-tinted initial badge when nothing is configured. Replaces every
 * hardcoded `/images/vela-ai-avatar.jpg` reference across the planner.
 */
const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-5 h-5 text-[9px] rounded-md",
  sm: "w-7 h-7 text-[10px] rounded-lg",
  md: "w-8 h-8 text-[11px] rounded-lg",
  lg: "w-10 h-10 text-[12px] rounded-xl",
  xl: "w-16 h-16 text-base rounded-2xl",
};

interface Props {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ringed?: boolean;
}

const BotAvatar = ({ size = "sm", className, ringed = true }: Props) => {
  const bot = useBotIdentity();
  const sizeCls = SIZE_CLASS[size];

  if (bot.avatarUrl) {
    return (
      <div
        className={cn("overflow-hidden shrink-0 bg-background", sizeCls, className)}
        style={
          ringed
            ? {
                border: "1px solid hsl(var(--primary) / 0.3)",
                boxShadow: "0 0 12px hsl(var(--primary) / 0.15)",
              }
            : undefined
        }
      >
        <img
          src={bot.avatarUrl}
          alt={bot.name}
          className="w-full h-full object-contain p-0.5"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid place-items-center font-bold text-primary-foreground shrink-0",
        sizeCls,
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.78) 100%)",
        boxShadow: ringed
          ? "0 0 12px hsl(var(--primary) / 0.25), inset 0 1px 0 hsl(0 0% 100% / 0.18)"
          : "inset 0 1px 0 hsl(0 0% 100% / 0.18)",
      }}
      aria-label={bot.name}
    >
      {bot.initials}
    </div>
  );
};

export default BotAvatar;
