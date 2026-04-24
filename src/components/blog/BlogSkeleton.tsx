import { Skeleton } from "@/components/ui/skeleton";

const BlogSkeleton = () => (
  <div className="space-y-16" aria-label="Loading articles">
    <Skeleton className="w-full h-[420px] rounded-3xl" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="space-y-3">
          <Skeleton className="w-full aspect-[16/10] rounded-2xl" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  </div>
);

export default BlogSkeleton;
