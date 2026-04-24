import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldBan, ShieldCheck, Loader2, Check, X, Building2, Briefcase, User, PauseCircle, PlayCircle, Plus, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminTenantFilter } from "@/hooks/useAdminTenantFilter";
import { useAuth } from "@/contexts/AuthContext";

interface UserRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  is_blocked: boolean;
  user_type: string;
  company_name: string;
  company_address: string;
  phone: string;
  trade_license: string;
  approval_status: string;
  billing_currency: string;
  allowed_currencies: string[];
  credit_limit: number;
  tenant_id: string | null;
  bookingCount: number;
  totalSpent: number;
}

interface UserForm {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  user_type: string;
  company_name: string;
  company_address: string;
  trade_license: string;
  billing_currency: string;
  allowed_currencies: string[];
  credit_limit: string;
  tenant_id: string;
}

const emptyForm: UserForm = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  user_type: "b2c",
  company_name: "",
  company_address: "",
  trade_license: "",
  billing_currency: "USD",
  allowed_currencies: [],
  credit_limit: "0",
  tenant_id: "",
};

const userTypeLabels: Record<string, { label: string; icon: typeof User }> = {
  b2c: { label: "B2C", icon: User },
  corporate: { label: "Corporate", icon: Building2 },
  b2b_agent: { label: "B2B Agent", icon: Briefcase },
};

const approvalColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
};

interface TenantOption {
  id: string;
  name: string;
}

