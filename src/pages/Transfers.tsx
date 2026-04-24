import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, Users, Briefcase, Clock, MapPin, AlertCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { hydrateTransferDataFromWire } from "@/lib/transferWireAdapter";

interface TransferOffer {
  id: string;
  source: string;
  transferType: string;
  vehicle: {
    category: string;
    description: string;
    image: string;
    seats: number;
    baggages: number;
  };
  provider: {
    code: string;
    name: string;
    logo: string;
  };
  price: number;
  currency: string;
  isEstimated: boolean;
  pickup: { dateTime: string; locationCode: string };
  dropoff: { dateTime: string; locationCode: string; address?: any };
  duration?: string;
  distance?: any;
  cancellationRules?: any[];
}

const VEHICLE_ICONS: Record<string, string> = {
  STANDARD: "🚗",
  EXECUTIVE: "🚘",
  LUXURY: "🏎️",
  VAN: "🚐",
  MINIBUS: "🚌",
  LIMOUSINE: "🚙",
  HELICOPTER: "🚁",
};

const Transfers = () => {
  const [searchParams] = useSearchParams();
  const { formatDirectPrice, convertPrice } = useCurrency();
  const [transfers, setTransfers] = useState<TransferOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const pickup = searchParams.get("pickup") || "";
  const dropoff = searchParams.get("dropoff") || "";
  const dateTime = searchParams.get("dateTime") || "";
  const passengers = parseInt(searchParams.get("passengers") || "1");
  const transferType = searchParams.get("type") || "PRIVATE";

  useEffect(() => {
    if (pickup && dateTime) {
      searchTransfers();
    }
  }, [pickup, dropoff, dateTime, passengers, transferType]);

  const searchTransfers = async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("unified-transfer-search", {
        body: {
          action: "search",
          pickupAirport: pickup,
          dropoffAirport: dropoff || undefined,
          dropoffCity: dropoff && dropoff.length > 3 ? dropoff : undefined,
          pickupDateTime: dateTime,
          passengers,
          transferType,
        },
      });
      if (data) hydrateTransferDataFromWire(data);

      if (fnError) throw fnError;
      if (data?.success) {
        setTransfers(data.transfers || []);
      } else {
        setError(data?.message || data?.error || "No transfers found");
        setTransfers([]);
      }
    } catch (err: any) {
      console.error("Transfer search error:", err);
      setError(err.message || "Failed to search transfers");
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (dur: string | undefined) => {
    if (!dur) return "";
    // ISO 8601 duration like "PT1H30M"
    const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return dur;
    const h = match[1] ? `${match[1]}h` : "";
    const m = match[2] ? `${match[2]}m` : "";
    return `${h} ${m}`.trim();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="bg-primary/5 border-b border-border py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Airport Transfers</h1>
            <p className="text-muted-foreground text-sm">
              {pickup && dateTime
                ? `Showing transfers from ${pickup}${dropoff ? ` to ${dropoff}` : ""}`
                : "Search for airport transfers, private cars & shared shuttles"}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Searching transfer providers...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm text-center max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={searchTransfers}>
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && searched && transfers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Car className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No transfers found for this route. Try different locations or dates.</p>
            </div>
          )}

          {!loading && transfers.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                {transfers.length} transfer{transfers.length !== 1 ? "s" : ""} found
              </p>
              {transfers.map((t) => (
                <Card key={t.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Vehicle image / icon */}
                      <div className="sm:w-48 h-32 sm:h-auto bg-muted/30 flex items-center justify-center flex-shrink-0">
                        {t.vehicle.image ? (
                          <img src={t.vehicle.image} alt={t.vehicle.category} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-5xl">{VEHICLE_ICONS[t.vehicle.category?.toUpperCase()] || "🚗"}</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-foreground text-base">
                                {t.vehicle.description || t.vehicle.category || "Transfer"}
                              </h3>
                              <Badge variant="secondary" className="text-[10px]">
                                {t.transferType}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {t.provider.name}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {t.vehicle.seats > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  {t.vehicle.seats} seats
                                </span>
                              )}
                              {t.vehicle.baggages > 0 && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-3.5 h-3.5" />
                                  {t.vehicle.baggages} bags
                                </span>
                              )}
                              {t.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDuration(t.duration)}
                                </span>
                              )}
                              {t.pickup.locationCode && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {t.pickup.locationCode} → {t.dropoff.locationCode || "Destination"}
                                </span>
                              )}
                            </div>

                            {t.cancellationRules?.length > 0 && (
                              <p className="text-[11px] text-green-600 mt-2 font-medium">
                                ✓ Free cancellation available
                              </p>
                            )}
                          </div>

                          {/* Price & CTA */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-bold text-foreground">
                              {formatDirectPrice(convertPrice(t.price, t.currency))}
                            </div>
                            {t.isEstimated && (
                              <p className="text-[10px] text-muted-foreground">estimated</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mb-3">total price</p>
                            <Button size="sm" className="rounded-full px-5">
                              Select
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Car className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Search for airport transfers using the search bar above.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Transfers;
