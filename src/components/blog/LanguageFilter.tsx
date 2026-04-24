import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGE_OPTIONS } from "./blogTypes";
import type { BlogPost } from "./blogTypes";
import { useMemo } from "react";

const LanguageFilter = ({
  posts,
  selected,
  onSelect,
}: {
  posts: BlogPost[];
  selected: string | null;
  onSelect: (lang: string | null) => void;
}) => {
  const availableLanguages = useMemo(() => {
    const langSet = new Set<string>();
    posts.forEach((p) => {
      if (p.language) langSet.add(p.language);
    });
    return LANGUAGE_OPTIONS.filter((l) => langSet.has(l.code));
  }, [posts]);

  if (availableLanguages.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Globe className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all min-h-[32px]",
          !selected
            ? "bg-accent text-accent-foreground shadow-sm"
            : "bg-muted/50 text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
      {availableLanguages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onSelect(selected === lang.code ? null : lang.code)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all min-h-[32px] inline-flex items-center gap-1.5",
            selected === lang.code
              ? "bg-accent text-accent-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{lang.flag}</span>
          <span className="hidden sm:inline">{lang.label}</span>
          <span className="sm:hidden">{lang.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageFilter;
