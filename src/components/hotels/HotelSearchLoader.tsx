import { motion } from "framer-motion";
import { Building2, MapPin, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const defaultSteps = [
  "Searching hotels across providers…",
  "Checking room availability…",
  "Fetching live prices & deals…",
  "Comparing rates & amenities…",
  "Curating the best options for you…",
];

interface HotelSearchLoaderProps {
  title?: string;
  subtitle?: string;
  steps?: string[];
}

export default function HotelSearchLoader({
  title = "Searching Hotels",
  subtitle = "Please wait while we find the best rates across multiple providers.",
  steps: customSteps,
}: HotelSearchLoaderProps) {
  const steps = customSteps || defaultSteps;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((i) => (i < steps.length - 1 ? i + 1 : i));
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="bg-card rounded-2xl shadow-2xl border border-border/80 max-w-sm w-full mx-4 overflow-hidden"
      >
        <div className="h-1 bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "90%" }}
            transition={{ duration: 14, ease: "easeOut" }}
          />
        </div>

        <div className="p-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-primary/5" />
            <motion.div
              className="absolute inset-1 rounded-full border-[3px] border-primary/30 border-t-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <Building2 className="w-8 h-8 text-primary" />
                <motion.div
                  className="absolute -top-1 -right-1"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </motion.div>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

          <div className="space-y-2">
            {steps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= stepIndex ? 1 : 0.3, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className="flex items-center gap-2.5 text-left"
              >
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300",
                  i < stepIndex ? "bg-success/50/15" : i === stepIndex ? "bg-primary/15" : "bg-muted"
                )}>
                  {i < stepIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success0" />
                  ) : i === stepIndex ? (
                    <motion.div
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span className={cn(
                  "text-xs transition-colors duration-300",
                  i < stepIndex ? "text-success font-medium" : i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground/50"
                )}>
                  {step}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
