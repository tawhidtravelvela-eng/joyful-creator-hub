import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lumen — Your work, illuminated" },
      { name: "description", content: "The AI-powered workspace that thinks alongside you. Plan smarter, write faster, and ship work you're proud of." },
      { property: "og:title", content: "Lumen — Your work, illuminated" },
      { property: "og:description", content: "The AI-powered workspace that thinks alongside you." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
