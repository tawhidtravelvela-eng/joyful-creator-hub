import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Loader2, Handshake, Check, X, Clock, Mail, Phone, Building2, Globe, Inbox,
} from "lucide-react";
import { format } from "date-fns";

interface Application {
  id: string;
  user_id: string;
  request_type: string;
  status: "pending" | "approved" | "rejected" | string;
  company_name: string | null;
  domain_requested: string | null;
  business_justification: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Decorated client-side from profiles */
  applicant_name?: string | null;
  applicant_email?: string | null;
  applicant_phone?: string | null;
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

/**
 * Tenant-admin view of partner applications submitted via the
 * tenant's own /partners landing page. RLS scopes results to the
 * caller's tenant automatically (see migration:
 * "Tenant admins read own tenant b2b requests").
 */
export const B2BPartnerApplications = () => {
  const { user, adminTenantId } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const fetchApps = async () => {
    setLoading(true);
    // RLS will filter to this tenant automatically; we still scope client-side
    // for safety in case the user has multiple tenants attached.
    let q = (supabase as any)
      .from("b2b_access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (adminTenantId) q = q.eq("tenant_id", adminTenantId);

    const { data, error } = await q;
    if (error) {
      toast.error("Could not load applications");
      setLoading(false);
      return;
    }
    const rows = (data || []) as Application[];

    // Decorate with applicant profile fields (best-effort)
    if (rows.length > 0) {
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        const map = new Map<string, any>(
          (profiles || []).map((p: any) => [p.user_id, p]),
        );
        rows.forEach((r) => {
          const p = map.get(r.user_id);
          r.applicant_name = p?.full_name || null;
          r.applicant_email = p?.email || null;
          r.applicant_phone = p?.phone || null;
        });
      }
    }

    setApps(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (user) void fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, adminTenantId]);

  const filtered = apps.filter((a) => (tab === "all" ? true : a.status === tab));
  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
    all: apps.length,
  };

  const decide = async (
    app: Application,
    decision: "approved" | "rejected",
  ) => {
    setActionId(app.id);
    const { error } = await (supabase as any)
      .from("b2b_access_requests")
      .update({
        status: decision,
        admin_notes: adminNotes || app.admin_notes || null,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    setActionId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      decision === "approved" ? "Application approved" : "Application rejected",
    );
    setReviewing(null);
    setAdminNotes("");
    void fetchApps();
  };

  const openReview = (a: Application) => {
    setReviewing(a);
    setAdminNotes(a.admin_notes || "");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Partner Applications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review applications submitted via your <code className="text-xs px-1 py-0.5 rounded bg-muted">/partners</code> page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3 w-3 text-warning" />
            {counts.pending} pending
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Check className="h-3 w-3 text-success" />
            {counts.approved} approved
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            {counts.pending > 0 && (
              <Badge variant="destructive" className="px-1.5 text-[10px]">
                {counts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No {tab === "all" ? "" : tab} applications yet.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Applications submitted from your{" "}
                    <code className="text-[10px]">/partners</code> page will
                    appear here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {a.applicant_name || "—"}
                          </div>
                          {a.business_justification && (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                              {a.business_justification}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {a.company_name || "—"}
                          </div>
                          {a.domain_requested && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Globe className="h-3 w-3" />
                              {a.domain_requested}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.applicant_email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {a.applicant_email}
                            </div>
                          )}
                          {a.applicant_phone && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {a.applicant_phone}
                            </div>
                          )}
                          {!a.applicant_email && !a.applicant_phone && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusStyles[a.status] || ""}
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(a.created_at), "PP")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={a.status === "pending" ? "default" : "outline"}
                            onClick={() => openReview(a)}
                          >
                            {a.status === "pending" ? "Review" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!reviewing}
        onOpenChange={(v) => {
          if (!v) {
            setReviewing(null);
            setAdminNotes("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-4 w-4" />
              Partner application
            </DialogTitle>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Applicant</Label>
                  <p className="font-medium">{reviewing.applicant_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <p className="font-medium">{reviewing.company_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="break-all">{reviewing.applicant_email || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p>{reviewing.applicant_phone || "—"}</p>
                </div>
              </div>

              {reviewing.business_justification && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Their message
                  </Label>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                    {reviewing.business_justification}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">
                  Internal notes {reviewing.status !== "pending" && "(read-only)"}
                </Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for your team (optional)…"
                  rows={3}
                  disabled={reviewing.status !== "pending"}
                />
              </div>

              {reviewing.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Reviewed {format(new Date(reviewing.reviewed_at), "PPp")}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {reviewing?.status === "pending" ? (
              <>
                <Button
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={!!actionId}
                  onClick={() => reviewing && decide(reviewing, "rejected")}
                >
                  {actionId === reviewing?.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Reject
                </Button>
                <Button
                  className="gap-1.5"
                  disabled={!!actionId}
                  onClick={() => reviewing && decide(reviewing, "approved")}
                >
                  {actionId === reviewing?.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default B2BPartnerApplications;