import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTenantFilter } from "@/hooks/useAdminTenantFilter";
import { Check, X, Loader2, Clock, Building2, Briefcase, Globe, Key, Plus } from "lucide-react";
import { format } from "date-fns";

interface PendingUser {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  user_type: string;
  company_name: string;
  trade_license: string;
  phone: string;
  approval_status: string;
  created_at: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  company_name: string;
  domain_requested: string;
  business_justification: string;
  admin_notes: string;
  tenant_id: string | null;
  assigned_tenant_name: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

interface TenantOption {
  id: string;
  name: string;
  domain: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const userTypeLabels: Record<string, string> = {
  b2c: "B2C",
  corporate: "Corporate",
  b2b_agent: "B2B Agent",
};

const AdminUserApprovals = () => {
  const { user } = useAuth();
  const { adminTenantId } = useAdminTenantFilter();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [existingTenants, setExistingTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; item: any; type: "user" | "access" }>({ open: false, item: null, type: "user" });
  const [adminNotes, setAdminNotes] = useState("");

  // Tenant assignment state
  const [tenantMode, setTenantMode] = useState<"create" | "assign" | "none">("none");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let usersQuery = (supabase as any).from("profiles").select("*").in("user_type", ["corporate", "b2b_agent"]).order("created_at", { ascending: false });
    let requestsQuery = (supabase as any).from("b2b_access_requests").select("*").order("created_at", { ascending: false });

    if (adminTenantId) {
      usersQuery = usersQuery.eq("tenant_id", adminTenantId);
    }

    const [usersRes, requestsRes, tenantsRes] = await Promise.all([
      usersQuery,
      requestsQuery,
      supabase.from("tenants").select("id, name, domain").eq("is_active", true).order("name"),
    ]);

    setPendingUsers(usersRes.data || []);
    setExistingTenants((tenantsRes.data || []) as TenantOption[]);

    const requests = requestsRes.data || [];
    if (requests.length > 0) {
      const userIds = [...new Set(requests.map((r: any) => r.user_id))] as string[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      requests.forEach((r: any) => {
        r.profile = profileMap.get(r.user_id) || {};
      });
    }
    setAccessRequests(requests);
    setLoading(false);
  };

  const handleApproval = async (profileId: string, userId: string, action: "approved" | "rejected") => {
    setActionLoading(profileId);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        approval_status: action,
        is_approved: action === "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`User ${action}`);
      fetchData();
    }
    setActionLoading(null);
    setReviewDialog({ open: false, item: null, type: "user" });
  };

  const handleAccessRequestAction = async (requestId: string, action: "approved" | "rejected") => {
    setActionLoading(requestId);

    let tenantId: string | null = null;
    let tenantName: string | null = null;

    // If approving with tenant creation/assignment
    if (action === "approved" && tenantMode === "create" && newTenantName.trim()) {
      // Tenant sites are resolved by VERIFIED CUSTOM DOMAIN only — we no
      // longer fall back to a *.travelvela.com subdomain. The admin must
      // enter the tenant's own domain (it can be left blank and added later
      // by the tenant from their Studio → Domains panel).
      const domainInput = newTenantDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const { data: newTenant, error: createErr } = await supabase.from("tenants").insert({
        name: newTenantName.trim(),
        domain: domainInput || null,
        is_active: true,
        settings: {},
      }).select("id, name").single();

      if (createErr) {
        toast.error("Failed to create tenant: " + createErr.message);
        setActionLoading(null);
        return;
      }
      tenantId = newTenant.id;
      tenantName = newTenant.name;
    } else if (action === "approved" && tenantMode === "assign" && selectedTenantId) {
      tenantId = selectedTenantId;
      tenantName = existingTenants.find((t) => t.id === selectedTenantId)?.name || null;
    }

    // Update the access request
    const { error } = await (supabase as any)
      .from("b2b_access_requests")
      .update({
        status: action,
        admin_notes: adminNotes,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        ...(tenantId ? { tenant_id: tenantId, assigned_tenant_name: tenantName } : {}),
      })
      .eq("id", requestId);

    if (error) {
      toast.error(error.message);
    } else {
      // If tenant was assigned, also update the user's profile
      if (tenantId && reviewDialog.item?.user_id) {
        await (supabase as any).from("profiles").update({ tenant_id: tenantId }).eq("user_id", reviewDialog.item.user_id);
        // Also give them admin role for their tenant
        await (supabase as any).from("user_roles").upsert({
          user_id: reviewDialog.item.user_id,
          role: "admin",
          tenant_id: tenantId,
        }, { onConflict: "user_id,role" });
      }
      toast.success(`Access request ${action}${tenantId ? " — tenant assigned" : ""}`);
      fetchData();
    }
    setActionLoading(null);
    setAdminNotes("");
    setTenantMode("none");
    setSelectedTenantId("");
    setNewTenantName("");
    setNewTenantDomain("");
    setReviewDialog({ open: false, item: null, type: "access" });
  };

  const openReviewDialog = (item: AccessRequest) => {
    setReviewDialog({ open: true, item, type: "access" });
    setAdminNotes("");
    setTenantMode("none");
    setSelectedTenantId("");
    // Pre-fill from request
    setNewTenantName(item.company_name || "");
    setNewTenantDomain(item.domain_requested || "");
  };

