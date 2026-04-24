import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useBlockOverride } from "@/hooks/useBlockOverride";

/**
 * landing.blog-hybrid — editorial blog landing for the Hybrid skin.
 *
 * Pulls the tenant's published posts from `blog_posts` and renders them in
 * the Hybrid visual language (full-bleed hero, glass cards, primary-color
 * accents). All copy is overridable per-tenant via block content.
 */

interface BlogPostLite {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  author_name: string | null;
}

const HybridBlogLanding = () => {
  const { tenant } = useTenant();
  const ov = useBlockOverride();
  const c = ov?.content || {};

  const badge = (c.badge as string) || "Field notes";
  const headline =
    (c.headline as string) || "Stories, guides & travel inspiration.";
  const subtitle =
    (c.subtitle as string) ||
    "Hand-curated journeys, neighbourhood deep-dives, and practical tips written by travellers who've actually been there.";

  const [posts, setPosts] = useState<BlogPostLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, author_name")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(13);
      if (tenant?.id) query = query.eq("tenant_id", tenant.id);
      else query = query.is("tenant_id", null);
      const { data } = await query;
      if (!cancelled) {
        setPosts((data as BlogPostLite[]) || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <section className="relative bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative container mx-auto px-4 py-20 md:py-28 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-medium uppercase tracking-wider mb-5">
              <Sparkles className="w-3.5 h-3.5" /> {badge}
            </span>
            <h1
              className="text-4xl md:text-6xl font-bold text-foreground tracking-tight mb-5"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {headline}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card h-80 animate-pulse"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No stories published yet. Check back soon.
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <Link
                to={`/blog/${featured.slug}`}
                className="group block rounded-3xl overflow-hidden border border-border bg-card hover:shadow-xl transition-shadow mb-12"
              >
                <div className="grid md:grid-cols-2">
                  <div className="relative h-64 md:h-full bg-muted overflow-hidden">
                    {featured.featured_image ? (
                      <img
                        src={featured.featured_image}
                        alt={featured.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                    )}
                  </div>
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <span className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
                      Featured story
                    </span>
                    <h2
                      className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-muted-foreground mb-6 line-clamp-3">
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {featured.author_name && (
                        <span>{featured.author_name}</span>
                      )}
                      {featured.published_at && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(featured.published_at), "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-primary font-medium">
                        Read story <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-shadow flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                      {post.featured_image ? (
                        <img
                          src={post.featured_image}
                          alt={post.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-accent/15" />
                      )}
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3
                        className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                        {post.author_name && <span>{post.author_name}</span>}
                        {post.published_at && (
                          <span>
                            {format(new Date(post.published_at), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default HybridBlogLanding;