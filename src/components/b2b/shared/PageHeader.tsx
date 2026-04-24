import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}

export const PageHeader = ({ title, description, actions, badge }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">
          {title}
        </h1>
        {badge}
      </div>
      {description && (
        <p className="text-[13px] text-muted-foreground/60 mt-1.5 font-medium">{description}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);
