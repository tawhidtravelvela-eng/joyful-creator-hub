import { useEffect, useRef, useState } from "react";

/**
 * Airbnb/Skyscanner-style sticky sidebar that scrolls with the page when the
 * content is taller than the viewport, and pins to top/bottom intelligently
 * based on scroll direction. When content fits, it just pins to top.
 *
 * Returns:
 *  - ref: attach to the sticky element
 *  - style: inline style with computed `top`
 *  - isTopHidden: true when sidebar top is scrolled above viewport (show "back to top of sidebar" UI)
 *  - scrollToTop: scrolls window to bring the sidebar's top into view
 */
export function useScrollFollowSticky(topOffset = 96) {
  const ref = useRef<HTMLElement | null>(null) as React.MutableRefObject<any>;
  const wrapperOffsetRef = useRef<number>(0);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "sticky",
    top: topOffset,
  });
  const [isTopHidden, setIsTopHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let lastScrollY = window.scrollY;
    let elTop = topOffset;
    let raf = 0;

    const compute = () => {
      raf = 0;
      const node = ref.current;
      if (!node) return;

      const elHeight = node.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollY;
      lastScrollY = scrollY;

      // Track the sidebar's absolute document offset (for scroll-to-top action)
      const rect = node.getBoundingClientRect();
      wrapperOffsetRef.current = scrollY + rect.top;

      // If sidebar fits in viewport → simple top pin
      if (elHeight + topOffset + 16 <= viewportHeight) {
        setStyle({ position: "sticky", top: topOffset });
        setIsTopHidden(false);
        return;
      }

      // Sidebar taller than viewport — follow scroll direction
      const minTop = viewportHeight - elHeight - 16; // pin bottom edge
      const maxTop = topOffset;

      elTop -= delta;
      if (elTop > maxTop) elTop = maxTop;
      if (elTop < minTop) elTop = minTop;

      setStyle({ position: "sticky", top: `${elTop}px` });
      // Show "back to top" affordance when the sidebar top is scrolled out of view
      setIsTopHidden(elTop < topOffset - 4);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [topOffset]);

  const scrollToTop = () => {
    // Bring the sidebar's top edge to the topOffset position in the viewport
    const target = Math.max(0, wrapperOffsetRef.current - topOffset);
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  return { ref, style, isTopHidden, scrollToTop };
}
