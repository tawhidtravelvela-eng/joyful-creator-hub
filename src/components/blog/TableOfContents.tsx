import { useState, useEffect, useMemo } from "react";
import { List, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

const TableOfContents = ({ content }: { content: string }) => {
  const [activeId, setActiveId] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const headings = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const els = doc.querySelectorAll("h2, h3");
    const result: TocHeading[] = [];
    els.forEach((el, i) => {
      const text = el.textContent?.trim() || "";
      if (!text) return;
      const id = `heading-${i}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
      result.push({
        id,
        text,
        level: el.tagName === "H2" ? 2 : 3,
      });
    });
    return result;
  }, [content]);

  // Inject IDs into the actual DOM headings after render
  useEffect(() => {
    if (headings.length === 0) return;
    const article = document.querySelector(".prose");
    if (!article) return;
    const els = article.querySelectorAll("h2, h3");
    let idx = 0;
    els.forEach((el) => {
      const text = el.textContent?.trim() || "";
      if (!text) return;
      if (idx < headings.length) {
        el.id = headings[idx].id;
        idx++;
      }
    });
  }, [headings]);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0.1 }
    );

    const timer = setTimeout(() => {
      headings.forEach((h) => {
        const el = document.getElementById(h.id);
        if (el) observer.observe(el);
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5 mb-10"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left"
      >
        <List className="w-4 h-4 text-accent" />
        <span className="text-sm font-bold text-foreground">In This Article</span>
        <span className="text-[10px] text-muted-foreground/50 font-semibold ml-1">
          {headings.length} sections
        </span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/40 ml-auto transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 space-y-0.5 overflow-hidden list-none p-0"
          >
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(h.id);
                    if (el) {
                      const y = el.getBoundingClientRect().top + window.scrollY - 100;
                      window.scrollTo({ top: y, behavior: "smooth" });
                    }
                  }}
                  className={cn(
                    "block py-1.5 text-[13px] font-medium transition-all duration-200 hover:text-accent border-l-2",
                    h.level === 3 ? "pl-6" : "pl-3",
                    activeId === h.id
                      ? "text-accent border-accent font-semibold"
                      : "text-muted-foreground/60 border-transparent hover:border-accent/30"
                  )}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default TableOfContents;
