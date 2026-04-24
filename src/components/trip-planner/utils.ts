import { Plane, Hotel, Camera, Bus, DollarSign } from "lucide-react";
import type React from "react";

/** Reusable category → icon map for budget breakdowns */
export const catIcons: Record<string, React.ElementType> = {
  flights: Plane,
  hotels: Hotel,
  activities: Camera,
  transport: Bus,
  food: DollarSign,
  shopping: DollarSign,
  visa: DollarSign,
};
