import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, User } from "lucide-react";
import { useAdminTenantFilter } from "@/hooks/useAdminTenantFilter";

interface AuthorProfile {
  id: string;
  name: string;
  slug: string;
  bio: string;
  region: string;
  country: string | null;
  expertise: string[];
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

const emptyAuthor = {
  name: "",
  slug: "",
  bio: "",
  region: "south-asia",
  country: "",
  expertise: [] as string[],
  is_active: true,
};

const AdminBlogAuthors = () => {
  const [authors, setAuthors] = useState<AuthorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAuthor);
  const [expertiseInput, setExpertiseInput] = useState("");
  const { adminTenantId } = useAdminTenantFilter();

  const fetchAuthors = async () => {
    setLoading(true);
    let query = supabase.from("blog_author_profiles").select("*").order("name");
    if (adminTenantId) {
      query = query.eq("tenant_id", adminTenantId);
    } else {
      query = query.is("tenant_id", null);
    }
    const { data } = await query;
    if (data) setAuthors(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchAuthors(); }, [adminTenantId]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyAuthor);
    setExpertiseInput("");
    setDialogOpen(true);
  };

  const openEdit = (author: AuthorProfile) => {
    setEditingId(author.id);
    setForm({
      name: author.name,
      slug: author.slug,
      bio: author.bio,
      region: author.region,
      country: author.country || "",
      expertise: author.expertise || [],
      is_active: author.is_active ?? true,
    });
    setExpertiseInput("");
    setDialogOpen(true);
  };

  const addExpertise = () => {
    const t = expertiseInput.trim().toLowerCase();
    if (t && !form.expertise.includes(t)) {
      setForm((f) => ({ ...f, expertise: [...f.expertise, t] }));
      setExpertiseInput("");
    }
  };

  const removeExpertise = (tag: string) => {
    setForm((f) => ({ ...f, expertise: f.expertise.filter((e) => e !== tag) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.bio) {
      toast.error("Name and bio are required");
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      bio: form.bio,
      region: form.region,
      country: form.country || null,
      expertise: form.expertise,
      is_active: form.is_active,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("blog_author_profiles").update(payload).eq("id", editingId));
    } else {
      if (adminTenantId) payload.tenant_id = adminTenantId;
      ({ error } = await supabase.from("blog_author_profiles").insert(payload));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingId ? "Author updated" : "Author created");
      setDialogOpen(false);
      fetchAuthors();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this author profile?")) return;
    const { error } = await supabase.from("blog_author_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Author deleted"); fetchAuthors(); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("blog_author_profiles").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchAuthors();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage author profiles used for blog posts. These names will appear as post authors.</p>
        <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Author</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Expertise</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authors.map((author) => (
                <TableRow key={author.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{author.name}</p>
                        <p className="text-xs text-muted-foreground">{author.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{author.region} {author.country ? `(${author.country})` : ""}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(author.expertise || []).slice(0, 3).map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={author.is_active} onCheckedChange={() => toggleActive(author.id, author.is_active)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(author)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(author.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {authors.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No author profiles yet. Add one to get started.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Author" : "New Author Profile"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) }))} placeholder="e.g. Anisur Rahman" className="mt-1" />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="anisur-rahman" className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Bio</Label>
              <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Short author bio..." className="mt-1" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region</Label>
                <Input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="south-asia" className="mt-1" />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Bangladesh" className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Expertise Tags</Label>
              <div className="mt-1 flex gap-2 flex-wrap items-center">
                {form.expertise.map((e) => (
                  <Badge key={e} variant="secondary" className="gap-1 text-xs">
                    {e}
                    <button onClick={() => removeExpertise(e)} className="ml-0.5">×</button>
                  </Badge>
                ))}
                <Input
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); } }}
                  placeholder="Add tag & Enter"
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlogAuthors;
