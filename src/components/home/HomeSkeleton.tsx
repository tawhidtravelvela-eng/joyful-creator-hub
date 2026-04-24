import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for offer cards row */
export const OffersSkeleton = () => (
  <section className="py-12 sm:py-20 bg-muted/20">
    <div className="container mx-auto px-4">
      <div className="mb-8 sm:mb-10">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden">
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

/** Skeleton for trending flights grid */
export const TrendingFlightsSkeleton = () => (
  <section className="py-10 sm:py-20 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="mb-6 sm:mb-10">
        <Skeleton className="h-3 w-28 mb-2" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/** Skeleton for destinations bento grid */
export const DestinationsSkeleton = () => (
  <section className="py-12 sm:py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="mb-8 sm:mb-12">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3 sm:gap-4 auto-rows-[200px] sm:auto-rows-[240px] lg:auto-rows-[210px]">
        <Skeleton className="col-span-2 md:col-span-2 lg:col-span-7 row-span-2 rounded-3xl" />
        <Skeleton className="col-span-1 md:col-span-1 lg:col-span-5 row-span-2 rounded-3xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="col-span-1 lg:col-span-4 rounded-3xl" />
        ))}
      </div>
    </div>
  </section>
);

/** Skeleton for blog section */
export const BlogSkeleton = () => (
  <section className="py-16 sm:py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12 sm:mb-16">
        <Skeleton className="h-3 w-24 mx-auto mb-3" />
        <Skeleton className="h-9 w-48 mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <div className="p-5">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
