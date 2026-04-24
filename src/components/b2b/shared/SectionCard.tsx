import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const SectionCard = ({ title, action, children, className, noPadding }: SectionCardProps) => (
  <div className={cn(
    "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md",
    className,
  )}>
    <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-gradient-to-r from-muted/30 to-transparent">
      <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.08em]">
        {title}
      </h3>
      {action}
    </div>
    <div className={cn(!noPadding && "px-5 py-4")}>
      {children}
    </div>
  </div>
);
