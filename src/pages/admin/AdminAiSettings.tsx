import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Brain, Plus, Trash2, Save, KeyRound, Sparkles, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Provider = "lovable" | "google" | "openai" | "anthropic";

interface FallbackEntry { provider: Provider; model: string }

interface TaskConfig {
  id: string;
  task_key: string;
  task_label: string;
  task_category: string;
  description: string | null;
  provider: Provider;
  model: string;
  fallback_chain: FallbackEntry[];
  temperature: number | null;
  max_tokens: number | null;
  enabled: boolean;
  is_locked: boolean;
  notes: string | null;
}

interface ProviderKey {
  id: string;
  provider: Provider;
  display_name: string;
  secret_name: string;
  base_url: string | null;
  is_configured: boolean;
  is_active: boolean;
  notes: string | null;
}

// Curated model lists per provider — admin can also type a custom value
const MODEL_OPTIONS: Record<Provider, string[]> = {
  lovable: [
    "google/gemini-3-flash-preview",
    "google/gemini-3.1-pro-preview",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
    "openai/gpt-5",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-5.2",
  ],
  google: [
    "gemini-3-flash-preview",
    "gemini-3-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash-lite",
  ],
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"],
};

const CATEGORY_LABELS: Record<string, string> = {
  "trip-planner": "Trip Planner",
  flights: "Flights",
  content: "Content & Blog",
  utilities: "Utilities",
  admin: "Admin Tools",
  general: "General",
};

