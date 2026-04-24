/**
 * useTransferResolution — resolves transfers for a trip itinerary
 * by calling the resolve-transfers edge function.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NormalizedTransfer, TransferResolutionRequest } from "@/components/trip-planner/transferTypes";
import { isTransferProduct } from "@/components/trip-planner/transferTypes";

interface UseTransferResolutionReturn {
  resolvedTransfers: NormalizedTransfer[];
  isResolving: boolean;
  resolveTransfers: (req: TransferResolutionRequest) => Promise<NormalizedTransfer[]>;
  clearTransfers: () => void;
  seedTransfers: (transfers: NormalizedTransfer[]) => void;
  transfersByDay: Record<number, NormalizedTransfer[]>;
  totalTransferCost: number;
}

export function useTransferResolution(): UseTransferResolutionReturn {
  const [resolvedTransfers, setResolvedTransfers] = useState<NormalizedTransfer[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const resolvingRef = useRef(false);

  const resolveTransfers = useCallback(async (req: TransferResolutionRequest): Promise<NormalizedTransfer[]> => {
    if (resolvingRef.current) return resolvedTransfers;
    if (!req.transfers || req.transfers.length === 0) return [];

    resolvingRef.current = true;
    setIsResolving(true);

    try {
      // Extract transfer-like products from available_products
      const transferProducts = (req.available_products || []).filter(
        (p: any) => isTransferProduct(p.name || "")
      );

      console.log(`[useTransferResolution] Resolving ${req.transfers.length} transfers, ${transferProducts.length} transfer products available`);

      const { data, error } = await supabase.functions.invoke("resolve-transfers", {
        body: {
          transfers: req.transfers,
          currency: req.currency,
          available_products: transferProducts,
        },
      });

      if (error) {
        console.error("[useTransferResolution] Error:", error);
        return [];
      }

      const transfers = (data?.transfers || []) as NormalizedTransfer[];
      console.log(`[useTransferResolution] Resolved ${transfers.length} transfers (${data?.cache_hits || 0} cached, ${data?.estimation_count || 0} estimated)`);

      setResolvedTransfers(transfers);
      return transfers;
    } catch (e) {
      console.error("[useTransferResolution] Exception:", e);
      return [];
    } finally {
      resolvingRef.current = false;
      setIsResolving(false);
    }
  }, [resolvedTransfers]);

  const clearTransfers = useCallback(() => {
    setResolvedTransfers([]);
  }, []);

  const seedTransfers = useCallback((transfers: NormalizedTransfer[]) => {
    if (transfers.length > 0) {
      setResolvedTransfers(transfers);
      console.log(`[useTransferResolution] Seeded ${transfers.length} backend-resolved transfers`);
    }
  }, []);

  // Group by day index
  const transfersByDay: Record<number, NormalizedTransfer[]> = {};
  for (const t of resolvedTransfers) {
    const day = t.day_index ?? -1;
    if (!transfersByDay[day]) transfersByDay[day] = [];
    transfersByDay[day].push(t);
  }

  const totalTransferCost = resolvedTransfers.reduce((sum, t) => sum + (t.total_price || 0), 0);

  return {
    resolvedTransfers,
    isResolving,
    resolveTransfers,
    clearTransfers,
    seedTransfers,
    transfersByDay,
    totalTransferCost,
  };
}

/**
 * Extracts transfer needs from an itinerary.
 * Identifies arrival, departure, and inter-city transfers.
 */
