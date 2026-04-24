/**
 * useDisplayItinerary — Pure display layer.
 *
 * The frontend is a PASS-THROUGH for backend data.
 * No auto-linking, no time-shifting, no activity injection,
 * no flight auto-reselect, no zone reshuffling.
 *
 * Backend is the single source of truth for:
 *   - Flight/hotel/activity selection & matching
 *   - Activity timing & day composition
 *   - Price resolution
 *
 * Frontend only handles:
 *   - Extracting itinerary from state/messages
 *   - Displaying user-selected overrides (swap display data)
 *   - Budget recalculation (simple arithmetic on backend-provided data)
 *
 * User overrides (flight/hotel/activity swaps) are sent to backend
 * for validation and reshuffling — see useItineraryOverrides hook.
 */
import { useMemo } from "react";
import type { Itinerary } from "@/components/trip-planner/tripTypes";
import type { RefinementState } from "@/components/trip-planner/TripRefinementControls";
import {
  calcRooms, calcFlightCost, calcHotelCost, calcActivityCost,
  prefixFlightNumber, computeFlightDuration,
  aggregateFlightFareBreakdown,
} from "@/components/trip-planner/tripPricingUtils";
import { parseItinerary } from "@/components/trip-planner/tripParsingUtils";
import type { Msg } from "@/components/trip-planner/tripTypes";

interface UseDisplayItineraryParams {
  structuredItinerary: Itinerary | null;
  messages: Msg[];
  refinement: RefinementState;
  allSearchedFlights: any[];
  allSearchedHotels: any[];
  allSearchedActivities: any[];
  userSelectedFlight: any;
  userSelectedFlightsByLeg: Record<string, any>;
  userSelectedHotel: any;
  userSelectedHotelsByCity: Record<string, any>;
  userSelectedActivities: any[];
  dayActivityOverrides: Record<string, any>;
  currency: string;
  extractedParams: any;
}

