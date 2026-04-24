import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/40">
      <nav className="container mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 font-semibold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)]">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          Lumen
        </a>
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </div>
        <Button variant="hero" size="sm">Get started</Button>
      </nav>
    </header>
  );
}