export function extractTransferNeeds(itinerary: any): TransferResolutionRequest["transfers"] {
  if (!itinerary?.days || itinerary.days.length === 0) return [];

  const transfers: TransferResolutionRequest["transfers"] = [];
  const days = itinerary.days;
  const adults = itinerary.adults || itinerary.travelers || 2;
  const children = itinerary.children || 0;
  const infants = itinerary.infants || 0;
  const totalPax = adults + children;
  const destination = (itinerary.destination || "").toLowerCase();
  const country = itinerary.destination_country || itinerary.country || "";

  const getDayCity = (day: any): string =>
    day?.city || day?.location || (itinerary.destination || "").split(",")[0]?.trim() || "";

  const getDayHotel = (day: any): string => {
    const directDayHotel = day?.hotel?.name || day?.selected_hotel?.name;
    if (directDayHotel) return directDayHotel;

    const dayCity = getDayCity(day).toLowerCase().trim();
    const matchedHotel = (itinerary.selected_hotels || []).find((h: any) => {
      const hotelCity = (h._searchCity || h.city || "").toLowerCase().trim();
      if (!hotelCity || !dayCity) return false;
      return hotelCity === dayCity || hotelCity.includes(dayCity) || dayCity.includes(hotelCity);
    });

    return matchedHotel?.name || itinerary.selected_hotel?.name || "Hotel";
  };

  // ── Extract IATA codes from flight data ──
  const getAirportIata = (city: string): string | undefined => {
    const sf = itinerary.selected_flight;
    if (!sf) return undefined;
    const cityLower = city.toLowerCase().trim();

    // Check outbound
    const outbound = sf.outbound || sf;
    const outDep = (outbound?.departure_city || outbound?.from || "").toLowerCase();
    const outArr = (outbound?.arrival_city || outbound?.to || "").toLowerCase();
    if (outDep.includes(cityLower) || cityLower.includes(outDep)) return outbound?.departure_airport || outbound?.from_code;
    if (outArr.includes(cityLower) || cityLower.includes(outArr)) return outbound?.arrival_airport || outbound?.to_code;

    // Check inter-city legs
    for (const leg of sf.inter_city_legs || []) {
      const lf = (leg.from || leg.departure_city || "").toLowerCase();
      const lt = (leg.to || leg.arrival_city || "").toLowerCase();
      if (lf.includes(cityLower) || cityLower.includes(lf)) return leg.from_code || leg.departure_airport;
      if (lt.includes(cityLower) || cityLower.includes(lt)) return leg.to_code || leg.arrival_airport;
    }

    // Check return
    const ret = sf.return || sf.inbound;
    if (ret) {
      const retDep = (ret.departure_city || ret.from || "").toLowerCase();
      const retArr = (ret.arrival_city || ret.to || "").toLowerCase();
      if (retDep.includes(cityLower) || cityLower.includes(retDep)) return ret.departure_airport || ret.from_code;
      if (retArr.includes(cityLower) || cityLower.includes(retArr)) return ret.arrival_airport || ret.to_code;
    }

    return undefined;
  };

  // Helper: check if an inter-city leg has a flight
  const hasFlightForSegment = (fromCity: string, toCity: string): boolean => {
    const legs = itinerary.selected_flight?.inter_city_legs || [];
    const from = fromCity.toLowerCase();
    const to = toCity.toLowerCase();
    return legs.some((leg: any) => {
      const lf = (leg.from || "").toLowerCase();
      const lt = (leg.to || "").toLowerCase();
      return (lf.includes(from) || from.includes(lf)) &&
             (lt.includes(to) || to.includes(lt));
    });
  };

  // Also check flight activities within a day
  const dayHasFlightActivity = (day: any): boolean =>
    (day?.activities || []).some((a: any) => {
      const name = (a.activity || a.name || "").toLowerCase();
      return /flight\s+from/i.test(name) || a.category === "flight";
    });

  const basePax = { passengers: totalPax, adults, children, infants };

  // ── 1. Arrival transfer: airport → hotel (Day 1)
  const firstCity = getDayCity(days[0]);
  const firstIata = getAirportIata(firstCity);
  transfers.push({
    pickup_type: "airport", pickup_code: firstIata, pickup_name: `${firstCity} Airport`,
    dropoff_type: "hotel", dropoff_name: getDayHotel(days[0]),
    city: firstCity, country, ...basePax,
    transfer_type: "airport_hotel", day_index: 0,
    position: "arrival", time_bucket: "daytime",
  });

  // ── 2. Departure transfer: hotel → airport (last day)
  const lastCity = getDayCity(days[days.length - 1]);
  const lastIata = getAirportIata(lastCity);
  transfers.push({
    pickup_type: "hotel", pickup_name: getDayHotel(days[days.length - 1]),
    dropoff_type: "airport", dropoff_code: lastIata, dropoff_name: `${lastCity} Airport`,
    city: lastCity, country, ...basePax,
    transfer_type: "hotel_airport", day_index: days.length - 1,
    position: "departure", time_bucket: "daytime",
  });

  // ── 3. Transition day transfers
  for (let i = 1; i < days.length; i++) {
    const day = days[i];
    const prevDay = days[i - 1];
    const prevCity = getDayCity(prevDay).toLowerCase();
    const currCity = getDayCity(day).toLowerCase();

    // Use backend metadata if available
    const dayType = (day.day_type || "").toLowerCase();
    const depCity = day.departure_city || getDayCity(prevDay);
    const arrCity = day.arrival_city || getDayCity(day);
    const isTransition = dayType === "transition" || (prevCity !== currCity);

    if (!isTransition) {
      // Same city — check for mid-stay hotel change
      const prevHotel = getDayHotel(prevDay).toLowerCase();
      const currHotel = getDayHotel(day).toLowerCase();
      if (prevHotel && currHotel && prevHotel !== currHotel) {
        transfers.push({
          pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
          dropoff_type: "hotel", dropoff_name: getDayHotel(day),
          city: getDayCity(day), country, ...basePax,
          transfer_type: "hotel_hotel", day_index: i,
          position: "intercity", time_bucket: "daytime",
        });
      }
      continue;
    }

    // Transition day — determine transport mode
    const isByFlight = hasFlightForSegment(depCity, arrCity) || dayHasFlightActivity(day);

    if (isByFlight) {
      const depIata = getAirportIata(depCity);
      const arrIata = getAirportIata(arrCity);
      transfers.push({
        pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
        dropoff_type: "airport", dropoff_code: depIata, dropoff_name: `${depCity} Airport`,
        city: depCity, country, ...basePax,
        transfer_type: "hotel_airport", day_index: i,
        position: "departure", time_bucket: "daytime",
      });
      transfers.push({
        pickup_type: "airport", pickup_code: arrIata, pickup_name: `${arrCity} Airport`,
        dropoff_type: "hotel", dropoff_name: getDayHotel(day),
        city: arrCity, country, ...basePax,
        transfer_type: "airport_hotel", day_index: i,
        position: "arrival", time_bucket: "daytime",
      });
    } else {
      // Ground transition: hotel → hotel (car, speedboat, ferry, etc.)
      transfers.push({
        pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
        dropoff_type: "hotel", dropoff_name: getDayHotel(day),
        city: arrCity, country, ...basePax,
        transfer_type: "hotel_hotel", day_index: i,
        position: "intercity", time_bucket: "daytime",
      });
    }
  }

  // ── 4. Resort detection — mark as mandatory
  const resortDests = ["maldives", "bora bora", "fiji", "seychelles"];
  if (resortDests.some(r => destination.includes(r))) {
    if (transfers.length > 0) {
      transfers[0].transfer_type = "resort_transfer" as any;
      transfers[0].position = "resort";
    }
    if (transfers.length > 1) {
      transfers[transfers.length - 1].transfer_type = "resort_transfer" as any;
      transfers[transfers.length - 1].position = "resort";
    }
  }

  return transfers;
}
