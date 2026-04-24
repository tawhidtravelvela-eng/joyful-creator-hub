import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Clock, MapPin, Heart, Users, Compass, Sun,
  Mountain, Palmtree, Star, ChevronRight, Calendar, DollarSign,
  Zap, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ──
export interface ExperienceCluster {
  name: string;
  priority: "essential" | "recommended" | "optional";
  typical_duration: string;
  indoor_outdoor: "indoor" | "outdoor" | "both";
}

export interface TripFrame {
  label: string;
  duration: string;
  pacing: string;
  ideal_for: string;
  rough_budget_range: string;
  sample_flow: string[];
}

export interface SoftDay {
  day: number;
  flow: string;
}

export interface InspirationData {
  mode: "inspiration";
  archetype: string;
  destination: string;
  trip_type: string;
  traveler_type: string;
  experience_clusters: ExperienceCluster[];
  trip_frames: TripFrame[];
  preview_itinerary: SoftDay[];
  clarification_prompts: string[];
  ai_summary: string;
}

interface InspirationViewProps {
  data: InspirationData;
  onSelectFrame: (frame: TripFrame) => void;
  onSendMessage: (text: string) => void;
}

const clusterIcon: Record<string, typeof Sparkles> = {
  romantic: Heart,
  adventure: Mountain,
  beach: Sun,
  cultural: Compass,
  nature: Palmtree,
  family: Users,
  food: Star,
};

function getClusterIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(clusterIcon)) {
    if (lower.includes(key)) return Icon;
  }
  return Sparkles;
}

const priorityColor: Record<string, string> = {
  essential: "bg-primary/15 text-primary border-primary/30",
  recommended: "bg-accent/15 text-accent-foreground border-accent/30",
  optional: "bg-muted text-muted-foreground border-border",
};

// Price ranges come directly from AI in user's currency — no conversion needed

export default function InspirationView({ data, onSelectFrame, onSendMessage }: InspirationViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5 pb-6"
    >
      {/* Hero */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">
              {data.archetype.charAt(0).toUpperCase() + data.archetype.slice(1)} in {data.destination}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {data.ai_summary}
            </p>
          </div>
        </div>
      </div>

      {/* Experience Clusters */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          ✨ Recommended Experiences
        </h4>
        <div className="flex flex-wrap gap-2">
          {data.experience_clusters.map((cluster, i) => {
            const Icon = getClusterIcon(cluster.name);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${priorityColor[cluster.priority] || priorityColor.optional}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cluster.name}</span>
                {cluster.typical_duration && (
                  <span className="text-[10px] opacity-60 ml-0.5">· {cluster.typical_duration}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Trip Frames */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          🗓️ Trip Options
        </h4>
        <div className="space-y-2">
          {data.trip_frames.map((frame, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              onClick={() => onSelectFrame(frame)}
              className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all p-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{frame.label}</p>
                    <p className="text-[11px] text-muted-foreground">{frame.duration} · {frame.pacing}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  <Users className="w-3 h-3 mr-1" />
                  {frame.ideal_for}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {frame.rough_budget_range}
                </Badge>
              </div>
              {frame.sample_flow.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {frame.sample_flow.slice(0, 4).map((step, j) => (
                    <span key={j} className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                      {step}
                    </span>
                  ))}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Soft Itinerary Preview */}
      {data.preview_itinerary.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            📋 Sample Day Flow
          </h4>
          <div className="rounded-xl border border-border bg-card/50 divide-y divide-border">
            {data.preview_itinerary.map((day) => (
              <div key={day.day} className="flex items-start gap-3 px-3 py-2.5">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{day.day}</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{day.flow}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Clarification */}
      {data.clarification_prompts.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-foreground mb-2">
            To show exact prices and availability:
          </p>
          <div className="space-y-1.5">
            {data.clarification_prompts.map((prompt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{prompt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onSendMessage("You pick the best option for me")}
        >
          <Zap className="w-3.5 h-3.5 mr-1" />
          You pick for me
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onSendMessage("Show me a budget version")}
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" />
          Budget option
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onSendMessage("Show me a luxury version")}
        >
          <Star className="w-3.5 h-3.5 mr-1" />
          Luxury option
        </Button>
      </div>
    </motion.div>
  );
}
