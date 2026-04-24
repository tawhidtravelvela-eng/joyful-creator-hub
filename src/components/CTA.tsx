import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div
          className="relative overflow-hidden rounded-3xl p-12 md:p-20 text-center border border-border/60"
          style={{
            background: "var(--gradient-hero)",
            boxShadow: "var(--shadow-elegant)",
          }}
        >
          <div className="absolute inset-0 bg-background/20" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground mb-4">
              Ready to light it up?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Join 50,000+ teams already shipping faster with Lumen.
            </p>
            <Button variant="secondary" size="lg" className="group">
              Get started for free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