  const pendingCount = pendingUsers.filter((u) => u.approval_status === "pending").length;
  const pendingAccessCount = accessRequests.filter((r) => r.status === "pending").length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Approvals</h1>
          <p className="text-muted-foreground mt-1">Review and approve Corporate, B2B Agent registrations, and access requests.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Registrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Globe className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingAccessCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Access Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingUsers.filter((u) => u.approval_status === "approved").length}</p>
                  <p className="text-xs text-muted-foreground">Approved Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="registrations">
          <TabsList>
            <TabsTrigger value="registrations" className="gap-1">
              Registrations {pendingCount > 0 && <Badge variant="destructive" className="text-xs px-1.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="access-requests" className="gap-1">
              Access Requests {pendingAccessCount > 0 && <Badge variant="destructive" className="text-xs px-1.5">{pendingAccessCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registrations">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No registrations found</TableCell>
                      </TableRow>
                    ) : (
                      pendingUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{u.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {u.user_type === "corporate" ? <Building2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                              {userTypeLabels[u.user_type] || u.user_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{u.company_name || "—"}</TableCell>
                          <TableCell>{u.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[u.approval_status] || ""}>{u.approval_status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(u.created_at), "PP")}</TableCell>
                          <TableCell className="text-right">
                            {u.approval_status === "pending" ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" className="gap-1 text-green-600" onClick={() => handleApproval(u.id, u.user_id, "approved")} disabled={actionLoading === u.id}>
                                  <Check className="h-3 w-3" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => handleApproval(u.id, u.user_id, "rejected")} disabled={actionLoading === u.id}>
                                  <X className="h-3 w-3" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access-requests">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No access requests</TableCell>
                      </TableRow>
                    ) : (
                      accessRequests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{r.profile?.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.profile?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {r.request_type === "whitelabel" ? <Globe className="h-3 w-3" /> : <Key className="h-3 w-3" />}
                              {r.request_type === "whitelabel" ? "White-Label" : "BYOK"}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.company_name || "—"}</TableCell>
                          <TableCell>{r.domain_requested || "—"}</TableCell>
                          <TableCell>
                            {r.assigned_tenant_name ? (
                              <Badge variant="secondary" className="gap-1">
                                <Building2 className="h-3 w-3" />
                                {r.assigned_tenant_name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[r.status] || ""}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(r.created_at), "PP")}</TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" ? (
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => openReviewDialog(r)}>
                                Review
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Review Access Request Dialog */}
        <Dialog open={reviewDialog.open && reviewDialog.type === "access"} onOpenChange={(o) => !o && setReviewDialog({ open: false, item: null, type: "access" })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Access Request</DialogTitle>
            </DialogHeader>
            {reviewDialog.item && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{reviewDialog.item.request_type === "whitelabel" ? "White-Label" : "BYOK"}</span></div>
                  <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{reviewDialog.item.company_name}</span></div>
                  <div><span className="text-muted-foreground">Agent:</span> <span className="font-medium">{reviewDialog.item.profile?.full_name || "—"}</span></div>
                  {reviewDialog.item.domain_requested && (
                    <div><span className="text-muted-foreground">Domain:</span> <span className="font-medium">{reviewDialog.item.domain_requested}</span></div>
                  )}
                </div>
                {reviewDialog.item.business_justification && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Business Justification</Label>
                    <p className="text-sm mt-1 bg-muted p-3 rounded-md">{reviewDialog.item.business_justification}</p>
                  </div>
                )}

                {/* Tenant Assignment Section */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Tenant Assignment</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={tenantMode === "none" ? "default" : "outline"}
                      onClick={() => setTenantMode("none")}
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      variant={tenantMode === "assign" ? "default" : "outline"}
                      onClick={() => setTenantMode("assign")}
                    >
                      Assign Existing
                    </Button>
                    <Button
                      size="sm"
                      variant={tenantMode === "create" ? "default" : "outline"}
                      className="gap-1"
                      onClick={() => setTenantMode("create")}
                    >
                      <Plus className="h-3 w-3" /> Create New
                    </Button>
                  </div>

                  {tenantMode === "assign" && (
                    <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tenant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingTenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.domain})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {tenantMode === "create" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Tenant Name</Label>
                        <Input value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Agency Name" />
                      </div>
                      <div>
                        <Label className="text-xs">Custom Domain (optional)</Label>
                        <Input
                          value={newTenantDomain}
                          onChange={(e) => setNewTenantDomain(e.target.value)}
                          placeholder="flights.agency.com"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Tenant's own verified domain (CNAME → custom.travelvela.com).
                          Leave blank — tenant can connect it later from Studio → Domains.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Admin Notes</Label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add notes about this decision..." />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" className="gap-1 text-red-600" onClick={() => handleAccessRequestAction(reviewDialog.item?.id, "rejected")} disabled={!!actionLoading}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button className="gap-1" onClick={() => handleAccessRequestAction(reviewDialog.item?.id, "approved")} disabled={!!actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve{tenantMode !== "none" ? " & Assign Tenant" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUserApprovals;
