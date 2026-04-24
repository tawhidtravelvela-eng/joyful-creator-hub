import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "accent" | "success" | "warning" | "destructive";
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: "bg-card border-border/50 shadow-sm",
  accent: "bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border-primary/15 shadow-sm shadow-primary/5",
  success: "bg-gradient-to-br from-success/60 to-success/20 border-success/30 shadow-sm shadow-success/50/5 dark:from-emerald-950/20 dark:to-emerald-950/5 dark:border-success/20",
  warning: "bg-gradient-to-br from-warning/60 to-warning/20 border-warning/30 shadow-sm shadow-warning/50/5 dark:from-amber-950/20 dark:to-amber-950/5 dark:border-warning/20",
  destructive: "bg-gradient-to-br from-danger/40 to-danger/10 border-danger/20 shadow-sm dark:from-red-950/15 dark:border-danger/15",
};

const iconVariants = {
  default: "bg-muted/80 text-foreground/50 ring-1 ring-border/30",
  accent: "bg-primary/10 text-primary ring-1 ring-primary/15",
  success: "bg-success/80 text-success ring-1 ring-success/40 dark:bg-success/30 dark:text-success dark:ring-success/30",
  warning: "bg-warning/80 text-warning ring-1 ring-warning/40 dark:bg-warning/30 dark:text-warning dark:ring-warning/30",
  destructive: "bg-danger/80 text-danger ring-1 ring-danger/40 dark:bg-danger/30 dark:text-danger",
};

export const KpiCard = ({
  title, value, subtitle, icon, trend, variant = "default", className, onClick,
}: KpiCardProps) => (
  <div
    className={cn(
      "group relative rounded-xl border px-4 py-3.5 transition-all duration-300 overflow-hidden",
      variantStyles[variant],
      onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/25",
      className,
    )}
    onClick={onClick}
  >
    {/* Subtle shimmer overlay on hover */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative flex items-start justify-between mb-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 leading-none">
        {title}
      </p>
      {icon && (
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
          iconVariants[variant],
        )}>
          {icon}
        </div>
      )}
    </div>
    <p className="relative text-[22px] font-bold text-foreground tracking-tight leading-none">{value}</p>
    {(subtitle || trend) && (
      <div className="relative flex items-center gap-2 mt-2">
        {subtitle && <span className="text-[10px] text-muted-foreground/45 font-medium">{subtitle}</span>}
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            trend.positive
              ? "text-success bg-success/60 dark:text-success dark:bg-success/30"
              : "text-danger bg-danger/60 dark:text-danger dark:bg-danger/30",
          )}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    )}
  </div>
);
