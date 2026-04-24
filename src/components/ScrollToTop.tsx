import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    // Always scroll to top on route change (except back/forward)
    if (navType !== "POP") {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    }
  }, [pathname, navType]);

  return null;
};
