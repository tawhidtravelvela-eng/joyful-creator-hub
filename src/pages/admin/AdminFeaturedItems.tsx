import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Star, Plus, Trash2, Loader2, Plane, Building2, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FeaturedItem {
  id: string;
  item_type: string;
  match_value: string;
  match_field: string;
  city: string;
  priority_boost: number;
  reason: string;
  is_active: boolean;
  created_at: string;
}

const TYPE_ICONS = { airline: Plane, hotel: Building2, activity: Map };
const TYPE_COLORS = { airline: "text-blue-500", hotel: "text-amber-500", activity: "text-green-500" };

export default function AdminFeaturedItems() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newType, setNewType] = useState<string>("airline");
  const [newField, setNewField] = useState<string>("name");
  const [newValue, setNewValue] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newBoost, setNewBoost] = useState(10);
  const [newReason, setNewReason] = useState("");

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("featured_travel_items").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); } else { setItems(data || []); }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const addItem = async () => {
    if (!newValue.trim()) { toast.error("Match value is required"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("featured_travel_items").insert({
      item_type: newType, match_value: newValue.trim(), match_field: newField,
      city: newCity.trim(), priority_boost: newBoost, reason: newReason.trim(),
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Featured item added");
      setNewValue(""); setNewCity(""); setNewReason(""); setNewBoost(10);
      fetchItems();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await (supabase as any).from("featured_travel_items").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: active } : i));
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await (supabase as any).from("featured_travel_items").delete().eq("id", id);
    if (error) { toast.error(error.message); } else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Item deleted");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Star className="h-6 w-6 text-amber-500" /> Featured Travel Items</h1>
          <p className="text-muted-foreground mt-1">Admin-featured airlines, hotels, and activities get priority in AI trip planning. User experience still comes first.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Add Featured Item</CardTitle><CardDescription>Featured items are boosted in AI selection but won't override traveler preferences.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airline">✈️ Airline</SelectItem>
                    <SelectItem value="hotel">🏨 Hotel</SelectItem>
                    <SelectItem value="activity">🎯 Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Match By</Label>
                <Select value={newField} onValueChange={setNewField}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (contains)</SelectItem>
                    <SelectItem value="code">Code (exact)</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority Boost (1-20)</Label>
                <Input type="number" min={1} max={20} value={newBoost} onChange={e => setNewBoost(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Match Value *</Label>
                <Input placeholder={newType === "airline" ? "e.g. Singapore Airlines or SQ" : newType === "hotel" ? "e.g. Marina Bay Sands" : "e.g. Gardens by the Bay"} value={newValue} onChange={e => setNewValue(e.target.value)} />
              </div>
              <div>
                <Label>City (optional)</Label>
                <Input placeholder="e.g. Singapore (leave empty for all)" value={newCity} onChange={e => setNewCity(e.target.value)} />
              </div>
              <div>
                <Label>Reason (shown to AI)</Label>
                <Input placeholder="e.g. Partner airline, Best service" value={newReason} onChange={e => setNewReason(e.target.value)} />
              </div>
            </div>
            <Button onClick={addItem} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Add Featured Item</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Active Featured Items ({items.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No featured items yet. Add one above to boost it in trip planning.</p>
            ) : (
              <div className="space-y-3">
                {items.map(item => {
                  const Icon = TYPE_ICONS[item.item_type as keyof typeof TYPE_ICONS] || Star;
                  const color = TYPE_COLORS[item.item_type as keyof typeof TYPE_COLORS] || "";
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{item.match_value}</span>
                            <Badge variant="outline" className="text-xs">{item.item_type}</Badge>
                            <Badge variant="secondary" className="text-xs">by {item.match_field}</Badge>
                            {item.city && <Badge variant="secondary" className="text-xs">📍 {item.city}</Badge>}
                            <Badge variant="secondary" className="text-xs">boost: {item.priority_boost}</Badge>
                          </div>
                          {item.reason && <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={item.is_active} onCheckedChange={v => toggleActive(item.id, v)} />
                        <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
