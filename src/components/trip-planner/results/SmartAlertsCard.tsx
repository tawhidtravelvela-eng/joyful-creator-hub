import React from "react";
import { motion } from "framer-motion";
import { Zap, AlertTriangle, Lightbulb, ArrowUpCircle, Info } from "lucide-react";

interface TypedAlert {
  type: "critical" | "warning" | "improvement" | "suggestion";
  title: string;
  message: string;
  action?: string;
}

interface SmartAlertsCardProps {
  alerts?: string[] | TypedAlert[];
  delay?: number;
}

const ALERT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertTriangle, color: "var(--destructive)" },
  warning: { icon: Zap, color: "var(--warning)" },
  improvement: { icon: Lightbulb, color: "var(--primary)" },
  suggestion: { icon: ArrowUpCircle, color: "var(--success)" },
};

function isTypedAlert(a: unknown): a is TypedAlert {
  return typeof a === "object" && a !== null && "type" in a && "message" in a;
}

const SmartAlertsCard: React.FC<SmartAlertsCardProps> = ({ alerts, delay = 0.08 }) => {
  if (!alerts || alerts.length === 0) return null;

  const typedAlerts: TypedAlert[] = alerts.map(a =>
    isTypedAlert(a) ? a : { type: "suggestion" as const, title: "", message: String(a) }
  );

  // Sort: critical first
  const priorityOrder = { critical: 0, warning: 1, improvement: 2, suggestion: 3 };
  const sorted = [...typedAlerts].sort((a, b) => (priorityOrder[a.type] ?? 9) - (priorityOrder[b.type] ?? 9));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl p-3.5 space-y-2"
      style={{
        background: `linear-gradient(145deg, hsl(var(--warning) / 0.05) 0%, hsl(var(--p-card)) 100%)`,
        border: `1px solid hsl(var(--warning) / 0.15)`,
        boxShadow: `0 2px 12px hsl(var(--p-shadow))`,
      }}
    >
      {sorted.map((alert, i) => {
        const cfg = ALERT_CONFIG[alert.type] || ALERT_CONFIG.suggestion;
        const Icon = cfg.icon;
        return (
          <div key={i} className="flex items-start gap-2.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `hsl(${cfg.color} / 0.12)` }}
            >
              <Icon className="w-2.5 h-2.5" style={{ color: `hsl(${cfg.color})` }} />
            </div>
            <div className="flex-1 min-w-0">
              {alert.title && (
                <p className="text-[10px] font-bold leading-tight" style={{ color: `hsl(${cfg.color})` }}>
                  {alert.title}
                </p>
              )}
              <p className="text-[11px] leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>
                {alert.message}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};

export default React.memo(SmartAlertsCard);