export default function AdminAiSettings() {
  const [tasks, setTasks] = useState<TaskConfig[]>([]);
  const [providers, setProviders] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TaskConfig | null>(null);
  const [editingKey, setEditingKey] = useState<ProviderKey | null>(null);
  const [newKey, setNewKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const handleSaveKey = async () => {
    if (!editingKey) return;
    if (newKey.trim().length < 10) {
      toast.error("API key looks too short");
      return;
    }
    setSavingKey(true);
    const { data, error } = await supabase.functions.invoke("update-ai-provider-key", {
      body: { secret_name: editingKey.secret_name, api_key: newKey.trim() },
    });
    setSavingKey(false);
    if (error || (data as any)?.error) {
      toast.error("Failed to update key: " + (error?.message || (data as any)?.error));
      return;
    }
    // Mark provider as configured locally
    await supabase.from("ai_provider_keys").update({ is_configured: true }).eq("id", editingKey.id);
    setProviders((prev) => prev.map((p) => (p.id === editingKey.id ? { ...p, is_configured: true } : p)));
    toast.success(`${editingKey.display_name} key updated. Effective on next AI call.`);
    setEditingKey(null);
    setNewKey("");
  };

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("ai_task_configs").select("*").order("task_category").order("task_label"),
      supabase.from("ai_provider_keys").select("*").order("provider"),
    ]);
    setTasks((t as any) || []);
    setProviders((p as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveTask = async (task: TaskConfig) => {
    const { error } = await supabase
      .from("ai_task_configs")
      .update({
        provider: task.provider,
        model: task.model,
        fallback_chain: task.fallback_chain as any,
        temperature: task.temperature,
        max_tokens: task.max_tokens,
        enabled: task.enabled,
        notes: task.notes,
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success(`Updated ${task.task_label}`);
    setEditingTask(null);
    load();
  };

  const handleToggleEnabled = async (task: TaskConfig, enabled: boolean) => {
    await supabase.from("ai_task_configs").update({ enabled }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, enabled } : t)));
  };

  const handleToggleProvider = async (provider: ProviderKey, is_active: boolean) => {
    await supabase.from("ai_provider_keys").update({ is_active }).eq("id", provider.id);
    setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, is_active } : p)));
    toast.success(`${provider.display_name} ${is_active ? "enabled" : "disabled"}`);
  };

  const grouped = tasks.reduce<Record<string, TaskConfig[]>>((acc, t) => {
    (acc[t.task_category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick one model per task — the router automatically tries <strong>Lovable Gateway → Cloudflare Gateway → Direct provider</strong> for the same model. Add manual fallbacks below only if you want a different model on failure.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks"><Sparkles className="h-4 w-4 mr-2" />Task Routing</TabsTrigger>
            <TabsTrigger value="providers"><KeyRound className="h-4 w-4 mr-2" />Providers & Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-6 mt-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{CATEGORY_LABELS[cat] || cat}</CardTitle>
                  <CardDescription>{items.length} tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Primary Model</TableHead>
                        <TableHead>Fallbacks</TableHead>
                        <TableHead className="text-center">Enabled</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="font-medium">{task.task_label}</div>
                            {task.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{task.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {task.provider}/{task.model}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {task.fallback_chain?.length ? (
                              <div className="flex flex-wrap gap-1">
                                {task.fallback_chain.map((f, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {f.provider}/{f.model}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={task.enabled}
                              onCheckedChange={(v) => handleToggleEnabled(task, v)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setEditingTask(task)}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="providers" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider API Keys</CardTitle>
                <CardDescription>
                  Each provider reads its API key from a Supabase secret. To rotate a key, update the secret in Supabase
                  Edge Function Secrets — no redeploy required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Secret Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.display_name}</div>
                          {p.notes && <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{p.secret_name}</code>
                        </TableCell>
                        <TableCell>
                          {p.is_configured ? (
                            <Badge variant="secondary" className="text-[10px]">Configured</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">Not set</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                          {p.base_url || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={p.is_active}
                            onCheckedChange={(v) => handleToggleProvider(p, v)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingKey(p); setNewKey(""); }}
                            className="h-8 gap-1.5"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {p.is_configured ? "Rotate" : "Add Key"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  How to add or rotate a provider key
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>1. Click <strong>Add Key</strong> / <strong>Rotate</strong> next to a provider above to set a new API key.</p>
                <p>2. The key is stored encrypted in Supabase Vault and used automatically on the next AI call — no redeploy needed.</p>
                <p>3. Alternatively, you can also set the secret (e.g. <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>) directly in Edge Function Secrets — env vars take precedence over Vault.</p>
                <p>4. Use the <strong>Active</strong> toggle to disable a provider entirely without deleting the key.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          providers={providers.filter((p) => p.is_active)}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
        />
      )}

      <Dialog open={!!editingKey} onOpenChange={(o) => { if (!o) { setEditingKey(null); setNewKey(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {editingKey?.is_configured ? "Rotate" : "Add"} {editingKey?.display_name} API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Secret name</Label>
              <code className="block text-xs bg-muted px-2 py-1.5 rounded">{editingKey?.secret_name}</code>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New API Key</Label>
              <Input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="sk-... / AIza... / etc."
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Stored encrypted in Supabase Vault. Used automatically on the next AI call.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingKey(null); setNewKey(""); }} disabled={savingKey}>
              Cancel
            </Button>
            <Button onClick={handleSaveKey} disabled={savingKey || newKey.trim().length < 10}>
              {savingKey ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function TaskEditDialog({
  task, providers, onClose, onSave,
}: {
  task: TaskConfig;
  providers: ProviderKey[];
  onClose: () => void;
  onSave: (t: TaskConfig) => void;
}) {
  const [draft, setDraft] = useState<TaskConfig>(task);

  const updateFallback = (idx: number, key: "provider" | "model", value: string) => {
    setDraft((d) => {
      const fc = [...(d.fallback_chain || [])];
      fc[idx] = { ...fc[idx], [key]: value } as FallbackEntry;
      return { ...d, fallback_chain: fc };
    });
  };

  const addFallback = () => {
    setDraft((d) => ({
      ...d,
      fallback_chain: [...(d.fallback_chain || []), { provider: "lovable", model: "google/gemini-3-flash-preview" }],
    }));
  };

  const removeFallback = (idx: number) => {
    setDraft((d) => ({ ...d, fallback_chain: d.fallback_chain.filter((_, i) => i !== idx) }));
  };

  const ModelPicker = ({ provider, value, onChange }: { provider: Provider; value: string; onChange: (v: string) => void }) => {
    const opts = MODEL_OPTIONS[provider] || [];
    const isCustom = !opts.includes(value);
    return (
      <div className="flex gap-2">
        <Select value={isCustom ? "__custom" : value} onValueChange={(v) => onChange(v === "__custom" ? "" : v)}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opts.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            <SelectItem value="__custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {isCustom && (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter custom model id"
            className="flex-1"
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.task_label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {draft.description && (
            <p className="text-sm text-muted-foreground">{draft.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Primary Provider</Label>
              <Select
                value={draft.provider}
                onValueChange={(v) => setDraft({ ...draft, provider: v as Provider })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.provider} value={p.provider}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Primary Model</Label>
              <ModelPicker
                provider={draft.provider}
                value={draft.model}
                onChange={(v) => setDraft({ ...draft, model: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={2}
                value={draft.temperature ?? ""}
                onChange={(e) => setDraft({ ...draft, temperature: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={draft.max_tokens ?? ""}
                onChange={(e) => setDraft({ ...draft, max_tokens: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fallback Chain</Label>
              <Button size="sm" variant="outline" onClick={addFallback}>
                <Plus className="h-3 w-3 mr-1" /> Add fallback
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Optional.</strong> The router already auto-tries Lovable → Cloudflare → Direct for the primary model. Add entries here only to fall back to a <em>different</em> model.
            </p>
            <div className="space-y-2">
              {(draft.fallback_chain || []).map((f, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Select value={f.provider} onValueChange={(v) => updateFallback(i, "provider", v)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.provider} value={p.provider}>{p.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <ModelPicker
                      provider={f.provider}
                      value={f.model}
                      onChange={(v) => updateFallback(i, "model", v)}
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeFallback(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {(!draft.fallback_chain || draft.fallback_chain.length === 0) && (
                <p className="text-xs text-muted-foreground italic">No fallbacks. Errors will surface immediately.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Admin Notes (optional)</Label>
            <Textarea
              rows={2}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="e.g. switched to GPT-5 for better itinerary structure"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
