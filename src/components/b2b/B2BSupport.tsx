import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./shared/PageHeader";
import { EmptyState } from "./shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MessageSquare, Phone, Clock, ChevronRight, Headphones, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./shared/StatusBadge";

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  booking_ref?: string;
  created_at: string;
  updated_at: string;
}

const PRIORITY_COLORS: Record<string, string> = { Low: "bg-gray-100 text-gray-700", Medium: "bg-info/10 text-info", High: "bg-warning/10 text-warning", Urgent: "bg-danger/10 text-danger" };

export const B2BSupport = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [form, setForm] = useState({ subject: "", category: "general", priority: "medium", description: "", booking_ref: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ticket_requests" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTickets((data as any[] || []).map((t: any) => ({
      id: t.id,
      subject: t.request_type === "reissue" ? `Reissue request — ${t.booking_id}` : `Refund request — ${t.booking_id}`,
      category: t.request_type || "general",
      priority: "Medium",
      status: t.status === "pending" ? "Open" : t.status === "approved" ? "Resolved" : t.status === "rejected" ? "Closed" : "In Progress",
      description: t.details || "",
      booking_ref: t.booking_id,
      created_at: t.created_at,
      updated_at: t.updated_at || t.created_at,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const handleSubmit = async () => {
    if (!user || !form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    // Store as a ticket request
    const { error } = await supabase.from("ticket_requests" as any).insert({
      user_id: user.id,
      booking_id: form.booking_ref || "GENERAL",
      request_type: form.category,
      details: `[${form.priority.toUpperCase()}] ${form.subject}\n\n${form.description}`,
      status: "pending",
    } as any);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Support ticket created");
    setShowCreateDialog(false);
    setForm({ subject: "", category: "general", priority: "medium", description: "", booking_ref: "" });
    fetchTickets();
  };

  const filtered = tickets.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.subject.toLowerCase().includes(s) || t.id.toLowerCase().includes(s) || (t.booking_ref || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Support Center" description="Manage support tickets and requests" actions={
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Create Ticket
        </Button>
      } />

      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Phone className="w-4 h-4 text-primary" />
        <div className="text-xs">
          <span className="font-medium">Need help?</span>
          <span className="text-muted-foreground"> Contact our support team for assistance</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Input placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs pl-3" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No tickets found" description={tickets.length === 0 ? "You haven't created any support tickets yet" : "No tickets match your filters"} icon={<Headphones className="w-8 h-8" />} />
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Card key={t.id} className="cursor-pointer hover:shadow-sm hover:border-primary/15 transition-all" onClick={() => setSelectedTicket(t)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={t.status} type="support" />
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.Medium}`}>{t.priority}</span>
                      {t.booking_ref && <Badge variant="outline" className="text-[10px]">{t.booking_ref}</Badge>}
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{t.subject}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span>{t.category}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(t.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create ticket dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Subject *</Label><Input className="h-9 text-sm" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
            <div><Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="cancellation">Cancellation</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="reissue">Reissue</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Booking Reference (optional)</Label><Input className="h-9 text-sm font-mono" value={form.booking_ref} onChange={e => setForm(f => ({ ...f, booking_ref: e.target.value }))} placeholder="e.g. TV-FL-12345" /></div>
            <div><Label className="text-xs">Description</Label><Textarea className="text-sm min-h-[80px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View ticket dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={v => { if (!v) setSelectedTicket(null); }}>
        <DialogContent className="max-w-lg">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  Support Ticket <StatusBadge status={selectedTicket.status} type="support" />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm font-medium">{selectedTicket.subject}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Category:</span> {selectedTicket.category}</div>
                  <div><span className="text-muted-foreground">Priority:</span> <span className={`px-1.5 py-0.5 rounded ${PRIORITY_COLORS[selectedTicket.priority] || ""}`}>{selectedTicket.priority}</span></div>
                  <div><span className="text-muted-foreground">Created:</span> {new Date(selectedTicket.created_at).toLocaleString()}</div>
                  {selectedTicket.booking_ref && <div><span className="text-muted-foreground">Booking:</span> <span className="font-mono">{selectedTicket.booking_ref}</span></div>}
                </div>
                {selectedTicket.description && (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
