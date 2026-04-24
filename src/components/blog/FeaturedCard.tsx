import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, Plane, Shield, BookOpen, Loader2, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import { extractDestination, getIataCode, formatCachedPrice, estimateReadTime, fmtIso } from "./blogTypes";
import type { BlogPost, CachedPrice } from "./blogTypes";
import { useBlogImageFallback } from "@/hooks/useBlogImageFallback";

const FeaturedCard = ({ post, categoryName, formatDate, cachedPrices }: {
  post: BlogPost;
  categoryName: string;
  formatDate: (p: BlogPost) => string;
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
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      aria-label={`Featured: ${post.title}`}
    >
      <div className="group relative rounded-3xl overflow-hidden bg-card border border-border/20 hover:border-accent/20 transition-all duration-500 hover:shadow-2xl hover:shadow-accent/8">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <Link to={`/blog/${post.slug}`} className="block relative">
            {imageUrl ? (
              <div className="aspect-[16/10] lg:aspect-auto lg:min-h-[480px] overflow-hidden relative">
                <img
                  src={imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1200ms] ease-out"
                  fetchPriority="high"
                  decoding="async"
                  width={800}
                  height={500}
                  onError={() => onImageError()}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card/5 group-hover:to-card/15 transition-all duration-700" />
                {/* Hover read indicator */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                  <span className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white/90 text-foreground text-sm font-bold shadow-xl backdrop-blur-sm">
                    <Eye className="w-4 h-4" /> Read Article
                  </span>
                </div>
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className="bg-accent text-accent-foreground border-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg">
                    ✨ Editor's Pick
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="aspect-[16/10] lg:aspect-auto lg:min-h-[480px] bg-gradient-to-br from-primary/8 to-accent/6 flex items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-accent/40 animate-spin" />
                    <span className="text-xs text-muted-foreground/50 font-medium">Loading image…</span>
                  </div>
                ) : (
                  <BookOpen className="w-14 h-14 text-muted-foreground/15" />
                )}
              </div>
            )}
          </Link>
          <div className={cn(
            "flex flex-col justify-center",
            imageUrl ? "p-6 sm:p-10 lg:p-14" : "p-6 sm:p-10 lg:p-16"
          )}>
            <div className="flex items-center gap-3 mb-5">
              <Badge className="bg-accent/10 text-accent hover:bg-accent/20 border-0 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em]">
                {categoryName}
              </Badge>
              <span className="text-[11px] text-muted-foreground/60 font-semibold flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {readTime} min read
              </span>
            </div>
            <Link to={`/blog/${post.slug}`}>
              <h2
                className="text-2xl sm:text-3xl lg:text-[2.75rem] font-bold text-foreground leading-[1.1] mb-5 hover:text-accent transition-colors duration-400"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {post.title}
              </h2>
            </Link>
            {post.excerpt && (
              <p className="text-muted-foreground text-sm sm:text-[15px] leading-[1.75] mb-5 line-clamp-3">
                {post.excerpt}
              </p>
            )}

            {dest && price && (
              <p className="text-xs font-semibold text-primary/70 mb-6 flex items-center gap-1.5">
                <Plane className="w-3 h-3" />
                Flights to {dest} from {formatCachedPrice(price.price, price.currency)}
              </p>
            )}

            <div className="flex items-center justify-between pt-5 border-t border-border/30">
              {post.author_name && (
                <Link
                  to={`/blog/author/${post.author_name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex items-center gap-3 group/author"
                >
                  <AuthorAvatar name={post.author_name} size="md" />
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover/author:text-accent transition-colors flex items-center gap-1">
                      {post.author_name}
                      <Shield className="w-3 h-3 text-primary/60" />
                    </p>
                    <time dateTime={fmtIso(post)} className="text-[10px] text-muted-foreground/50 font-medium">
                      {formatDate(post)}
                    </time>
                  </div>
                </Link>
              )}
              <Link
                to={`/blog/${post.slug}`}
                className="inline-flex items-center gap-2 text-accent font-bold text-sm hover:gap-3.5 transition-all duration-400"
              >
                Read Article <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default FeaturedCard;
