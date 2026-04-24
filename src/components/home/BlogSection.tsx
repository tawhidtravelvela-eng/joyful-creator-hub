import { useState, useEffect } from "react";
import { BlogSkeleton } from "./HomeSkeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, User, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useTenant } from "@/hooks/useTenant";
import { useBlogImageFallback } from "@/hooks/useBlogImageFallback";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  tags: string[];
  author_name: string;
  published_at: string | null;
  created_at: string;
  word_count?: number;
  blog_categories?: { name: string } | null;
}

const estimateReadTime = (wordCount: number) => Math.max(1, Math.round((wordCount || 0) / 200));

const BlogImage = ({ post }: { post: Post }) => {
  const { imageUrl, isLoading, onImageError } = useBlogImageFallback(
    post.id, post.featured_image, post.title, post.excerpt, post.tags as string[]
  );
  if (!imageUrl && !isLoading) return null;
  if (!imageUrl && isLoading) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-primary/8 to-accent/6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <img
      src={imageUrl!}
      alt={post.title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      loading="lazy"
      onError={() => onImageError()}
    />
  );
};

const BlogSection = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenant } = useTenant();
  const { content } = useSiteContent();
  const bCfg = (content.blog || {}) as Record<string, any>;

  useEffect(() => {
    let query = supabase
      .from("blog_posts")
      .select("id,title,slug,excerpt,featured_image,tags,author_name,published_at,created_at,word_count,blog_categories(name),language")
      .eq("status", "published")
      .or("language.is.null,language.eq.en")
      .order("published_at", { ascending: false })
      .limit(3);

    if (tenant) {
      // Strict isolation: tenants only see their own posts (never main-site posts)
      query = query.eq("tenant_id", tenant.id);
    } else {
      query = query.is("tenant_id", null);
    }

    query.then(({ data }) => {
      if (data) setPosts(data as any);
      setLoading(false);
    });
  }, [tenant]);

  if (loading) return <BlogSkeleton />;
  if (posts.length === 0) {
    // Don't render the section if there are no blog posts — this is expected
    return null;
  }

  const formatDate = (post: Post) =>
    format(new Date(post.published_at || post.created_at), "MMM d, yyyy");

  const categoryName = (post: Post) =>
    (post.blog_categories as any)?.name || post.tags?.[0] || "Travel";

  return (
    <section className="py-20 sm:py-32 bg-muted/20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.025] rounded-full blur-[120px] -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/[0.02] rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-18">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-5"
          >
            {bCfg.badge || "Latest Stories"}
          </motion.span>
          {bCfg.heading ? (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(bCfg.heading)) }}
            />
          ) : (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              From Our Blog
            </motion.h2>
          )}
          {bCfg.subtitle && (
            <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-xl mx-auto">{bCfg.subtitle}</p>
          )}
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Featured / large card */}
          {posts[0] && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.15 }}
            >
              <Link to={`/blog/${posts[0].slug}`} className="group block h-full">
                <div className="relative bg-card border border-border/20 rounded-2xl sm:rounded-3xl overflow-hidden h-full flex flex-col hover:shadow-[0_24px_60px_-12px_hsl(222_30%_8%/0.1)] hover:-translate-y-1 transition-all duration-500">
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <BlogImage post={posts[0]} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Hover read indicator */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                      <span className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 text-foreground text-xs font-bold shadow-lg backdrop-blur-sm">
                        <Eye className="w-3.5 h-3.5" /> Read Article
                      </span>
                    </div>
                  </div>
                  <div className="p-5 sm:p-7 flex flex-col flex-1">
                    <div className="flex items-center gap-2.5 mb-3">
                      <Badge className="bg-primary/8 text-primary hover:bg-primary/12 border-0 rounded-full px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                        {categoryName(posts[0])}
                      </Badge>
                      <span className="text-[10px] sm:text-xs text-muted-foreground/50 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {estimateReadTime(posts[0].word_count || 0)} min
                      </span>
                    </div>
                    <h3
                      className="text-lg sm:text-2xl font-bold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors duration-300 line-clamp-2"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      {posts[0].title}
                    </h3>
                    {posts[0].excerpt && (
                      <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-4 hidden sm:block">{posts[0].excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
                      {posts[0].author_name && (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground/60">
                          <div className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center">
                            <User className="w-3 h-3 text-primary" />
                          </div>
                          {posts[0].author_name}
                          <span className="text-muted-foreground/30">·</span>
                          {formatDate(posts[0])}
                        </span>
                      )}
                      <span className="text-primary font-semibold text-xs sm:text-sm flex items-center gap-1.5 group-hover:gap-3 transition-all duration-300">
                        Read More <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Right column */}
          <div className="flex flex-col gap-5 sm:gap-6">
            {posts.slice(1, 3).map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex-1"
              >
                <Link to={`/blog/${post.slug}`} className="group block h-full">
                  <div className="bg-card border border-border/20 rounded-2xl overflow-hidden flex gap-4 sm:gap-5 h-full hover:shadow-[0_20px_50px_-12px_hsl(222_30%_8%/0.08)] hover:-translate-y-0.5 transition-all duration-500">
                    <div className="flex-shrink-0 w-28 sm:w-44 md:w-52 overflow-hidden relative">
                      <BlogImage post={post} />
                    </div>
                    <div className="flex flex-col justify-center py-4 pr-4 sm:py-5 sm:pr-5 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className="bg-primary/8 text-primary hover:bg-primary/12 border-0 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                          {categoryName(post)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {estimateReadTime(post.word_count || 0)} min
                        </span>
                      </div>
                      <h3
                        className="text-sm sm:text-lg font-bold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors duration-300 line-clamp-2"
                        style={{ fontFamily: "'DM Serif Display', serif" }}
                      >
                        {post.title}
                      </h3>
                      <span className="text-primary font-semibold text-xs sm:text-sm flex items-center gap-1.5 group-hover:gap-3 transition-all duration-300">
                        Read More <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* View More */}
        <div className="mt-14 sm:mt-18 text-center">
          <Button asChild variant="outline" className="rounded-full px-8 h-12 border-border/30 hover:bg-primary hover:text-primary-foreground hover:border-primary font-bold text-sm transition-all duration-300 shadow-sm">
            <Link to="/blog">
              View All Articles <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default BlogSection;
