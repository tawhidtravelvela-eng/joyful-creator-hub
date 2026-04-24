import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2, MapPin, Users, Calendar, Phone, Mail, User, AlertTriangle, Eye, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAdminTenantFilter } from "@/hooks/useAdminTenantFilter";

interface TripRequest {
  id: string;
  created_at: string;
  passenger_name: string;
  passenger_email: string;
  passenger_phone: string;
  trip_title: string;
  destination: string;
  duration_days: number;
  travelers: number;
  estimated_total: number;
  currency: string;
  itinerary_data: any;
  conversation_summary: string;
  status: string;
  admin_notes: string;
  is_large_group: boolean;
}

const statusOptions = [
  { value: "pending", label: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  { value: "contacted", label: "Contacted", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "in_progress", label: "In Progress", color: "bg-accent/10 text-accent border-accent/20" },
  { value: "confirmed", label: "Confirmed", color: "bg-[hsl(152,70%,42%/0.1)] text-[hsl(152,70%,42%)] border-[hsl(152,70%,42%/0.2)]" },
  { value: "cancelled", label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const AdminTripRequests = () => {
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TripRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const { formatDirectPrice } = useCurrency();
  const { adminTenantId } = useAdminTenantFilter();

  const fetchRequests = async () => {
    let query = supabase
      .from("trip_finalization_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (adminTenantId) query = query.eq("tenant_id", adminTenantId);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    setRequests((data as TripRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("trip_finalization_requests")
      .update({ status, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (!error) {
      toast({ title: "Status updated" });
      fetchRequests();
      if (selected?.id === id) setSelected({ ...selected, status });
    }
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("trip_finalization_requests")
      .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() } as any)
      .eq("id", selected.id);
    setSaving(false);
    if (!error) {
      toast({ title: "Notes saved" });
      fetchRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find(s => s.value === status);
    return opt?.color || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Trip Finalization Requests</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Users who want to finalize their AI-planned trips</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: requests.length, color: "text-foreground" },
            { label: "Pending", value: requests.filter(r => r.status === "pending").length, color: "text-warning" },
            { label: "In Progress", value: requests.filter(r => r.status === "in_progress" || r.status === "contacted").length, color: "text-primary" },
            { label: "Large Groups", value: requests.filter(r => r.is_large_group).length, color: "text-destructive" },
          ].map(stat => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Request list */}
        {requests.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              No trip finalization requests yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <Card key={req.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-foreground">{req.trip_title || req.destination}</h3>
                        <Badge variant="outline" className={`text-[10px] ${getStatusBadge(req.status)}`}>
                          {statusOptions.find(s => s.value === req.status)?.label || req.status}
                        </Badge>
                        {req.is_large_group && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Large Group
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{req.passenger_name}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{req.passenger_email}</span>
                        {req.passenger_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{req.passenger_phone}</span>}
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.destination}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{req.duration_days} days</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{req.travelers} travelers</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-lg font-bold text-foreground">{formatDirectPrice(req.estimated_total)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                      <div className="flex gap-1.5">
                        <Select value={req.status} onValueChange={(v) => handleUpdateStatus(req.id, v)}>
                          <SelectTrigger className="h-7 text-[10px] w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => { setSelected(req); setAdminNotes(req.admin_notes); }}
                        >
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.trip_title || `Trip to ${selected.destination}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Passenger</p>
                    <p className="text-sm font-medium text-foreground">{selected.passenger_name}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                    <a href={`mailto:${selected.passenger_email}`} className="text-sm font-medium text-primary hover:underline">{selected.passenger_email}</a>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Phone</p>
                    <a href={`tel:${selected.passenger_phone}`} className="text-sm font-medium text-primary hover:underline">{selected.passenger_phone || "N/A"}</a>
                  </div>
                </div>

                {/* Trip details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Destination</p>
                    <p className="text-sm font-medium">{selected.destination}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Duration</p>
                    <p className="text-sm font-medium">{selected.duration_days} days</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Travelers</p>
                    <p className="text-sm font-medium">{selected.travelers}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Est. Total</p>
                    <p className="text-sm font-bold text-primary">{formatDirectPrice(selected.estimated_total)}</p>
                  </div>
                </div>

                {selected.is_large_group && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">Large Group ({selected.travelers}+ travelers)</p>
                      <p className="text-xs text-muted-foreground">Reference pricing shown. Manual intervention required for final pricing.</p>
                    </div>
                  </div>
                )}

                {/* Conversation Summary */}
                {selected.conversation_summary && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Conversation Summary
                    </p>
                    <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {selected.conversation_summary}
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Admin Notes</p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this trip request..."
                    rows={3}
                  />
                  <Button onClick={handleSaveNotes} disabled={saving} size="sm" className="mt-2 gap-1.5">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Save Notes
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTripRequests;
