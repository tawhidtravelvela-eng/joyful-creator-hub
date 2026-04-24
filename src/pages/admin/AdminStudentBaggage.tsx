import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, GraduationCap, Luggage, ShieldCheck, Percent } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface StudentSetting {
  id: string;
  airline_code: string;
  airline_name: string;
  scope_type: "all" | "country" | "route";
  from_country: string;
  to_country: string;
  from_code: string;
  to_code: string;
  cabin_baggage: string;
  checkin_baggage: string;
  discount_policy: string;
  cancellation_policy: string;
  date_change_policy: string;
  name_change_policy: string;
  no_show_policy: string;
  is_active: boolean;
}

const emptyForm: Omit<StudentSetting, "id"> = {
  airline_code: "",
  airline_name: "",
  scope_type: "all",
  from_country: "",
  to_country: "",
  from_code: "",
  to_code: "",
  cabin_baggage: "",
  checkin_baggage: "",
  discount_policy: "",
  cancellation_policy: "",
  date_change_policy: "",
  name_change_policy: "",
  no_show_policy: "",
  is_active: true,
};

const AdminStudentBaggage = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StudentSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<StudentSetting, "id">>(emptyForm);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("student_airline_settings" as any)
        .select("*")
        .order("airline_code");
      if (error) throw error;
      setSettings((data as any[]) || []);
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

  const openEdit = (s: StudentSetting) => {
    setEditId(s.id);
    setForm({
      airline_code: s.airline_code,
      airline_name: s.airline_name,
      scope_type: s.scope_type,
      from_country: s.from_country,
      to_country: s.to_country,
      from_code: s.from_code,
      to_code: s.to_code,
      cabin_baggage: s.cabin_baggage,
      checkin_baggage: s.checkin_baggage,
      discount_policy: s.discount_policy,
      cancellation_policy: s.cancellation_policy,
      date_change_policy: s.date_change_policy,
      name_change_policy: s.name_change_policy,
      no_show_policy: s.no_show_policy,
      is_active: s.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.airline_code.trim()) {
      toast({ title: "Airline code is required", variant: "destructive" });
      return;
    }
    if (form.scope_type === "route" && (!form.from_code.trim() || !form.to_code.trim())) {
      toast({ title: "Route scope requires From and To airport codes", variant: "destructive" });
      return;
    }
    if (form.scope_type === "country" && (!form.from_country.trim() || !form.to_country.trim())) {
      toast({ title: "Country scope requires From and To country names", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("student_airline_settings" as any).update(form as any).eq("id", editId);
        if (error) throw error;
        toast({ title: "Updated", description: `Student settings for ${form.airline_code} updated.` });
      } else {
        const { error } = await supabase.from("student_airline_settings" as any).insert(form as any);
        if (error) throw error;
        toast({ title: "Added", description: `Student settings for ${form.airline_code} saved.` });
      }
      setDialogOpen(false);
      fetchSettings();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete student settings for ${code}?`)) return;
    try {
      const { error } = await supabase.from("student_airline_settings" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: `${code} student settings removed.` });
      fetchSettings();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const scopeLabel = (s: StudentSetting) => {
    if (s.scope_type === "route") return `${s.from_code} → ${s.to_code}`;
    if (s.scope_type === "country") return `${s.from_country} → ${s.to_country}`;
    return "All Routes";
  };

  const scopeVariant = (t: string) => {
    if (t === "route") return "default";
    if (t === "country") return "secondary";
    return "outline";
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
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-6 h-6" />
              Student Baggage & Policy Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure extra baggage allowances and discount policies for student fares. These apply on top of regular airline settings.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Rule</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit" : "Add"} Student Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Airline */}
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

                {/* Scope */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Route Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Apply To</Label>
                      <Select value={form.scope_type} onValueChange={(v) => setForm({ ...form, scope_type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Routes</SelectItem>
                          <SelectItem value="country">Specific Countries</SelectItem>
                          <SelectItem value="route">Specific Route</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.scope_type === "country" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>From Country *</Label>
                          <Input placeholder="e.g. Bangladesh" value={form.from_country} onChange={(e) => setForm({ ...form, from_country: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>To Country *</Label>
                          <Input placeholder="e.g. India" value={form.to_country} onChange={(e) => setForm({ ...form, to_country: e.target.value })} />
                        </div>
                      </div>
                    )}
                    {form.scope_type === "route" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>From Airport (IATA) *</Label>
                          <Input placeholder="e.g. DAC" value={form.from_code} onChange={(e) => setForm({ ...form, from_code: e.target.value.toUpperCase() })} maxLength={3} />
                        </div>
                        <div className="space-y-2">
                          <Label>To Airport (IATA) *</Label>
                          <Input placeholder="e.g. DEL" value={form.to_code} onChange={(e) => setForm({ ...form, to_code: e.target.value.toUpperCase() })} maxLength={3} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Baggage */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Luggage className="w-4 h-4" />Student Baggage Allowance</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cabin Baggage</Label>
                      <Input placeholder="e.g. 10 Kg" value={form.cabin_baggage} onChange={(e) => setForm({ ...form, cabin_baggage: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-in Baggage</Label>
                      <Input placeholder="e.g. 40 Kg" value={form.checkin_baggage} onChange={(e) => setForm({ ...form, checkin_baggage: e.target.value })} />
                    </div>
                  </CardContent>
                </Card>

                {/* Discount */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4" />Student Discount Policy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea rows={3} placeholder="e.g. 10% discount on base fare for verified students. Valid student ID required at check-in." value={form.discount_policy} onChange={(e) => setForm({ ...form, discount_policy: e.target.value })} />
                  </CardContent>
                </Card>

                {/* Policies */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Student-Specific Policies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cancellation Policy</Label>
                      <Textarea rows={2} placeholder="Leave empty to use regular policy" value={form.cancellation_policy} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date Change Policy</Label>
                      <Textarea rows={2} placeholder="Leave empty to use regular policy" value={form.date_change_policy} onChange={(e) => setForm({ ...form, date_change_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Name Change Policy</Label>
                      <Textarea rows={2} placeholder="Leave empty to use regular policy" value={form.name_change_policy} onChange={(e) => setForm({ ...form, name_change_policy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>No-Show Policy</Label>
                      <Textarea rows={2} placeholder="Leave empty to use regular policy" value={form.no_show_policy} onChange={(e) => setForm({ ...form, no_show_policy: e.target.value })} />
                    </div>
                  </CardContent>
                </Card>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Active</Label>
                </div>

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

        {settings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No student baggage rules configured yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Add rules to override regular baggage/policies for student ticket types.</p>
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
                    <TableHead>Discount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img src={`https://pics.avs.io/40/40/${s.airline_code}.png`} alt="" className="w-5 h-5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          <span className="font-medium">{s.airline_code}</span>
                          {s.airline_name && <span className="text-muted-foreground text-xs">({s.airline_name})</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={scopeVariant(s.scope_type) as any}>{scopeLabel(s)}</Badge>
                      </TableCell>
                      <TableCell>{s.cabin_baggage || "—"}</TableCell>
                      <TableCell>{s.checkin_baggage || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{s.discount_policy || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id, s.airline_code)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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

export default AdminStudentBaggage;
