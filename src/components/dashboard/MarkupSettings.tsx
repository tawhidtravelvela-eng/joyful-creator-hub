import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Loader2, Save, Percent, Hash
} from "lucide-react";

interface MarkupSettingsProps {
  userId: string;
}

interface MarkupSetting {
  id?: string;
  applies_to: string;
  markup_type: string;
  markup_value: number;
}

const MarkupSettings = ({ userId }: MarkupSettingsProps) => {
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subAgentMarkup, setSubAgentMarkup] = useState<MarkupSetting>({
    applies_to: "sub_agents", markup_type: "fixed", markup_value: 0,
  });
  const [b2cMarkup, setB2cMarkup] = useState<MarkupSetting>({
    applies_to: "b2c", markup_type: "percentage", markup_value: 0,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("agent_markup_settings" as any)
      .select("*")
      .eq("user_id", userId);

    const settings = (data || []) as any[];
    const sa = settings.find((s: any) => s.applies_to === "sub_agents");
    const b2c = settings.find((s: any) => s.applies_to === "b2c");

    if (sa) setSubAgentMarkup({ id: sa.id, applies_to: "sub_agents", markup_type: sa.markup_type, markup_value: Number(sa.markup_value) });
    if (b2c) setB2cMarkup({ id: b2c.id, applies_to: "b2c", markup_type: b2c.markup_type, markup_value: Number(b2c.markup_value) });
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (setting: MarkupSetting) => {
    setSaving(true);
    const payload = {
      user_id: userId,
      applies_to: setting.applies_to,
      markup_type: setting.markup_type,
      markup_value: setting.markup_value,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (setting.id) {
      ({ error } = await supabase
        .from("agent_markup_settings" as any)
        .update(payload as any)
        .eq("id", setting.id));
    } else {
      ({ error } = await supabase
        .from("agent_markup_settings" as any)
        .upsert(payload as any, { onConflict: "user_id,applies_to" }));
    }

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`${setting.applies_to === "sub_agents" ? "Sub-Agent" : "B2C"} markup saved`);
      fetchSettings();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  const renderMarkupCard = (
    title: string,
    description: string,
    setting: MarkupSetting,
    setSetting: (s: MarkupSetting) => void,
    icon: React.ReactNode,
    color: string,
  ) => (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Markup Type</Label>
            <Select
              value={setting.markup_type}
              onValueChange={(v) => setSetting({ ...setting, markup_type: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  <span className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Percentage</span>
                </SelectItem>
                <SelectItem value="fixed">
                  <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Fixed Amount</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              {setting.markup_type === "percentage" ? "Markup (%)" : "Markup Amount"}
            </Label>
            <Input
              type="number"
              step="any"
              value={setting.markup_value}
              onChange={(e) => setSetting({ ...setting, markup_value: parseFloat(e.target.value) || 0 })}
              className="mt-1"
            />
          </div>
        </div>

        {setting.markup_value < 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Negative markup: you'll subsidize {Math.abs(setting.markup_value)}{setting.markup_type === "percentage" ? "%" : ""} from your main wallet per booking.
          </div>
        )}

        {setting.markup_value > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] text-xs">
            <ArrowUpRight className="w-3.5 h-3.5" />
            You'll earn {setting.markup_value}{setting.markup_type === "percentage" ? "%" : ""} {setting.markup_type === "fixed" ? "per booking" : "of base cost per booking"}.
          </div>
        )}

        <Button
          onClick={() => handleSave(setting)}
          disabled={saving}
          className="w-full"
          size="sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save {title}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Markup Settings</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Configure markups applied to bookings from your sub-agents and B2C customers.
        Negative values mean you subsidize the difference from your wallet.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {renderMarkupCard(
          "Sub-Agent Markup",
          "Applied on top of Travel Vela's base cost for sub-agent bookings. Earned to your sub-agent earnings wallet.",
          subAgentMarkup,
          setSubAgentMarkup,
          <TrendingUp className="w-4 h-4 text-primary" />,
          "primary",
        )}
        {renderMarkupCard(
          "B2C Customer Markup",
          "Applied on top of base cost for direct customer bookings on your white-label site.",
          b2cMarkup,
          setB2cMarkup,
          <DollarSign className="w-4 h-4 text-accent" />,
          "accent",
        )}
      </div>

      {/* Example calculation */}
      <Card className="mt-6 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Example Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Scenario</TableHead>
                <TableHead className="text-xs">Base Cost</TableHead>
                <TableHead className="text-xs">Your Markup</TableHead>
                <TableHead className="text-xs">Total Charged</TableHead>
                <TableHead className="text-xs">Your Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "Sub-Agent Booking", markup: subAgentMarkup },
                { label: "B2C Customer Booking", markup: b2cMarkup },
              ].map(({ label, markup }) => {
                const base = 500;
                const profit = markup.markup_type === "percentage"
                  ? Math.round(base * markup.markup_value) / 100
                  : markup.markup_value;
                return (
                  <TableRow key={label}>
                    <TableCell className="text-sm font-medium">{label}</TableCell>
                    <TableCell className="text-sm">{formatPrice(base)}</TableCell>
                    <TableCell className="text-sm">
                      {markup.markup_value}{markup.markup_type === "percentage" ? "%" : ""}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{formatPrice(base + profit)}</TableCell>
                    <TableCell>
                      <Badge variant={profit >= 0 ? "default" : "destructive"} className="text-xs">
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MarkupSettings;
