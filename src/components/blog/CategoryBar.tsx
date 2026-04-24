import { useMemo } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlogPost, BlogCategory } from "./blogTypes";

const CategoryBar = ({
  categories, selected, onSelect, stickyRef, posts
}: {
  categories: BlogCategory[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  stickyRef: React.RefObject<HTMLDivElement>;
  posts: BlogPost[];
}) => {
  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    posts.forEach(p => { if (p.category_id) m[p.category_id] = (m[p.category_id] || 0) + 1; });
    return m;
  }, [posts]);

  const trendingIds = useMemo(() => {
    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
    return new Set(sorted.slice(0, 2).map(([id]) => id));
  }, [countMap]);

  return (
    <nav
      ref={stickyRef as any}
      aria-label="Blog categories"
      className="sticky top-14 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 -mx-4 px-4 py-3 sm:py-4"
    >
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
          {[{ id: null, name: "All" }, ...categories].map(c => {
            const isActive = c.id === null ? !selected : selected === c.id;
            const count = c.id ? countMap[c.id] || 0 : posts.length;
            const isTrending = c.id ? trendingIds.has(c.id) : false;
            return (
              <button
                key={c.id ?? "all"}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-300 whitespace-nowrap inline-flex items-center gap-1.5",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-lg shadow-accent/25"
                    : "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {isTrending && <Flame className="w-3 h-3 text-orange-400" />}
                {c.name}
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  isActive ? "bg-white/20" : "bg-muted text-muted-foreground/60"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {/* Scroll fade hint for mobile */}
        <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-background/80 to-transparent pointer-events-none sm:hidden" />
      </div>
    </nav>
  );
};

export default CategoryBar;
