import { Bot, Zap, Layers, Lock, BarChart3, Workflow } from "lucide-react";

const features = [
  { icon: Bot, title: "AI Agents", desc: "Delegate tasks to autonomous agents that learn your workflow." },
  { icon: Zap, title: "Lightning fast", desc: "Built on the edge. Every interaction feels instant." },
  { icon: Layers, title: "Unified workspace", desc: "Docs, tasks, and chat in one beautifully designed canvas." },
  { icon: Workflow, title: "Smart automations", desc: "Build flows in plain English. Automate the boring stuff." },
  { icon: BarChart3, title: "Insights", desc: "Real-time analytics that turn data into decisions." },
  { icon: Lock, title: "Enterprise-grade", desc: "SOC 2 compliant with end-to-end encryption by default." },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything you need.{" "}
            <span className="text-muted-foreground">Nothing you don't.</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A thoughtfully crafted toolkit for modern teams who care about the details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative p-8 rounded-2xl bg-[image:var(--gradient-card)] border border-border/60 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
