import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbProps {
  categoryName?: string;
  categoryId?: string | null;
  postTitle?: string;
  siteName: string;
  siteUrl: string;
}

const BlogBreadcrumb = ({ categoryName, categoryId, postTitle, siteName, siteUrl }: BreadcrumbProps) => {
  const items = [
    { name: "Home", url: `${siteUrl}/` },
    { name: "Blog", url: `${siteUrl}/blog` },
  ];
  if (categoryName && categoryId) {
    items.push({ name: categoryName, url: `${siteUrl}/blog?cat=${categoryId}` });
  }
  if (postTitle) {
    items.push({ name: postTitle, url: "" });
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 flex-wrap mb-5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
              {isLast ? (
                <span className="text-[11px] font-semibold text-muted-foreground/50 truncate max-w-[200px] sm:max-w-xs">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.url.replace(siteUrl, "")}
                  className="text-[11px] font-semibold text-muted-foreground/60 hover:text-accent transition-colors flex items-center gap-1"
                >
                  {i === 0 && <Home className="w-3 h-3" />}
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
};

export default BlogBreadcrumb;
