import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center text-muted-foreground/40 mb-5 ring-1 ring-border/30">
      {icon || <Inbox className="w-6 h-6" />}
    </div>
    <h3 className="text-base font-semibold text-foreground/80 mb-1">{title}</h3>
    {description && <p className="text-sm text-muted-foreground/50 max-w-xs">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
