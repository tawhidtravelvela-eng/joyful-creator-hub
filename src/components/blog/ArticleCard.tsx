import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, ArrowRight, Plane, Shield, Loader2, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import { extractDestination, getIataCode, formatCachedPrice, estimateReadTime, fmtIso } from "./blogTypes";
import type { BlogPost, CachedPrice } from "./blogTypes";
import { useBlogImageFallback } from "@/hooks/useBlogImageFallback";

const ArticleCard = ({ post, index, categoryName, formatDate, showBadge, cachedPrices }: {
  post: BlogPost;
  index: number;
  categoryName: string;
  formatDate: (p: BlogPost) => string;
  showBadge?: "popular" | "editors_pick" | null;
  cachedPrices: Record<string, CachedPrice>;
}) => {
  const dest = extractDestination(post);
  const iata = dest ? getIataCode(dest) : null;
  const price = iata ? cachedPrices[iata] : null;
  const readTime = estimateReadTime(post.word_count || 0);
  const { imageUrl, isLoading, onImageError } = useBlogImageFallback(
    post.id, post.featured_image, post.title, post.excerpt, post.tags as string[]
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 + index * 0.04 }}
      className="h-full"
    >
      <div className="group bg-card border border-border/25 rounded-2xl sm:rounded-3xl overflow-hidden h-full flex flex-col hover:border-accent/20 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-accent/8 transition-all duration-500">
        <Link to={`/blog/${post.slug}`} className="block relative">
          {imageUrl ? (
            <div className="aspect-[16/10] overflow-hidden relative">
              <img
                src={imageUrl}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[900ms] ease-out"
                loading="lazy"
                decoding="async"
                width={640}
                height={400}
                onError={() => onImageError()}
              />
              {/* Hover overlay with "Read" indicator */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 text-foreground text-xs font-bold shadow-lg backdrop-blur-sm">
                  <Eye className="w-3.5 h-3.5" /> Read Article
                </span>
              </div>
              {showBadge && (
                <div className="absolute top-3 left-3">
                  <Badge className={cn(
                    "border-0 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider shadow-lg",
                    showBadge === "popular"
                      ? "bg-accent text-accent-foreground"
                      : "bg-primary text-primary-foreground"
                  )}>
                    {showBadge === "popular" ? "🔥 Trending" : "✨ Editor's Pick"}
                  </Badge>
                </div>
              )}
              <div className="absolute top-3 right-3">
                <Badge className="bg-card/90 backdrop-blur-md text-foreground border-0 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] shadow-lg">
                  {categoryName}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="aspect-[16/10] bg-gradient-to-br from-primary/8 to-accent/6 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-accent/40 animate-spin" />
                  <span className="text-[10px] text-muted-foreground/50 font-medium">Loading image…</span>
                </div>
              ) : (
                <BookOpen className="w-10 h-10 text-muted-foreground/15" />
              )}
            </div>
          )}
        </Link>

        <div className="p-5 sm:p-6 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-muted-foreground/60 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" /> {readTime} min read
            </span>
            <span className="text-muted-foreground/20">·</span>
            <time dateTime={fmtIso(post)} className="text-[10px] text-muted-foreground/60 font-medium">
              {formatDate(post)}
            </time>
          </div>

          <Link to={`/blog/${post.slug}`}>
            <h3
              className="text-[15px] sm:text-base font-bold text-foreground leading-snug line-clamp-2 mb-2.5 group-hover:text-accent transition-colors duration-300"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {post.title}
            </h3>
          </Link>

          {post.excerpt && (
            <p className="text-[13px] text-muted-foreground/65 line-clamp-2 mb-3 flex-1 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Clickable tags as filters */}
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(post.tags as string[]).slice(0, 3).map(t => (
                <Link
                  key={t}
                  to={`/blog?q=${encodeURIComponent(t)}`}
                  className="text-[10px] font-semibold text-muted-foreground/60 hover:text-accent bg-muted/40 hover:bg-accent/10 px-2.5 py-1 rounded-full transition-colors"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {dest && price && (
            <p className="text-[11px] font-semibold text-primary/70 mb-4 flex items-center gap-1">
              <Plane className="w-2.5 h-2.5" />
              From {formatCachedPrice(price.price, price.currency)}
            </p>
          )}

          <footer className="flex items-center justify-between pt-4 border-t border-border/25 mt-auto">
            {post.author_name && (
              <Link
                to={`/blog/author/${post.author_name.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center gap-2 group/author"
              >
                <AuthorAvatar name={post.author_name} size="sm" />
                <span className="text-[11px] font-semibold text-foreground/80 group-hover/author:text-accent transition-colors flex items-center gap-1">
                  {post.author_name}
                  <Shield className="w-2.5 h-2.5 text-primary/40" />
                </span>
              </Link>
            )}
            <Link
              to={`/blog/${post.slug}`}
              className="inline-flex items-center gap-1 text-accent text-[11px] font-bold hover:gap-2 transition-all duration-300"
            >
              Read <ArrowRight className="w-3 h-3" />
            </Link>
          </footer>
        </div>
      </div>
    </motion.article>
  );
};

export default ArticleCard;
