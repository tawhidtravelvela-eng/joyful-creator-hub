import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./shared/PageHeader";
import { EmptyState } from "./shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Shield, Pencil, Power, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_PERMISSIONS, type StaffUser, type B2BRole, type B2BPermissions } from "@/data/b2bMockData";

const PERMISSION_LABELS: Record<keyof B2BPermissions, string> = {
  can_search: "Search Products", can_book: "Create Bookings", can_issue: "Issue Tickets",
  can_view_wallet: "View Wallet", can_manage_finance: "Manage Finance", can_manage_customers: "Manage Customers",
  can_cancel: "Cancel Bookings", can_refund: "Process Refunds", can_access_reports: "Access Reports",
  can_manage_users: "Manage Users", can_view_support: "View Support", can_create_support: "Create Support Tickets",
  can_edit_markup: "Edit Markup",
};

const PERMISSION_GROUPS: { label: string; keys: (keyof B2BPermissions)[] }[] = [
  { label: "Booking Operations", keys: ["can_search", "can_book", "can_issue", "can_cancel", "can_refund"] },
  { label: "Finance", keys: ["can_view_wallet", "can_manage_finance", "can_edit_markup"] },
  { label: "Management", keys: ["can_manage_customers", "can_manage_users", "can_access_reports"] },
  { label: "Support", keys: ["can_view_support", "can_create_support"] },
];

export const B2BStaffManagement = () => {
  const { user } = useAuth();
  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editPermissions, setEditPermissions] = useState<B2BPermissions | null>(null);
  const [selectedRole, setSelectedRole] = useState<B2BRole>("reservation");

  const fetchSubAgents = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, company_name, created_at")
      .eq("parent_agent_id", user.id);
    setSubAgents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSubAgents(); }, [user]);

  const handleRoleChange = (role: B2BRole) => {
    setSelectedRole(role);
    setEditPermissions({ ...ROLE_PERMISSIONS[role] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff / Sub-Users"
        description={`${subAgents.length} team members`}
        actions={
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setShowAddDialog(true); handleRoleChange("reservation"); }}>
            <UserPlus className="w-3.5 h-3.5" /> Add Sub-User
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : subAgents.length === 0 ? (
        <EmptyState
          title="No sub-users yet"
          description="Add team members to help manage bookings and operations"
          icon={<Users className="w-8 h-8" />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    {["User", "Company", "Joined", "Actions"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subAgents.map(u => (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {(u.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.full_name || "Unknown"}</p>
                            <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.company_name || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info(`Managing ${u.full_name}`)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add sub-user dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Sub-User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Full Name</Label><Input className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Email</Label><Input type="email" className="h-9 text-sm" /></div>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={selectedRole} onValueChange={v => handleRoleChange(v as B2BRole)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editPermissions && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</h4>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-xs font-medium text-foreground">{group.label}</p>
                    <div className="space-y-1.5 pl-1">
                      {group.keys.map(key => (
                        <div key={key} className="flex items-center justify-between py-1">
                          <span className="text-xs text-muted-foreground">{PERMISSION_LABELS[key]}</span>
                          <Switch checked={editPermissions[key]} onCheckedChange={v => setEditPermissions({ ...editPermissions, [key]: v })} className="scale-90" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { setShowAddDialog(false); toast.info("Sub-user invitations will be available soon"); }}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
