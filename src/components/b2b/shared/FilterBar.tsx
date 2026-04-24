import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onClear?: () => void;
}

export const FilterBar = ({ searchValue, onSearchChange, searchPlaceholder = "Search…", children, onClear }: FilterBarProps) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border">
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="pl-8 h-9 text-sm bg-background"
      />
    </div>
    {children}
    {onClear && searchValue && (
      <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1 text-xs">
        <X className="w-3 h-3" /> Clear
      </Button>
    )}
  </div>
);