type SortKey = "full_name" | "bookingCount" | "totalSpent" | "created_at" | "credit_limit";
type SortDir = "asc" | "desc";

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { formatPrice } = useCurrency();
  const { adminTenantId, isSuperAdmin } = useAdminTenantFilter();
  const { user: currentUser } = useAuth();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "full_name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedUsers = [...users].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "full_name") {
      return dir * (a.full_name || "").localeCompare(b.full_name || "");
    }
    if (sortKey === "created_at") {
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return dir * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    let profilesQuery = supabase.from("profiles").select("*");
    let bookingsQuery = supabase.from("bookings").select("user_id, total");

    if (adminTenantId) {
      profilesQuery = profilesQuery.eq("tenant_id", adminTenantId);
      bookingsQuery = bookingsQuery.eq("tenant_id", adminTenantId);
    }

    const [profilesRes, bookingsRes, tenantsRes] = await Promise.all([
      profilesQuery,
      bookingsQuery,
      supabase.from("tenants").select("id, name").eq("is_active", true).order("name"),
    ]);

    const profiles = profilesRes.data || [];
    const bookings = bookingsRes.data || [];
    setTenants((tenantsRes.data || []) as TenantOption[]);

    const bookingMap = new Map<string, { count: number; spent: number }>();
    bookings.forEach((b) => {
      const entry = bookingMap.get(b.user_id) || { count: 0, spent: 0 };
      entry.count += 1;
      entry.spent += Number(b.total);
      bookingMap.set(b.user_id, entry);
    });

    setUsers(
      profiles.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        is_blocked: p.is_blocked ?? false,
        user_type: p.user_type || "b2c",
        company_name: p.company_name || "",
        company_address: p.company_address || "",
        phone: p.phone || "",
        trade_license: p.trade_license || "",
        approval_status: p.approval_status || "approved",
        billing_currency: p.billing_currency || "USD",
        allowed_currencies: Array.isArray(p.allowed_currencies) ? p.allowed_currencies.filter(Boolean) : [],
        credit_limit: p.credit_limit || 0,
        tenant_id: p.tenant_id || null,
        bookingCount: bookingMap.get(p.user_id)?.count || 0,
        totalSpent: bookingMap.get(p.user_id)?.spent || 0,
      }))
    );
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingUser(null);
    setForm({ ...emptyForm, tenant_id: adminTenantId || "" });
    setDialogOpen(true);
  };

  const openEditDialog = (u: UserRow) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      password: "",
      phone: u.phone || "",
      user_type: u.user_type,
      company_name: u.company_name,
      company_address: u.company_address,
      trade_license: u.trade_license,
      billing_currency: u.billing_currency,
      allowed_currencies: u.allowed_currencies || [],
      credit_limit: String(u.credit_limit),
      tenant_id: u.tenant_id || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);

    if (editingUser) {
      // Update existing profile
      const updateData: Record<string, any> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        user_type: form.user_type,
        company_name: form.company_name.trim() || null,
        company_address: form.company_address.trim() || null,
        trade_license: form.trade_license.trim() || null,
        billing_currency: form.billing_currency,
        allowed_currencies: form.allowed_currencies.filter(c => c && c !== form.billing_currency),
        credit_limit: Number(form.credit_limit) || 0,
        tenant_id: form.tenant_id || null,
      };

      const { error } = await (supabase as any)
        .from("profiles")
        .update(updateData)
        .eq("id", editingUser.id);

      if (error) {
        toast.error("Failed to update user: " + error.message);
      } else {
        toast.success("User updated successfully");
        setDialogOpen(false);
        fetchUsers();
      }
    } else {
      // Create new user via admin edge function (auto-confirms email)
      if (!form.password || form.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        setSubmitting(false);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          user_type: form.user_type,
          company_name: form.company_name.trim() || null,
          company_address: form.company_address.trim() || null,
          trade_license: form.trade_license.trim() || null,
          billing_currency: form.billing_currency,
          allowed_currencies: form.allowed_currencies.filter(c => c && c !== form.billing_currency),
          credit_limit: Number(form.credit_limit) || 0,
          tenant_id: form.tenant_id || null,
        },
      });

      if (fnError) {
        toast.error("Failed to create user: " + fnError.message);
      } else if (fnData?.error) {
        toast.error("Failed to create user: " + fnData.error);
      } else {
        toast.success("User created successfully. They can log in immediately.");
        setDialogOpen(false);
        fetchUsers();
      }
    }
    setSubmitting(false);
  };

  const toggleBlock = async (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return;
    const newBlocked = !user.is_blocked;

    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: newBlocked } as any)
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update user");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, is_blocked: newBlocked } : u))
    );
    toast.success(`${user.full_name || user.email} ${newBlocked ? "blocked" : "unblocked"}`);
  };

  const handleApproval = async (profileId: string, action: "approved" | "rejected") => {
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        approval_status: action,
        is_approved: action === "approved",
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`User ${action}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === profileId ? { ...u, approval_status: action } : u
        )
      );
    }
  };

  const handleSuspendToggle = async (profileId: string, currentStatus: string) => {
    const newStatus = currentStatus === "suspended" ? "approved" : "suspended";
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        approval_status: newStatus,
        is_approved: newStatus === "approved",
      })
      .eq("id", profileId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Agent ${newStatus === "suspended" ? "suspended" : "reactivated"}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === profileId ? { ...u, approval_status: newStatus } : u
        )
      );
    }
  };

  const handleCurrencyChange = async (userId: string, newCurrency: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ billing_currency: newCurrency } as any)
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update currency");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, billing_currency: newCurrency } : u))
    );
    toast.success("Billing currency updated");
  };

  const update = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No users found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                      <span className="inline-flex items-center">Name <SortIcon col="full_name" /></span>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                      <span className="inline-flex items-center">Joined <SortIcon col="created_at" /></span>
                    </TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("bookingCount")}>
                      <span className="inline-flex items-center">Bookings <SortIcon col="bookingCount" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("totalSpent")}>
                      <span className="inline-flex items-center">Spent <SortIcon col="totalSpent" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("credit_limit")}>
                      <span className="inline-flex items-center">Balance <SortIcon col="credit_limit" /></span>
                    </TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((u) => {
                    const typeInfo = userTypeLabels[u.user_type] || userTypeLabels.b2c;
                    const TypeIcon = typeInfo.icon;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.full_name || "—"}</p>
                            {u.company_name && <p className="text-xs text-muted-foreground">{u.company_name}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <TypeIcon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email || "—"}</TableCell>
                        <TableCell className="text-sm">{u.created_at.slice(0, 10)}</TableCell>
                        <TableCell>
                          <Select value={u.billing_currency} onValueChange={(v) => handleCurrencyChange(u.user_id, v)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(CURRENCIES).map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{u.bookingCount}</TableCell>
                        <TableCell className="font-semibold">{formatPrice(u.totalSpent)}</TableCell>
                        <TableCell className="text-sm">{formatPrice(u.credit_limit)}</TableCell>
                        <TableCell>
                          {u.user_type !== "b2c" ? (
                            <Badge className={`text-xs ${approvalColors[u.approval_status] || ""}`}>
                              {u.approval_status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={!u.is_blocked ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                            {u.is_blocked ? "Blocked" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(u)}
                              title="Edit User"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {u.user_type !== "b2c" && u.approval_status === "pending" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleApproval(u.id, "approved")}
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  onClick={() => handleApproval(u.id, "rejected")}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {u.user_type === "b2b_agent" && u.approval_status !== "pending" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleSuspendToggle(u.id, u.approval_status)}
                                title={u.approval_status === "suspended" ? "Reactivate Agent" : "Suspend Agent"}
                              >
                                {u.approval_status === "suspended" ? (
                                  <PlayCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <PauseCircle className="h-4 w-4 text-orange-500" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleBlock(u.user_id)}
                              title={u.is_blocked ? "Unblock" : "Block"}
                            >
                              {u.is_blocked ? (
                                <ShieldCheck className="h-4 w-4 text-success" />
                              ) : (
                                <ShieldBan className="h-4 w-4 text-warning" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="John Doe" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="user@example.com"
                  disabled={!!editingUser}
                />
              </div>
            </div>

            {!editingUser && (
              <div>
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Min 6 characters" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+880..." />
              </div>
              <div>
                <Label>User Type</Label>
                <Select value={form.user_type} onValueChange={(v) => update("user_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c">B2C (Customer)</SelectItem>
                    <SelectItem value="b2b_agent">B2B Agent</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.user_type === "b2b_agent" || form.user_type === "corporate") && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Company Name</Label>
                    <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Agency Ltd." />
                  </div>
                  <div>
                    <Label>Trade License</Label>
                    <Input value={form.trade_license} onChange={(e) => update("trade_license", e.target.value)} placeholder="TL-XXXXX" />
                  </div>
                </div>
                <div>
                  <Label>Company Address</Label>
                  <Input value={form.company_address} onChange={(e) => update("company_address", e.target.value)} placeholder="123 Business St..." />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Billing Currency</Label>
                <Select value={form.billing_currency} onValueChange={(v) => update("billing_currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Credit Limit</Label>
                <Input type="number" value={form.credit_limit} onChange={(e) => update("credit_limit", e.target.value)} placeholder="0" />
              </div>
            </div>

            {(form.user_type === "b2b_agent" || form.user_type === "corporate") && (
              <div>
                <Label>Additional Allowed Currencies</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Click to enable extra currencies this agent can transact and hold balances in. Billing currency ({form.billing_currency}) is always included.
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(CURRENCIES)
                    .filter((c) => c.code !== form.billing_currency)
                    .map((c) => {
                      const enabled = form.allowed_currencies.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() =>
                            update(
                              "allowed_currencies",
                              enabled
                                ? form.allowed_currencies.filter((x) => x !== c.code)
                                : [...form.allowed_currencies, c.code]
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                            enabled
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/30 text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {c.symbol} {c.code}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div>
                <Label>Assign Tenant</Label>
                <Select value={form.tenant_id} onValueChange={(v) => update("tenant_id", v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No tenant (global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No tenant (global)</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
