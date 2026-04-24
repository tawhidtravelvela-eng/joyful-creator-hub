import { estimateReadTime } from "./blogTypes";
import type { BlogPost } from "./blogTypes";

const BlogJsonLd = ({ posts, siteName, siteUrl }: { posts: BlogPost[]; siteName: string; siteUrl: string }) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${siteName} Travel Blog`,
    description: "Expert travel tips, destination guides, and insider knowledge to help you travel smarter.",
    url: `${siteUrl}/blog`,
    publisher: { "@type": "Organization", name: siteName, url: siteUrl },
    blogPost: posts.slice(0, 10).map(p => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.excerpt || "",
      url: `${siteUrl}/blog/${p.slug}`,
      image: p.featured_image || undefined,
      datePublished: p.published_at || p.created_at,
      author: { "@type": "Person", name: p.author_name || siteName },
      publisher: { "@type": "Organization", name: siteName },
      wordCount: p.word_count || 0,
      timeRequired: `PT${estimateReadTime(p.word_count || 0)}M`,
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
};

export default BlogJsonLd;
