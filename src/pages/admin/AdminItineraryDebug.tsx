import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import ItineraryDebugPanel from "@/components/admin/ItineraryDebugPanel";
import { Bug, Search, Loader2, MapPin, Calendar, User } from "lucide-react";
import { format } from "date-fns";

const AdminItineraryDebug = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("saved_trips")
        .select("id, title, destination, origin, duration_days, travelers, status, current_version, last_modified_by, last_modified_source, created_at, updated_at, user_id, itinerary_code")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (statusFilter === "invalid") {
        query = query.eq("status", "invalid");
      }

      const { data, error } = await query;
      if (error) console.error("Failed to load trips:", error);
      setTrips((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, [statusFilter]);

  const filtered = trips.filter(t =>
    !searchQuery || 
    (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.destination || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bug className="h-6 w-6" /> Itinerary Debug Console
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Track changes, errors, and version history for all itineraries</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or destination..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trips</SelectItem>
              <SelectItem value="invalid">Invalid Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trip List */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No trips found
                </CardContent>
              </Card>
            ) : (
              filtered.map(trip => (
                <Card
                  key={trip.id}
                  className={`border-border/50 cursor-pointer transition-all hover:shadow-md ${selectedTripId === trip.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedTripId(trip.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{trip.title}</p>
                        {trip.itinerary_code && (
                          <p className="text-[10px] font-mono font-bold text-primary mt-0.5">{trip.itinerary_code}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {trip.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{trip.destination}</span>}
                          {trip.duration_days && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{trip.duration_days}d</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          v{trip.current_version || 1}
                        </Badge>
                        {trip.last_modified_source && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {trip.last_modified_source}
                          </Badge>
                        )}
                        {trip.status === "invalid" && (
                          <Badge variant="destructive" className="text-[10px]">Invalid</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {trip.updated_at ? format(new Date(trip.updated_at), "MMM d, yyyy HH:mm") : ""}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Debug Panel */}
          <div>
            {selectedTripId ? (
              <ItineraryDebugPanel tripId={selectedTripId} />
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center text-muted-foreground text-sm">
                  Select a trip to view debug info
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminItineraryDebug;