export function useDisplayItinerary({
  structuredItinerary, messages, refinement,
  allSearchedFlights, allSearchedHotels, allSearchedActivities,
  userSelectedFlight, userSelectedFlightsByLeg,
  userSelectedHotel, userSelectedHotelsByCity,
  userSelectedActivities, dayActivityOverrides,
  currency, extractedParams,
}: UseDisplayItineraryParams) {
  // ── Extract latest itinerary from dedicated state or message parsing ──
  const latestItinerary = structuredItinerary || (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        const parsed = parseItinerary(messages[i].content);
        if (parsed) return parsed;
      }
    }
    return null;
  })();

  // ═══════════════════════════════════════════════════════════════
  // Stage 1: Flight display override (user swap only — NO time-shifting)
  // Backend handles all timing adjustments via override endpoint.
  // ═══════════════════════════════════════════════════════════════
  const flightOverridden = useMemo(() => {
    if (!latestItinerary) return null;
    let result = { ...latestItinerary };

    // Single flight user selection
    if (userSelectedFlight) {
      const sf = userSelectedFlight;
      const outSegs = sf.segments?.filter((s: any) => String(s.group) === "0" || s.group === 0) || [];
      const outSeg = outSegs[0];
      const lastOutSeg = outSegs.length ? outSegs[outSegs.length - 1] : outSeg;
      const inSeg = sf.segments?.filter((s: any) => String(s.group) === "1" || s.group === 1) || [];
      const lastInSeg = inSeg?.length ? inSeg[inSeg.length - 1] : null;

      result = {
        ...result,
        selected_flight: {
          ...result.selected_flight,
          reason: "",
          summary: `${prefixFlightNumber(sf.flightNumber, sf.airline) || sf.airline || ""} · ${sf.from_city} → ${sf.to_city}`.trim(),
          price: sf.price,
          totalPrice: sf.totalPrice || result.selected_flight?.totalPrice || sf.price,
          ...aggregateFlightFareBreakdown([sf]),
          outbound: sf.outbound || (outSeg ? {
            airline: outSeg.carrier, flight_number: outSeg.flightNumber,
            from: sf.from_city, to: sf.to_city,
            departure: outSeg.departure?.split("T")[1]?.slice(0, 5) || "",
            arrival: (lastOutSeg || outSeg).arrival?.split("T")[1]?.slice(0, 5) || "",
            duration: sf.duration,
            stops: sf.stops ?? Math.max(0, outSegs.length - 1),
            date: outSeg.departure?.split("T")[0] || "",
            cabin_class: sf.cabinClass || outSeg.cabinClass || "Economy",
          } : result.selected_flight?.outbound),
          inbound: (() => {
            const retLeg = sf.return_leg;
            const retSegDep = inSeg.length ? (inSeg[0].departure?.split("T")[1]?.slice(0, 5) || inSeg[0].departure || "") : "";
            const retSegArr = lastInSeg ? (lastInSeg.arrival?.split("T")[1]?.slice(0, 5) || lastInSeg.arrival || "") : "";
            const retSegDate = inSeg.length ? (inSeg[0].departure?.split("T")[0] || "") : "";
            if (retLeg) {
              const rlAirline = retLeg.airline || (inSeg.length ? inSeg[0].carrier || inSeg[0].airline : "") || sf.airline || "";
              const rlFn = retLeg.flightNumber || (inSeg.length ? inSeg[0].flightNumber : "") || "";
              const dep = retLeg.departure || retSegDep || "";
              const arr = retLeg.arrival || retSegArr || "";
              return {
                airline: rlAirline,
                flight_number: prefixFlightNumber(rlFn, rlAirline),
                from: retLeg.from || (inSeg.length ? inSeg[0].origin || inSeg[0].from : "") || sf.to_city || "",
                to: retLeg.to || (lastInSeg ? lastInSeg.destination || lastInSeg.to : "") || sf.from_city || "",
                departure: dep, arrival: arr,
                date: retLeg.departure?.split("T")[0] || retSegDate || "",
                duration: retLeg.duration || computeFlightDuration(dep, arr),
                stops: retLeg.stops ?? (inSeg.length ? Math.max(0, inSeg.length - 1) : 0),
                cabin_class: sf.outbound?.cabin_class || sf.cabinClass || "Economy",
              };
            }
            if (lastInSeg) {
              const segAirline = inSeg[0].carrier || inSeg[0].airline || sf.airline || "";
              const segFn = inSeg[0].flightNumber || "";
              return {
                airline: segAirline,
                flight_number: prefixFlightNumber(segFn, segAirline),
                from: inSeg[0].origin || inSeg[0].from || sf.to_city || "",
                to: lastInSeg.destination || lastInSeg.to || sf.from_city || "",
                departure: retSegDep, arrival: retSegArr, date: retSegDate,
                duration: computeFlightDuration(inSeg[0].departure, lastInSeg.arrival),
                stops: Math.max(0, inSeg.length - 1),
                cabin_class: sf.outbound?.cabin_class || sf.cabinClass || "Economy",
              };
            }
            return result.selected_flight?.inbound;
          })(),
          is_live_price: true,
          _rawId: sf.tripjackPriceId || sf.id || "",
          _rawSource: sf.source || "",
          _rawSegments: sf.segments || [],
        },
      };
    }

    // Multi-city per-leg selections
    if (!userSelectedFlight && Object.keys(userSelectedFlightsByLeg).length > 0) {
      const allLegLabels = [...new Set(allSearchedFlights.map((f: any) => f._legLabel).filter(Boolean))];
      const mergedLegs: Record<string, any> = {};
      for (const label of allLegLabels) {
        if (userSelectedFlightsByLeg[label]) {
          mergedLegs[label] = userSelectedFlightsByLeg[label];
        } else {
          const candidates = allSearchedFlights
            .filter((f: any) => f._legLabel === label)
            .sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
          if (candidates[0]) mergedLegs[label] = candidates[0];
        }
      }

      const legEntries = Object.entries(mergedLegs);
      const totalPrice = legEntries.reduce((sum, [, f]) => sum + ((f as any).totalPrice || (f as any).price || 0), 0);
      const outFlight = legEntries.find(([, f]) => (f as any)._legType === "outbound")?.[1];
      const retFlight = legEntries.find(([, f]) => f._legType === "return")?.[1];
      const interCityFlights = legEntries.filter(([, f]) => f._legType === "intercity").map(([, f]) => f);

      const buildLegData = (f: any) => {
        if (!f) return undefined;
        const segs = f.segments || [];
        const first = segs[0] || f;
        const last = segs[segs.length - 1] || f;
        const carrier = f.airline || first?.carrier || first?.fD?.aI?.code || "";
        const rawFn = first?.fD?.fN || first?.flightNumber || f.flightNumber || "";
        return {
          airline: carrier,
          flight_number: rawFn && carrier && !rawFn.toUpperCase().startsWith(carrier.toUpperCase())
            ? `${carrier} ${rawFn}` : rawFn,
          from: first?.origin || first?.from || f.from_city || "",
          to: last?.destination || last?.to || f.to_city || "",
          departure: (first?.departure || "").split("T")[1]?.slice(0, 5) || first?.departure || "",
          arrival: (last?.arrival || "").split("T")[1]?.slice(0, 5) || last?.arrival || "",
          date: (first?.departure || "").split("T")[0] || "",
          duration: f.duration || "",
          stops: f.stops ?? Math.max(0, segs.length - 1),
          cabin_class: f.cabinClass || "Economy",
        };
      };

      const interCityLegs = interCityFlights.map(f => {
        const d = buildLegData(f)!;
        return { label: f._legLabel || `${d.from} → ${d.to}`, ...d, price: f.price, currency: f.currency || "USD" };
      });

      result = {
        ...result,
        selected_flight: {
          ...result.selected_flight,
          reason: "",
          summary: `Multi-city · ${legEntries.length} legs`,
          price: legEntries.reduce((sum, [, f]) => sum + ((f as any).price || 0), 0),
          totalPrice,
          ...aggregateFlightFareBreakdown(legEntries.map(([, f]) => f)),
          outbound: buildLegData(outFlight) || result.selected_flight?.outbound,
          inbound: buildLegData(retFlight) || result.selected_flight?.inbound,
          inter_city_legs: interCityLegs.length > 0 ? interCityLegs : result.selected_flight?.inter_city_legs,
          is_live_price: true,
          _rawId: outFlight?.tripjackPriceId || outFlight?.id || "",
          _rawSource: outFlight?.source || "",
          _rawSegments: outFlight?.segments || [],
        },
      };
    }

    // Sanitize flight summary (fix doubled airline codes)
    if (result.selected_flight?.summary) {
      result = {
        ...result,
        selected_flight: {
          ...result.selected_flight,
          summary: result.selected_flight.summary.replace(/^([A-Z0-9]{2})\s+\1(\d+)/i, "$1$2"),
        },
      };
    }

    return result;
  }, [latestItinerary, userSelectedFlight, userSelectedFlightsByLeg, allSearchedFlights]);

  // ═══════════════════════════════════════════════════════════════
  // Stage 2: Hotel display override (user swap only)
  // ═══════════════════════════════════════════════════════════════
  const hotelOverridden = useMemo(() => {
    if (!flightOverridden) return null;
    let result = { ...flightOverridden };

    if (userSelectedHotel) {
      const sh = userSelectedHotel;
      const perNight = sh.pricePerNight || sh.price_per_night || 0;
      const nights = result.selected_hotel?.nights || 1;
      result = {
        ...result,
        selected_hotel: {
          ...result.selected_hotel,
          name: sh.name,
          stars: sh.stars || result.selected_hotel?.stars || 3,
          price_per_night: perNight,
          total_price: Math.round(perNight * nights),
          nights,
          meal_basis: sh.mealBasis || sh.meal_basis || result.selected_hotel?.meal_basis || "",
          room_type: sh.roomType || sh.room_type || result.selected_hotel?.room_type || "",
          reason: "",
        },
      };
    }

    if (Object.keys(userSelectedHotelsByCity).length > 0 && result.selected_hotels?.length) {
      result = {
        ...result,
        selected_hotels: result.selected_hotels.map((sh: any) => {
          const ck = (sh.city || "").toLowerCase();
          const userPick = userSelectedHotelsByCity[ck];
          if (!userPick) return sh;
          const perNight = userPick.pricePerNight || userPick.price_per_night || 0;
          return {
            ...sh,
            name: userPick.name,
            stars: userPick.stars || sh.stars,
            price_per_night: perNight,
            total_price: Math.round(perNight * (sh.nights || 1)),
            meal_basis: userPick.mealBasis || userPick.meal_basis || sh.meal_basis || "",
            room_type: userPick.roomType || userPick.room_type || sh.room_type || "",
            reason: "",
          };
        }),
      };
      if (result.selected_hotels[0] && result.selected_hotel) {
        result.selected_hotel = { ...result.selected_hotel, ...result.selected_hotels[0] };
      }
    }

    return result;
  }, [flightOverridden, userSelectedHotel, userSelectedHotelsByCity]);

  // ═══════════════════════════════════════════════════════════════
  // Stage 3: Activity display override (per-day swaps only)
  // No auto-link, no distribution, no injection.
  // Backend handles all activity matching and placement.
  // ═══════════════════════════════════════════════════════════════
  const activityOverridden = useMemo(() => {
    if (!hotelOverridden) return null;
    let result = { ...hotelOverridden };

    // Apply per-day activity swaps (user clicked "swap" on a specific slot)
    if (Object.keys(dayActivityOverrides).length > 0 && result.days) {
      result = {
        ...result,
        days: result.days.map((day: any, dayIdx: number) => ({
          ...day,
          activities: day.activities.map((act: any, actIdx: number) => {
            const key = `${dayIdx}-${actIdx}`;
            const override = dayActivityOverrides[key];
            if (override) {
              const oPricingType = override.pricingType || act.pricingType || "PER_PERSON";
              const oRawPrice = override.price || 0;
              const a = result.adults || result.travelers || 1;
              const c = result.children || 0;
              // cost_estimate must be total cost (price × travelers for PER_PERSON)
              const oCostEstimate = oPricingType === "PER_GROUP"
                ? oRawPrice
                : calcActivityCost(oRawPrice, a, c);
              return {
                ...act,
                activity: override.name,
                product_name: override.product_name || override.name,
                option_title: override.option_title || act.option_title || "",
                description: override.duration
                  ? `${override.duration} · ${override.category || "Tour"}`
                  : (override.description || act.description),
                cost_estimate: oCostEstimate,
                is_live_price: true,
                source: "travelvela",
                product_code: override.productCode || override.product_code || "",
                highlights: override.highlights || act.highlights || [],
                places_covered: override.places_covered || act.places_covered || [],
                pricingType: oPricingType,
                category: "activity",
                duration_hours: override.duration_hours || override._durationHours || act.duration_hours || undefined,
                _durationHours: override._durationHours || override.duration_hours || act._durationHours || undefined,
                durationMinutes: override.durationMinutes || (override.duration_hours ? Math.round(override.duration_hours * 60) : act.durationMinutes) || undefined,
              };
            }
            return act;
          }),
        })),
      };
    }

    return result;
  }, [hotelOverridden, dayActivityOverrides]);

  // ═══════════════════════════════════════════════════════════════
  // Stage 4: Budget recalculation (simple arithmetic on backend data)
  // ═══════════════════════════════════════════════════════════════
  const displayItinerary = useMemo(() => {
    if (!activityOverridden) return null;
    let result = { ...activityOverridden };

    const liveCurrency = currency || result.budget_estimate?.currency || "USD";

    if (result.budget_estimate) {
      const a = result.adults || result.travelers || 1;
      const c = result.children || 0;
      const inf = result.infants || 0;
      const numRooms = result.rooms || calcRooms(a, c);

      const flightCost = result.selected_flight?.price
        ? calcFlightCost(result.selected_flight, a, c, inf)
        : (result.budget_estimate.breakdown?.flights || 0);

      const hotelCost = result.selected_hotels?.length
        ? result.selected_hotels.reduce((sum: number, h: any) => sum + calcHotelCost(h.price_per_night || 0, h.nights || 1, numRooms), 0)
        : result.selected_hotel
          ? calcHotelCost(result.selected_hotel.price_per_night || 0, result.selected_hotel.nights || 1, numRooms)
          : (result.budget_estimate.breakdown?.hotels || 0);

      // Trust backend's pre-calculated activity total unless user has overridden activities
      const hasActivityOverrides = Object.keys(dayActivityOverrides || {}).length > 0;
      let activityCost = result.budget_estimate.breakdown?.activities || 0;

      if (hasActivityOverrides && result.days) {
        // Recalculate from day activities — cost_estimate is already total (price × travelers)
        const dayActivityTotal = result.days.reduce((sum: number, day: any) =>
          sum + (day.activities || []).reduce((s: number, act: any) => {
            const cat = (act.category || "").toLowerCase();
            if (cat === "flight" || cat === "hotel" || cat === "transport" || cat === "logistics") return s;
            const totalCost = act.cost_estimate || 0;
            if (totalCost <= 0) return s;
            return s + totalCost;
          }, 0), 0);
        if (dayActivityTotal > 0) activityCost = dayActivityTotal;
      }

      const updatedBreakdown = {
        ...result.budget_estimate.breakdown,
        flights: Math.round(flightCost),
        hotels: Math.round(hotelCost),
        activities: Math.round(activityCost),
      };

      const newTotal = Object.values(updatedBreakdown).reduce(
        (sum: number, v: any) => sum + (typeof v === "number" ? v : 0), 0,
      );

      result = {
        ...result,
        budget_estimate: {
          ...result.budget_estimate,
          currency: liveCurrency,
          total: Math.max(0, Math.round(newTotal)),
          breakdown: updatedBreakdown,
        },
      };
    }

    return result;
  }, [activityOverridden, currency, dayActivityOverrides]);

  return { latestItinerary, displayItinerary };
}
