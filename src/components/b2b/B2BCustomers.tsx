import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./shared/PageHeader";
import { EmptyState } from "./shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Eye, Edit, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface SavedPassenger {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  passport_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  created_at: string;
}

export const B2BCustomers = () => {
  const { user } = useAuth();
  const [passengers, setPassengers] = useState<SavedPassenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewPassenger, setViewPassenger] = useState<SavedPassenger | null>(null);
  const [form, setForm] = useState({ title: "Mr", first_name: "", last_name: "", email: "", phone: "", passport_number: "", nationality: "", date_of_birth: "" });
  const [saving, setSaving] = useState(false);

  const fetchPassengers = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_passengers" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPassengers((data as any[] || []) as SavedPassenger[]);
    setLoading(false);
  };

  useEffect(() => { fetchPassengers(); }, [user]);

  const handleSave = async () => {
    if (!user || !form.first_name || !form.last_name) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("saved_passengers" as any).insert({
      user_id: user.id,
      title: form.title,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      passport_number: form.passport_number || null,
      nationality: form.nationality || null,
      date_of_birth: form.date_of_birth || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer added");
    setShowAddDialog(false);
    setForm({ title: "Mr", first_name: "", last_name: "", email: "", phone: "", passport_number: "", nationality: "", date_of_birth: "" });
    fetchPassengers();
  };

  const filtered = passengers.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    return name.includes(q) || (p.email || "").toLowerCase().includes(q) || (p.passport_number || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" description={`${passengers.length} saved traveler profiles`} actions={
        <Button size="sm" className="text-xs gap-1.5" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Customer
        </Button>
      } />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Search name, email, passport..." value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-8 text-xs" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers found" description={passengers.length === 0 ? "Add your first traveler profile" : "Try a different search"} icon={<Users className="w-8 h-8" />} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Passport</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Nationality</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Added</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-medium">{p.title} {p.first_name} {p.last_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.email || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.phone || "—"}</td>
                      <td className="px-2 py-2 font-mono text-[10px]">{p.passport_number || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.nationality || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="View details" onClick={() => setViewPassenger(p)}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Title</Label><Input className="h-9 text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label className="text-xs">First Name *</Label><Input className="h-9 text-sm" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Last Name *</Label><Input className="h-9 text-sm" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input type="email" className="h-9 text-sm" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="h-9 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Passport Number</Label><Input className="h-9 text-sm" value={form.passport_number} onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))} /></div>
              <div><Label className="text-xs">Nationality</Label><Input className="h-9 text-sm" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Date of Birth</Label><Input type="date" className="h-9 text-sm" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add Customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog */}
      <Dialog open={!!viewPassenger} onOpenChange={v => { if (!v) setViewPassenger(null); }}>
        <DialogContent className="max-w-sm">
          {viewPassenger && (
            <>
              <DialogHeader><DialogTitle>{viewPassenger.title} {viewPassenger.first_name} {viewPassenger.last_name}</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                {viewPassenger.email && <div><span className="text-muted-foreground text-xs">Email:</span> <span>{viewPassenger.email}</span></div>}
                {viewPassenger.phone && <div><span className="text-muted-foreground text-xs">Phone:</span> <span>{viewPassenger.phone}</span></div>}
                {viewPassenger.passport_number && <div><span className="text-muted-foreground text-xs">Passport:</span> <span className="font-mono">{viewPassenger.passport_number}</span></div>}
                {viewPassenger.nationality && <div><span className="text-muted-foreground text-xs">Nationality:</span> <span>{viewPassenger.nationality}</span></div>}
                {viewPassenger.date_of_birth && <div><span className="text-muted-foreground text-xs">DOB:</span> <span>{new Date(viewPassenger.date_of_birth).toLocaleDateString()}</span></div>}
                <div><span className="text-muted-foreground text-xs">Added:</span> <span>{new Date(viewPassenger.created_at).toLocaleDateString()}</span></div>
              </div>
              <DialogFooter><Button variant="outline" size="sm" onClick={() => setViewPassenger(null)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
