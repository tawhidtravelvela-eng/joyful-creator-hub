import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_COLORS,
  FINANCE_STATUS_COLORS,
  SUPPORT_STATUS_COLORS,
} from "@/data/b2bMockData";

type BadgeType = "booking" | "finance" | "support";

const COLOR_MAPS = {
  booking: BOOKING_STATUS_COLORS,
  finance: FINANCE_STATUS_COLORS,
  support: SUPPORT_STATUS_COLORS,
};

const DOT_COLORS: Record<string, string> = {
  "Pending Payment": "bg-warning/50",
  "Pending Ticketing": "bg-info/50",
  "Confirmed": "bg-success/50",
  "Issued": "bg-success/50",
  "Cancelled": "bg-danger/50",
  "Refunded": "bg-purple-500",
  "Failed": "bg-danger",
  "On Hold": "bg-gray-400",
  "Open": "bg-info/50",
  "In Progress": "bg-warning/50",
  "Awaiting Response": "bg-purple-500",
  "Resolved": "bg-success/50",
  "Closed": "bg-gray-400",
  "Paid": "bg-success/50",
  "Partially Paid": "bg-warning/50",
  "Unpaid": "bg-danger/50",
  "Deposit Pending": "bg-info/50",
  "Verified": "bg-success/50",
  "Rejected": "bg-danger",
  "Pending": "bg-warning/50",
  "Needs Payment": "bg-warning/50",
  "Awaiting Payment": "bg-warning/50",
};

/** Pulse animation for active/pending statuses */
const PULSE_STATUSES = new Set(["Pending Payment", "Pending Ticketing", "Pending", "Needs Payment", "Awaiting Payment", "Open", "In Progress"]);

interface StatusBadgeProps {
  status: string;
  type?: BadgeType;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge = ({ status, type = "booking", className, showDot = true }: StatusBadgeProps) => {
  const map = COLOR_MAPS[type] as Record<string, string>;
  const colors = map[status] || "bg-muted text-muted-foreground";
  const dot = DOT_COLORS[status] || "bg-gray-400";
  const shouldPulse = PULSE_STATUSES.has(status);

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10px] font-semibold whitespace-nowrap tracking-wide backdrop-blur-sm",
      colors,
      className,
    )}>
      {showDot && (
        <span className="relative flex-shrink-0">
          <span className={cn("w-[5px] h-[5px] rounded-full block", dot)} />
          {shouldPulse && (
            <span className={cn("absolute inset-0 w-[5px] h-[5px] rounded-full animate-ping opacity-40", dot)} />
          )}
        </span>
      )}
      {status}
    </span>
  );
};
