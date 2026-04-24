import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, Plane, Luggage, ShieldCheck, Route } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AirlineSetting {
  id: string;
  airline_code: string;
  airline_name: string;
  cabin_baggage: string;
  checkin_baggage: string;
  cancellation_policy: string;
  date_change_policy: string;
  name_change_policy: string;
  no_show_policy: string;
  scope_type: string;
  from_code: string;
  to_code: string;
}

const emptyForm: Omit<AirlineSetting, "id"> = {
  airline_code: "",
  airline_name: "",
  cabin_baggage: "7 Kg",
  checkin_baggage: "20 Kg",
  cancellation_policy: "Free cancellation within 24 hours of booking",
  date_change_policy: "Date changes allowed with fare difference",
  name_change_policy: "Name changes up to 48h before departure ($50 fee)",
  no_show_policy: "No-show results in full fare forfeiture",
  scope_type: "all",
  from_code: "",
  to_code: "",
};

const AdminAirlineSettings = () => {
  const [loading, setLoading] = useState(true);
  const [airlines, setAirlines] = useState<AirlineSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AirlineSetting, "id">>(emptyForm);

  useEffect(() => { fetchAirlines(); }, []);

  const fetchAirlines = async () => {
    try {
      const { data, error } = await supabase.from("airline_settings").select("*").order("airline_code");
      if (error) throw error;
      setAirlines((data as any[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: AirlineSetting) => {
    setEditId(a.id);
    setForm({
      airline_code: a.airline_code,
      airline_name: a.airline_name,
      cabin_baggage: a.cabin_baggage,
      checkin_baggage: a.checkin_baggage,
      cancellation_policy: a.cancellation_policy,
      date_change_policy: a.date_change_policy,
      name_change_policy: a.name_change_policy,
      no_show_policy: a.no_show_policy,
      scope_type: a.scope_type || "all",
      from_code: a.from_code || "",
      to_code: a.to_code || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.airline_code.trim()) {
      toast({ title: "Airline code is required", variant: "destructive" });
      return;
    }
    if (form.scope_type === "route" && (!form.from_code.trim() || !form.to_code.trim())) {
      toast({ title: "Both origin and destination codes are required for route-specific settings", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        from_code: form.scope_type === "route" ? form.from_code.toUpperCase().trim() : "",
        to_code: form.scope_type === "route" ? form.to_code.toUpperCase().trim() : "",
      };
      if (editId) {
        const { error } = await supabase.from("airline_settings").update(payload as any).eq("id", editId);
        if (error) throw error;
        toast({ title: "Updated", description: `${form.airline_code} settings updated.` });
      } else {
        const { error } = await supabase.from("airline_settings").insert(payload as any);
        if (error) throw error;
        toast({ title: "Added", description: `${form.airline_code} settings saved.` });
      }
      setDialogOpen(false);
      fetchAirlines();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete settings for ${code}?`)) return;
    try {
      const { error } = await supabase.from("airline_settings").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: `${code} settings removed.` });
      fetchAirlines();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Airline Baggage & Policy Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">Configure baggage allowances and policies per airline or per route.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Airline</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit" : "Add"} Airline Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Airline IATA Code *</Label>
                    <Input placeholder="e.g. EK" value={form.airline_code} onChange={(e) => setForm({ ...form, airline_code: e.target.value.toUpperCase() })} maxLength={3} disabled={!!editId} />
                  </div>
                  <div className="space-y-2">
                    <Label>Airline Name</Label>
                    <Input placeholder="e.g. Emirates" value={form.airline_name} onChange={(e) => setForm({ ...form, airline_name: e.target.value })} />
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4" />Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Apply to</Label>
                      <Select value={form.scope_type} onValueChange={(v) => setForm({ ...form, scope_type: v, from_code: v === "all" ? "" : form.from_code, to_code: v === "all" ? "" : form.to_code })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All routes (global default)</SelectItem>
                          <SelectItem value="route">Specific route</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.scope_type === "route" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Origin (IATA) *</Label>
                          <Input placeholder="e.g. DAC" value={form.from_code} onChange={(e) => setForm({ ...form, from_code: e.target.value.toUpperCase() })} maxLength={3} />
                        </div>
                        <div className="space-y-2">
                          <Label>Destination (IATA) *</Label>
                          <Input placeholder="e.g. CCU" value={form.to_code} onChange={(e) => setForm({ ...form, to_code: e.target.value.toUpperCase() })} maxLength={3} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Luggage className="w-4 h-4" />Baggage Allowance</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cabin Baggage</Label>
                      <Input placeholder="7 Kg" value={form.cabin_baggage} onChange={(e) => setForm({ ...form, cabin_baggage: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-in Baggage</Label>
                      <Input placeholder="20 Kg" value={form.checkin_baggage} onChange={(e) => setForm({ ...form, checkin_baggage: e.target.value })} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Policies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cancellation Policy</Label>
                      <Textarea rows={2} value={form.cancellation_policy} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date Change Policy</Label>
                      <Textarea rows={2} value={form.date_change_policy} onChange={(e) => setForm({ ...form, date_change_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Name Change Policy</Label>
                      <Textarea rows={2} value={form.name_change_policy} onChange={(e) => setForm({ ...form, name_change_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>No-Show Policy</Label>
                      <Textarea rows={2} value={form.no_show_policy} onChange={(e) => setForm({ ...form, no_show_policy: e.target.value })} />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {editId ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {airlines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Plane className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No airline settings configured yet. Add one to get started.</p>
              <p className="text-xs text-muted-foreground mt-1">Default values (7 Kg cabin, 20 Kg check-in) will be used for airlines without custom settings.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Airline</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Cabin</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Cancellation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {airlines.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img src={`https://pics.avs.io/40/40/${a.airline_code}.png`} alt="" className="w-5 h-5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          <span className="font-medium">{a.airline_code}</span>
                          {a.airline_name && <span className="text-muted-foreground text-xs">({a.airline_name})</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.scope_type === "route" && a.from_code && a.to_code ? (
                          <Badge variant="secondary" className="text-xs">{a.from_code}→{a.to_code}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">All routes</Badge>
                        )}
                      </TableCell>
                      <TableCell>{a.cabin_baggage}</TableCell>
                      <TableCell>{a.checkin_baggage}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{a.cancellation_policy}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(a)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id, a.airline_code)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAirlineSettings;
