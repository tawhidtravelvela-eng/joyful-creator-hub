import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pt-44 md:pb-32">
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[image:var(--gradient-subtle)]" />

      <div className="container mx-auto px-6 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm text-xs text-muted-foreground mb-8 animate-fade-in">
          <Sparkles className="h-3 w-3 text-primary" />
          Introducing Lumen 2.0 — now with AI agents
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in-up">
          Your work,{" "}
          <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
            illuminated
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-100">
          The AI-powered workspace that thinks alongside you. Plan smarter, write faster,
          and ship work you're proud of — all in one beautifully simple place.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up animation-delay-200">
          <Button variant="hero" size="lg" className="group">
            Start free trial
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button variant="ghost" size="lg">
            Watch demo
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Free 14-day trial · No credit card required
        </p>
      </div>
    </section>
  );
}
