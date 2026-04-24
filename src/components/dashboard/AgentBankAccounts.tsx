import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AgentBankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  swift_code: string | null;
  routing_number: string | null;
  currency: string;
  country: string | null;
  logo_url: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
}

const emptyForm = {
  bank_name: "",
  account_name: "",
  account_number: "",
  branch: "",
  swift_code: "",
  routing_number: "",
  currency: "USD",
  country: "",
  logo_url: "",
  instructions: "",
  is_active: true,
  sort_order: 0,
};

interface Props {
  userId: string;
}

const AgentBankAccounts = ({ userId }: Props) => {
  const [banks, setBanks] = useState<AgentBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentBankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBanks(); }, [userId]);

  const fetchBanks = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("agent_bank_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    setBanks(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (bank: AgentBankAccount) => {
    setEditing(bank);
    setForm({
      bank_name: bank.bank_name,
      account_name: bank.account_name,
      account_number: bank.account_number,
      branch: bank.branch || "",
      swift_code: bank.swift_code || "",
      routing_number: bank.routing_number || "",
      currency: bank.currency,
      country: bank.country || "",
      logo_url: bank.logo_url || "",
      instructions: bank.instructions || "",
      is_active: bank.is_active,
      sort_order: bank.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank_name || !form.account_number || !form.currency) {
      toast.error("Bank name, account number, and currency are required");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      bank_name: form.bank_name,
      account_name: form.account_name,
      account_number: form.account_number,
      branch: form.branch || null,
      swift_code: form.swift_code || null,
      routing_number: form.routing_number || null,
      currency: form.currency.toUpperCase(),
      country: form.country || null,
      logo_url: form.logo_url || null,
      instructions: form.instructions || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (editing) {
      const { error } = await (supabase as any).from("agent_bank_accounts").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Bank account updated");
    } else {
      const { error } = await (supabase as any).from("agent_bank_accounts").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Bank account added");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchBanks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bank account?")) return;
    const { error } = await (supabase as any).from("agent_bank_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bank account deleted");
    fetchBanks();
  };

  const toggleActive = async (bank: AgentBankAccount) => {
    const { error } = await (supabase as any).from("agent_bank_accounts").update({ is_active: !bank.is_active }).eq("id", bank.id);
    if (error) { toast.error(error.message); return; }
    fetchBanks();
  };

  const updateField = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  if (loading) {
    return <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Your Bank Accounts</h3>
          <p className="text-xs text-muted-foreground">Bank accounts shown to customers for offline payments on your white-label site</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Bank</Button>
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No bank accounts configured yet.</p>
            <Button onClick={openCreate} size="sm" className="mt-3 gap-1.5"><Plus className="w-4 h-4" /> Add First Bank</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {bank.logo_url ? (
                          <img src={bank.logo_url} alt="" className="w-6 h-6 rounded object-contain" />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">{bank.bank_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-foreground">{bank.account_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{bank.account_number}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{bank.currency}</Badge></TableCell>
                    <TableCell><Switch checked={bank.is_active} onCheckedChange={() => toggleActive(bank)} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(bank)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(bank.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editing ? "Edit Bank Account" : "Add Bank Account"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Bank Name *</Label><Input value={form.bank_name} onChange={e => updateField("bank_name", e.target.value)} className="mt-1" placeholder="e.g. HSBC" /></div>
              <div><Label className="text-xs">Currency *</Label><Input value={form.currency} onChange={e => updateField("currency", e.target.value.toUpperCase())} className="mt-1" placeholder="USD" maxLength={3} /></div>
            </div>
            <div><Label className="text-xs">Account Name</Label><Input value={form.account_name} onChange={e => updateField("account_name", e.target.value)} className="mt-1" placeholder="Account holder name" /></div>
            <div><Label className="text-xs">Account Number *</Label><Input value={form.account_number} onChange={e => updateField("account_number", e.target.value)} className="mt-1" placeholder="Account number or IBAN" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Branch</Label><Input value={form.branch} onChange={e => updateField("branch", e.target.value)} className="mt-1" placeholder="Branch name" /></div>
              <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={e => updateField("country", e.target.value)} className="mt-1" placeholder="e.g. Bangladesh" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">SWIFT Code</Label><Input value={form.swift_code} onChange={e => updateField("swift_code", e.target.value)} className="mt-1" placeholder="HSBCBDDX" /></div>
              <div><Label className="text-xs">Routing Number</Label><Input value={form.routing_number} onChange={e => updateField("routing_number", e.target.value)} className="mt-1" placeholder="Optional" /></div>
            </div>
            <div><Label className="text-xs">Logo URL</Label><Input value={form.logo_url} onChange={e => updateField("logo_url", e.target.value)} className="mt-1" placeholder="https://..." /></div>
            <div>
              <Label className="text-xs">Instructions for Customers</Label>
              <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring" value={form.instructions} onChange={e => updateField("instructions", e.target.value)} placeholder="e.g. Please include your booking ID as transfer reference..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => updateField("sort_order", parseInt(e.target.value) || 0)} className="mt-1" /></div>
              <div className="flex items-end gap-2 pb-1"><Switch checked={form.is_active} onCheckedChange={v => updateField("is_active", v)} /><Label className="text-xs">Active</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving…</> : editing ? "Update" : "Add Bank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentBankAccounts;
