import { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * HybridPageHeader — editorial title band used at the top of Hybrid result
 * & detail pages. Replaces the platform's photo hero on those pages.
 */
const HybridPageHeader = ({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  children?: ReactNode;
}) => {
  return (
    <section className="relative pt-8 lg:pt-14 pb-6 lg:pb-10 border-b border-border/50">
      <div className="container mx-auto px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
              <span className="w-6 h-px bg-primary/60" />
              {eyebrow}
            </div>
          )}
          <h1
            className="text-3xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.05]"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 lg:mt-4 text-sm lg:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </motion.div>
        {children && <div className="mt-6 lg:mt-8">{children}</div>}
      </div>
    </section>
  );
};

export default HybridPageHeader;