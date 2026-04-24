import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertBlogPrices } from "@/utils/blogPriceConverter";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Calendar, Clock, BookOpen, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import ReadingProgressBar from "@/components/blog/ReadingProgressBar";
import TableOfContents from "@/components/blog/TableOfContents";
import BlogBreadcrumb from "@/components/blog/BlogBreadcrumb";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";
import SocialShareButtons from "@/components/blog/SocialShareButtons";

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  tags: string[];
  author_name: string;
  published_at: string | null;
  created_at: string;
  category_id: string | null;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  featured_image: string | null;
  published_at: string | null;
  created_at: string;
  excerpt: string | null;
}

const estimateReadTime = (content: string) => {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

/* ─── JSON-LD for BlogPosting ─── */
const BlogPostJsonLd = ({ post, categoryName, siteName, siteUrl }: {
  post: BlogPostData;
  categoryName: string;
  siteName: string;
  siteUrl: string;
}) => {
  const wordCount = post.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    url: `${siteUrl}/blog/${post.slug}`,
    image: post.featured_image || undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.published_at || post.created_at,
    author: {
      "@type": "Person",
      name: post.author_name || siteName,
      url: `${siteUrl}/blog/author/${(post.author_name || "").toLowerCase().replace(/\s+/g, "-")}`,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/${post.slug}`,
    },
    articleSection: categoryName || "Travel",
    wordCount,
    timeRequired: `PT${estimateReadTime(post.content)}M`,
    keywords: (post.tags || []).join(", "),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { currency, liveRates } = useCurrency();
  const { branding } = useSiteBranding();
  const { tenant } = useTenant();

  const siteName = branding.site_name || "Travel Vela";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const convertedContent = useMemo(
    () => post ? convertBlogPrices(post.content, currency, liveRates) : "",
    [post?.content, currency, liveRates]
  );

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from("blog_posts")
        .select("id,title,slug,excerpt,content,featured_image,tags,author_name,published_at,created_at,category_id,tenant_id")
        .eq("slug", slug)
        .eq("status", "published");
      // Strict tenant isolation: tenant sites only show their own posts
      query = tenant ? query.eq("tenant_id", tenant.id) : query.is("tenant_id", null);
      const { data } = await query.maybeSingle();

      if (data) {
        setPost(data as any);
        if (data.category_id) {
          let relatedQuery = supabase
            .from("blog_posts")
            .select("id,title,slug,featured_image,published_at,created_at,excerpt")
            .eq("status", "published")
            .eq("category_id", data.category_id)
            .neq("id", data.id)
            .order("published_at", { ascending: false })
            .limit(3);
          relatedQuery = tenant ? relatedQuery.eq("tenant_id", tenant.id) : relatedQuery.is("tenant_id", null);
          const [catRes, relatedRes] = await Promise.all([
            supabase.from("blog_categories").select("name").eq("id", data.category_id).maybeSingle(),
            relatedQuery,
          ]);
          if (catRes.data) setCategoryName(catRes.data.name);
          if (relatedRes.data) setRelated(relatedRes.data as any);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug, tenant]);

  /* ── OG Meta Tags ── */
  useEffect(() => {
    if (!post) return;

    document.title = `${post.title} — ${siteName}`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ||
               document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(property.startsWith("og:") || property.startsWith("twitter:") || property.startsWith("article:") ? "property" : "name", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const desc = post.excerpt || post.title;
    setMeta("description", desc);
    setMeta("og:type", "article");
    setMeta("og:title", post.title);
    setMeta("og:description", desc);
    setMeta("og:url", `${siteUrl}/blog/${post.slug}`);
    setMeta("article:published_time", post.published_at || post.created_at);
    setMeta("article:author", post.author_name || siteName);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", post.title);
    setMeta("twitter:description", desc);

    if (post.featured_image) {
      setMeta("og:image", post.featured_image);
      setMeta("twitter:image", post.featured_image);
    }

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${siteUrl}/blog/${post.slug}`;

    return () => { document.title = `${siteName} - Book Flights at Best Prices`; };
  }, [post, siteName, siteUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground/40" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center">
          <BookOpen className="w-14 h-14 text-muted-foreground/15 mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>Article not found</h1>
          <p className="text-muted-foreground/60 text-sm mb-6">This article may have been moved or removed.</p>
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const readTime = estimateReadTime(post.content);
  const publishDate = format(new Date(post.published_at || post.created_at), "MMMM d, yyyy");

  return (
    <Layout>
      {/* Reading Progress Bar */}
      <ReadingProgressBar />

      {/* JSON-LD */}
      <BlogPostJsonLd post={post} categoryName={categoryName} siteName={siteName} siteUrl={siteUrl} />

      <article className="min-h-screen bg-background">
        {/* ── Immersive Hero ── */}
        <div className="relative">
          {post.featured_image ? (
            <div className="relative w-full h-[320px] sm:h-[420px] lg:h-[520px] overflow-hidden">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
                width={1200}
                height={630}
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/30 to-transparent" />
            </div>
          ) : (
            <div className="h-24 sm:h-32 bg-gradient-to-b from-muted/30 to-background" />
          )}
        </div>

        <div className="container mx-auto px-4 max-w-[720px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={post.featured_image ? "-mt-28 sm:-mt-36 relative z-10" : "pt-8"}
          >
            <BlogBreadcrumb
              categoryName={categoryName}
              categoryId={post.category_id}
              postTitle={post.title}
              siteName={siteName}
              siteUrl={siteUrl}
            />

            <div className="flex items-center gap-3 flex-wrap mb-5">
            {categoryName && (
                <Link to={`/blog?cat=${post.category_id}`}>
                  <Badge className="bg-accent/10 text-accent hover:bg-accent/15 border-0 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer">
                    {categoryName}
                  </Badge>
                </Link>
              )}
              <span className="text-[11px] text-muted-foreground/45 font-semibold flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {readTime} min read
              </span>
            </div>

            <h1
              className="text-[1.75rem] sm:text-4xl md:text-[2.75rem] lg:text-5xl font-bold text-foreground leading-[1.1] mb-7 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-muted-foreground text-base sm:text-lg leading-[1.75] mb-8 font-medium border-l-[3px] border-accent/30 pl-5">
                {post.excerpt}
              </p>
            )}

            <div className="flex items-center justify-between pb-8 mb-10 border-b border-border/30">
              <div className="flex items-center gap-3.5">
                {post.author_name && (
                  <>
                    <AuthorAvatar name={post.author_name} size="lg" />
                    <div>
                      <Link to={`/blog/author/${post.author_name.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm font-bold text-foreground hover:text-accent transition-colors">
                        {post.author_name}
                      </Link>
                      <p className="text-xs text-muted-foreground/50 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3 h-3" />
                        {publishDate}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <SocialShareButtons
                title={post.title}
                url={window.location.href}
                copied={copied}
                onCopy={handleCopy}
              />
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-10">
                {post.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/blog?q=${encodeURIComponent(t)}`}
                  >
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px] px-3.5 py-1.5 border-border/30 text-muted-foreground/50 font-semibold hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
                    >
                      #{t}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Table of Contents */}
            <TableOfContents content={convertedContent} />

            <div
              className="prose prose-lg max-w-none text-foreground
                prose-headings:text-foreground prose-headings:tracking-tight
                prose-h2:text-[1.35rem] prose-h2:sm:text-2xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:font-bold
                prose-h3:text-lg prose-h3:sm:text-xl prose-h3:mt-9 prose-h3:mb-4
                prose-p:leading-[1.8] prose-p:text-muted-foreground prose-p:text-[15px] prose-p:sm:text-base
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-semibold
                prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-8
                prose-strong:text-foreground prose-strong:font-bold
                prose-li:text-muted-foreground prose-li:text-[15px] prose-li:sm:text-base
                prose-blockquote:border-l-[3px] prose-blockquote:border-accent/40 prose-blockquote:bg-accent/[0.03] prose-blockquote:rounded-r-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:text-foreground/80 prose-blockquote:not-italic prose-blockquote:font-medium
                prose-code:text-primary prose-code:bg-primary/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-semibold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(convertedContent, {
                  ADD_TAGS: ["iframe", "span"],
                  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "title"],
                }),
              }}
            />

            <div className="mt-14 mb-8 p-6 sm:p-8 rounded-2xl bg-muted/30 border border-border/25 text-center">
              <p className="text-sm font-bold text-foreground mb-1">Enjoyed this article?</p>
              <p className="text-xs text-muted-foreground/60 mb-4">Share it with fellow travelers</p>
              <SocialShareButtons
                title={post.title}
                url={window.location.href}
                copied={copied}
                onCopy={handleCopy}
                layout="bar"
              />
            </div>

            {related.length > 0 && (
              <div className="mt-14 pt-12 border-t border-border/30">
                <div className="flex items-center gap-3 mb-8">
                  <h3
                    className="text-xl sm:text-2xl font-bold text-foreground"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    More in {categoryName}
                  </h3>
                  <div className="flex-1 h-px bg-border/30" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      to={`/blog/${r.slug}`}
                      className="group block rounded-2xl overflow-hidden border border-border/25 bg-card hover:border-primary/15 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-400"
                    >
                      {r.featured_image && (
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={r.featured_image}
                            alt={r.title}
                            loading="lazy"
                            decoding="async"
                            width={640}
                            height={400}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                      )}
                      <div className="p-4 sm:p-5">
                        <h4
                          className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-snug mb-2"
                          style={{ fontFamily: "'DM Serif Display', serif" }}
                        >
                          {r.title}
                        </h4>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/45 font-medium">
                            {format(new Date(r.published_at || r.created_at), "MMM d, yyyy")}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-14 mb-20 text-center">
              <Button asChild variant="outline" className="rounded-full px-8 h-12 border-border/40 hover:bg-primary hover:text-primary-foreground hover:border-primary font-bold text-sm transition-all duration-300">
                <Link to="/blog">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  All Articles
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </article>
    </Layout>
  );
};

export default BlogPost;
