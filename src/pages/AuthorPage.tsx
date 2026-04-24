import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, Clock, BookOpen, MapPin, Sparkles, Globe } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import { Button } from "@/components/ui/button";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthorProfile {
  id: string;
  name: string;
  slug: string;
  bio: string;
  region: string;
  country: string | null;
  expertise: string[];
  avatar_url: string | null;
  social_links: Record<string, string>;
}

interface AuthorPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  created_at: string;
  content: string;
  category_id: string | null;
}

const estimateReadTime = (content: string) => {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

const AuthorPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { branding } = useSiteBranding();
  const { tenant } = useTenant();
  const siteName = branding.site_name || "Travel Vela";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const load = async () => {
      // Fetch author profile (scoped to tenant)
      let authorQuery = supabase
        .from("blog_author_profiles")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true);
      authorQuery = tenant ? authorQuery.eq("tenant_id", tenant.id) : authorQuery.is("tenant_id", null);
      const { data: authorData } = await authorQuery.maybeSingle();

      if (!authorData) {
        setLoading(false);
        return;
      }

      setAuthor({
        ...authorData,
        expertise: (authorData.expertise as string[]) || [],
        social_links: (authorData.social_links as Record<string, string>) || {},
      });

      // Fetch posts by this author (scoped to tenant)
      let postsQuery = supabase
        .from("blog_posts")
        .select("id,title,slug,excerpt,featured_image,published_at,created_at,content,category_id")
        .eq("status", "published")
        .eq("author_name", authorData.name)
        .order("published_at", { ascending: false });
      postsQuery = tenant ? postsQuery.eq("tenant_id", tenant.id) : postsQuery.is("tenant_id", null);
      const { data: postsData } = await postsQuery;

      if (postsData) setPosts(postsData as any);
      setLoading(false);
    };
    load();
  }, [slug, tenant]);

  // Set SEO meta
  useEffect(() => {
    if (!author) return;
    document.title = `${author.name} — Travel Writer | ${siteName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", `Read travel articles by ${author.name}. ${author.bio.slice(0, 120)}`);
    }
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/blog/author/${author.slug}`;

    return () => {
      document.title = `${siteName} - Book Flights at Best Prices`;
    };
  }, [author, siteName]);

  const fmtDate = (post: AuthorPost) =>
    format(new Date(post.published_at || post.created_at), "MMM d, yyyy");

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-20">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center gap-6">
                <Skeleton className="w-24 h-24 rounded-full" />
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-64 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!author) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-xl font-bold text-foreground mb-2">Author not found</h1>
            <p className="text-muted-foreground text-sm mb-6">This author profile doesn't exist.</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/blog">Back to Blog</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // JSON-LD for Person schema
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    url: `${siteUrl}/blog/author/${author.slug}`,
    description: author.bio,
    jobTitle: "Travel Writer",
    worksFor: { "@type": "Organization", name: siteName, url: siteUrl },
    knowsAbout: author.expertise,
    ...(author.country && { nationality: { "@type": "Country", name: author.country } }),
  };

  const totalWords = posts.reduce((sum, p) => sum + p.content.replace(/<[^>]*>/g, "").split(/\s+/).length, 0);

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,55%,12%)] via-[hsl(222,50%,8%)] to-[hsl(222,45%,5%)]" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-accent/[0.06] blur-[120px] animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/[0.03]" />
          </div>

          <div className="container mx-auto px-4 py-16 sm:py-24 relative z-10">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-8">
              <ol className="flex items-center gap-2 text-xs text-white/40">
                <li><Link to="/" className="hover:text-white/60 transition-colors">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link to="/blog" className="hover:text-white/60 transition-colors">Blog</Link></li>
                <li aria-hidden="true">/</li>
                <li className="text-white/70">{author.name}</li>
              </ol>
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center sm:items-start gap-8 max-w-3xl"
            >
              <div className="flex-shrink-0">
                <AuthorAvatar name={author.name} size="lg" className="!w-24 !h-24 !text-2xl ring-4 ring-white/10" />
              </div>
              <div className="text-center sm:text-left">
                <h1
                  className="text-2xl sm:text-4xl font-bold text-white mb-2 tracking-tight"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  {author.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                  <span className="inline-flex items-center gap-1.5 text-accent text-xs font-bold uppercase tracking-wider">
                    <BookOpen className="w-3 h-3" aria-hidden="true" /> Travel Writer
                  </span>
                  {author.country && (
                    <span className="inline-flex items-center gap-1 text-white/40 text-xs">
                      <MapPin className="w-3 h-3" aria-hidden="true" /> {author.country}
                    </span>
                  )}
                </div>
                <p className="text-white/50 text-sm leading-relaxed max-w-lg">{author.bio}</p>

                {/* Expertise tags */}
                {author.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-5 justify-center sm:justify-start">
                    {author.expertise.map(tag => (
                      <Badge
                        key={tag}
                        className="bg-white/[0.06] text-white/60 border border-white/[0.08] rounded-full px-3 py-1 text-[10px] font-semibold"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-6 mt-6 justify-center sm:justify-start">
                  <div className="text-center sm:text-left">
                    <p className="text-xl font-bold text-white">{posts.length}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Articles</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" aria-hidden="true" />
                  <div className="text-center sm:text-left">
                    <p className="text-xl font-bold text-white">{Math.round(totalWords / 1000)}k+</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Words Written</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
        </header>

        {/* Articles */}
        <section className="container mx-auto px-4 py-12 sm:py-16" aria-label={`Articles by ${author.name}`}>
          <div className="flex items-center gap-3 mb-8">
            <Globe className="w-4 h-4 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Published Articles
            </h2>
            <div className="flex-1 h-px bg-border/40" aria-hidden="true" />
            <span className="text-xs text-muted-foreground/50 font-semibold">{posts.length} articles</span>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" aria-hidden="true" />
              <p className="text-muted-foreground text-sm">No published articles yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
              {posts.map((post, i) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/blog/${post.slug}`} className="group block h-full">
                    <div className="bg-card border border-border/25 rounded-2xl sm:rounded-3xl overflow-hidden h-full flex flex-col hover:border-accent/15 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500">
                      {post.featured_image ? (
                        <div className="aspect-[16/10] overflow-hidden relative">
                          <img
                            src={post.featured_image}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[900ms] ease-out"
                            loading="lazy"
                            decoding="async"
                            width={640}
                            height={400}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-foreground/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </div>
                      ) : (
                        <div className="aspect-[16/10] bg-gradient-to-br from-primary/8 to-accent/6 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-muted-foreground/15" aria-hidden="true" />
                        </div>
                      )}
                      <div className="p-5 sm:p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] text-muted-foreground/45 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {estimateReadTime(post.content)} min read
                          </span>
                          <span className="text-muted-foreground/20" aria-hidden="true">·</span>
                          <time dateTime={post.published_at || post.created_at} className="text-[10px] text-muted-foreground/45 font-medium">
                            {fmtDate(post)}
                          </time>
                        </div>
                        <h3
                          className="text-[15px] sm:text-base font-bold text-foreground leading-snug line-clamp-2 mb-2.5 group-hover:text-accent transition-colors duration-300"
                          style={{ fontFamily: "'DM Serif Display', serif" }}
                        >
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-[13px] text-muted-foreground/65 line-clamp-2 mb-5 flex-1 leading-relaxed">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-end pt-4 border-t border-border/25 mt-auto">
                          <span className="inline-flex items-center gap-1.5 text-accent font-bold text-xs group-hover:gap-3 transition-all duration-300">
                            Read Article <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-16 text-center">
            <Button asChild className="h-12 px-8 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-lg shadow-accent/20">
              <Link to="/trip-planner">
                Plan Your Trip with AI <Sparkles className="w-4 h-4 ml-1" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default AuthorPage;
