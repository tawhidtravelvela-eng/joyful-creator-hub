import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  fallback?: string;
  eager?: boolean;
  /** Show dots indicator */
  showDots?: boolean;
  /** Max dots to show */
  maxDots?: number;
}

const ImageCarousel = ({
  images,
  alt,
  className,
  fallback = "/placeholder.svg",
  eager = false,
  showDots = true,
  maxDots = 5,
}: ImageCarouselProps) => {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const validImages = images.length > 0 ? images : [fallback];
  const hasMultiple = validImages.length > 1;

  const prev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i - 1 + validImages.length) % validImages.length);
  }, [validImages.length]);

  const next = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + 1) % validImages.length);
  }, [validImages.length]);

  return (
    <div className={cn("relative overflow-hidden group", className)}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div className="absolute inset-0 z-[1] bg-muted animate-pulse" />
      )}
      <img
        src={validImages[index]}
        alt={`${alt} ${index + 1}`}
        className="w-full h-full object-cover transition-opacity duration-200"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallback;
          setLoaded(true);
        }}
      />

      {hasMultiple && (
        <>
          {/* Navigation arrows - visible on hover */}
          <button
            onClick={prev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots */}
          {showDots && validImages.length <= maxDots && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {validImages.slice(0, maxDots).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    i === index ? "bg-white w-3" : "bg-white/50"
                  )}
                />
              ))}
            </div>
          )}

          {/* Counter for many images */}
          {validImages.length > maxDots && (
            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded z-10">
              {index + 1}/{validImages.length}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
