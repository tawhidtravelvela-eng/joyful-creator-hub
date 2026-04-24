import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tag, Plus, Loader2, Copy } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  product_type: string;
  expires_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  /** 'agent' for parent agents (max 25%), 'admin' for admins (up to 100%) */
  mode: "agent" | "admin";
}

const productLabels: Record<string, string> = {
  whitelabel: "White-Label",
  api_access: "API Access",
  both: "Both",
};

const WhitelabelCouponManagement = ({ userId, mode }: Props) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newProductType, setNewProductType] = useState<string>("both");
  const maxDiscount = mode === "agent" ? 25 : 100;

  useEffect(() => { fetchCoupons(); }, [userId]);

  const fetchCoupons = async () => {
    setLoading(true);
    const query = supabase
      .from("whitelabel_coupons" as any)
      .select("*")
      .eq("created_by", userId)
      .eq("created_by_type", mode)
      .order("created_at", { ascending: false });

    const { data } = await query;
    setCoupons((data || []) as any[]);
    setLoading(false);
  };

  const generateCode = () => {
    const prefix = mode === "agent" ? "AGT" : "WL";
    return `${prefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const handleCreate = async () => {
    const discount = Number(newDiscount);
    if (!discount || discount <= 0 || discount > maxDiscount) {
      toast.error(`Discount must be between 1% and ${maxDiscount}%`);
      return;
    }

    setCreating(true);
    const code = generateCode();
    const { error } = await supabase.from("whitelabel_coupons" as any).insert({
      code,
      discount_percent: discount,
      max_uses: newMaxUses ? Number(newMaxUses) : null,
      created_by: userId,
      created_by_type: mode,
      agent_id: mode === "agent" ? userId : null,
      product_type: newProductType,
      is_active: true,
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Coupon ${code} created!`);
      setShowCreate(false);
      setNewDiscount("");
      setNewMaxUses("");
      setNewProductType("both");
      fetchCoupons();
    }
    setCreating(false);
  };

  const toggleCoupon = async (id: string, isActive: boolean) => {
    await supabase.from("whitelabel_coupons" as any).update({ is_active: !isActive } as any).eq("id", id);
    fetchCoupons();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Discount Coupons</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "agent"
              ? `Create discount coupons for your sub-agents (max ${maxDiscount}%). Your commission = 25% minus discount given.`
              : "Create discount coupons for white-label and API access purchases."}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <Tag className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No coupons created yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Discount</TableHead>
                {mode === "agent" && <TableHead className="text-xs">Your Earning</TableHead>}
                <TableHead className="text-xs">Uses</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs font-bold">{c.code}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{productLabels[c.product_type] || c.product_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-primary">{c.discount_percent}%</TableCell>
                  {mode === "agent" && (
                    <TableCell className="text-sm text-muted-foreground">{25 - Number(c.discount_percent)}%</TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground">
                    {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.is_active ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleCoupon(c.id, c.is_active)}>
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Discount Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Applies To</Label>
              <Select value={newProductType} onValueChange={setNewProductType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both (White-Label & API)</SelectItem>
                  <SelectItem value="whitelabel">White-Label Only</SelectItem>
                  <SelectItem value="api_access">API Access Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Discount Percentage (max {maxDiscount}%)</Label>
              <Input
                type="number"
                min={1}
                max={maxDiscount}
                value={newDiscount}
                onChange={e => setNewDiscount(e.target.value)}
                placeholder={`1 - ${maxDiscount}`}
              />
              {mode === "agent" && newDiscount && Number(newDiscount) > 0 && Number(newDiscount) <= 25 && (
                <p className="text-xs text-muted-foreground">
                  You'll earn <strong className="text-primary">{25 - Number(newDiscount)}%</strong> commission per purchase.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Uses (leave empty for unlimited)</Label>
              <Input
                type="number"
                min={1}
                value={newMaxUses}
                onChange={e => setNewMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newDiscount}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhitelabelCouponManagement;
