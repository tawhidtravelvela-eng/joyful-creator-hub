import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Itinerary } from "./tripTypes";
import { saveCachedItinerary } from "./tripCacheHelpers";
import { trackItineraryChange, type ActionType, type ChangeSource } from "@/utils/itineraryChangeTracker";

/**
 * Hook encapsulating all day-editing helpers for the trip planner itinerary.
 */
export function useTripDayEditor(
  structuredItinerary: Itinerary | null,
  setStructuredItinerary: React.Dispatch<React.SetStateAction<Itinerary | null>>,
  savedTripId?: string | null,
  userId?: string | null,
) {
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null);
  const [moveToDayTarget, setMoveToDayTarget] = useState<{ dayIdx: number; actIdx: number } | null>(null);
  const [daySuggestionText, setDaySuggestionText] = useState("");
  const [daySuggestionLoading, setDaySuggestionLoading] = useState(false);

  // ── Auto time recalculation helper ──
  const recalculateTimes = useCallback((activities: any[]): any[] => {
    if (activities.length === 0) return activities;
    const sorted = [...activities].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const firstTime = sorted[0]?.time || "09:00";
    const [startH, startM] = firstTime.split(":").map(Number);
    let currentMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);

    return sorted.map((act) => {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      const newTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const cat = (act.category || "").toLowerCase();
      const name = (act.activity || "").toLowerCase();
      let durationMin = 90;
      if (/theme\s*park|universal|disney|water\s*park|legoland/i.test(name)) durationMin = 360;
      else if (cat === "food" || cat === "dining" || /breakfast|lunch|dinner|meal/i.test(name)) durationMin = 60;
      else if (cat === "transport" || cat === "transfer" || /airport|taxi|bus|train|check.?in|check.?out/i.test(name)) durationMin = 45;
      else if (/museum|gallery|temple|shrine|palace/i.test(name)) durationMin = 120;
      else if (/walk|stroll|explore/i.test(name)) durationMin = 75;
      currentMinutes += durationMin;
      return { ...act, time: newTime };
    });
  }, []);

  // Fire-and-forget change tracking
  const logChange = useCallback((actionType: ActionType, source: ChangeSource, before: any, after: any, summary?: string) => {
    if (!savedTripId) return;
    trackItineraryChange({
      tripId: savedTripId,
      actionType,
      source,
      actorId: userId || null,
      beforeState: before,
      afterState: after,
      changeSummary: summary,
    });
  }, [savedTripId, userId]);

  const updateItineraryDay = useCallback((dayIdx: number, updater: (day: Itinerary["days"][0]) => Itinerary["days"][0], actionType: ActionType = "update", source: ChangeSource = "user", summary?: string) => {
    setStructuredItinerary(prev => {
      if (!prev) return prev;
      const newDays = prev.days.map((d, i) => i === dayIdx ? updater({ ...d }) : d);
      const updated = { ...prev, days: newDays };
      saveCachedItinerary(updated);
      logChange(actionType, source, { days: [prev.days[dayIdx]] }, { days: [updated.days[dayIdx]] }, summary || `Day ${dayIdx + 1} ${actionType}`);
      return updated;
    });
  }, [setStructuredItinerary, logChange]);

  const removeActivity = useCallback((dayIdx: number, actIdx: number) => {
    updateItineraryDay(dayIdx, day => {
      const filtered = day.activities.filter((_, i) => i !== actIdx);
      return { ...day, activities: recalculateTimes(filtered) };
    }, "delete", "user", `Removed activity ${actIdx} from day ${dayIdx + 1}`);
  }, [updateItineraryDay, recalculateTimes]);

  const moveActivity = useCallback((dayIdx: number, actIdx: number, direction: "up" | "down") => {
    updateItineraryDay(dayIdx, day => {
      const acts = [...day.activities];
      const targetIdx = direction === "up" ? actIdx - 1 : actIdx + 1;
      if (targetIdx < 0 || targetIdx >= acts.length) return day;
      [acts[actIdx], acts[targetIdx]] = [acts[targetIdx], acts[actIdx]];
      return { ...day, activities: recalculateTimes(acts) };
    }, "reorder", "user", `Moved activity ${direction} in day ${dayIdx + 1}`);
  }, [updateItineraryDay, recalculateTimes]);

  const moveActivityToDay = useCallback((fromDayIdx: number, actIdx: number, toDayIdx: number) => {
    setStructuredItinerary(prev => {
      if (!prev) return prev;
      const fromDay = prev.days[fromDayIdx];
      const toDay = prev.days[toDayIdx];
      if (!fromDay || !toDay) return prev;
      const activity = fromDay.activities[actIdx];
      if (!activity) return prev;
      const newFromActivities = fromDay.activities.filter((_, i) => i !== actIdx);
      const newToActivities = [...toDay.activities, { ...activity, time: "" }];
      const newDays = prev.days.map((d, i) => {
        if (i === fromDayIdx) return { ...d, activities: recalculateTimes(newFromActivities) };
        if (i === toDayIdx) return { ...d, activities: recalculateTimes(newToActivities) };
        return d;
      });
      const updated = { ...prev, days: newDays };
      saveCachedItinerary(updated);
      logChange("reorder", "user", { days: [prev.days[fromDayIdx], prev.days[toDayIdx]] }, { days: [updated.days[fromDayIdx], updated.days[toDayIdx]] }, `Moved activity from day ${fromDayIdx + 1} to day ${toDayIdx + 1}`);
      return updated;
    });
    toast({ title: `Activity moved to Day ${toDayIdx + 1}` });
  }, [recalculateTimes, setStructuredItinerary]);

  const improveDayWithAI = useCallback(async (dayIdx: number, suggestion: string) => {
    if (!suggestion.trim() || !structuredItinerary) return;
    setDaySuggestionLoading(true);
    try {
      const day = structuredItinerary.days[dayIdx];
      if (!day) { setDaySuggestionLoading(false); return; }

      const { data, error } = await supabase.functions.invoke("ai-trip-planner", {
        body: {
          messages: [
            {
              role: "user",
              content: `I have a ${structuredItinerary.destination} trip. Day ${dayIdx + 1} "${day.title}" currently has these activities:\n${day.activities.map(a => `- ${a.time} ${a.activity}`).join('\n')}\n\nMy suggestion: "${suggestion}"\n\nPlease provide an improved list of activities for this day as JSON: { "activities": [{ "time": "HH:MM", "activity": "...", "description": "...", "cost_estimate": number, "category": "activity|food|transport" }] }. Keep the day reasonable and well-paced.`,
            },
          ],
          hasItinerary: true,
          currency: "USD",
        },
      });

      if (error) throw error;

      let newActivities: any[] | null = null;
      const responseText = data?.reply || data?.response || (typeof data === "string" ? data : "");
      const jsonMatch = responseText.match(/\{[\s\S]*"activities"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.activities) && parsed.activities.length > 0) {
            newActivities = parsed.activities;
          }
        } catch {}
      }

      if (newActivities && newActivities.length > 0) {
        updateItineraryDay(dayIdx, d => {
          const preserved = d.activities.filter(a =>
            a.category === "flight" || a.category === "hotel" || a.category === "transport"
          );
          const improved = newActivities!.map(a => ({
            time: a.time || "10:00",
            activity: a.activity || a.name || "",
            description: a.description || "",
            cost_estimate: Number(a.cost_estimate || 0),
            category: (a.category || "activity") as any,
            source: "ai-suggestion",
          }));
          return { ...d, activities: [...preserved, ...improved].sort((a, b) => (a.time || "").localeCompare(b.time || "")) };
        }, "update", "ai", `AI improved day ${dayIdx + 1}: ${suggestion.substring(0, 60)}`);
        toast({ title: "Day improved!", description: "AI optimized your day based on your suggestion." });
      } else {
        updateItineraryDay(dayIdx, d => {
          const newAct = {
            time: "", activity: suggestion.trim(), description: "Added from your suggestion",
            cost_estimate: 0, category: "activity" as const, source: "ai-suggestion",
          };
          return { ...d, activities: recalculateTimes([...d.activities, newAct]) };
        }, "inject_activity", "ai", `AI added activity: ${suggestion.substring(0, 60)}`);
        toast({ title: "Activity added from suggestion" });
      }
    } catch (err) {
      console.error("[DayImprove] AI failed:", err);
      toast({ title: "Couldn't improve day", description: "Try again or rephrase your suggestion.", variant: "destructive" });
    } finally {
      setDaySuggestionLoading(false);
      setDaySuggestionText("");
    }
  }, [structuredItinerary, updateItineraryDay, recalculateTimes]);

  const addDayToItinerary = useCallback(() => {
    setStructuredItinerary(prev => {
      if (!prev) return prev;
      const newDay = {
        day: prev.days.length + 1,
        title: `Day ${prev.days.length + 1}`,
        activities: [
          { time: "09:00", activity: "Free time — add activities", description: "", cost_estimate: 0, category: "activity" as const },
        ],
        hotel: prev.days[prev.days.length - 1]?.hotel || { name: "", area: "", price_per_night: 0, stars: 0 },
      };
      const updated = { ...prev, days: [...prev.days, newDay], duration_days: prev.days.length + 1 };
      saveCachedItinerary(updated);
      logChange("update", "user", { duration_days: prev.days.length }, { duration_days: updated.days.length }, `Added day ${updated.days.length}`);
      return updated;
    });
    toast({ title: "Day added to your trip" });
  }, [setStructuredItinerary, logChange]);

  const removeDayFromItinerary = useCallback((dayIdx: number) => {
    setStructuredItinerary(prev => {
      if (!prev || prev.days.length <= 1) return prev;
      const removedDay = prev.days[dayIdx];
      const newDays = prev.days.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, day: i + 1 }));
      const updated = { ...prev, days: newDays, duration_days: newDays.length };
      saveCachedItinerary(updated);
      logChange("delete", "user", { removed_day: removedDay }, { duration_days: updated.days.length }, `Removed day ${dayIdx + 1}`);
      return updated;
    });
    setEditingDayIdx(null);
    toast({ title: "Day removed from your trip" });
  }, [setStructuredItinerary, logChange]);

  return {
    editingDayIdx,
    setEditingDayIdx,
    moveToDayTarget,
    setMoveToDayTarget,
    daySuggestionText,
    setDaySuggestionText,
    daySuggestionLoading,
    updateItineraryDay,
    recalculateTimes,
    removeActivity,
    moveActivity,
    moveActivityToDay,
    improveDayWithAI,
    addDayToItinerary,
    removeDayFromItinerary,
  };
}
