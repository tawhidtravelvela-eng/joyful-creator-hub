import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useB2B } from "@/contexts/B2BContext";
import { BOOKING_STATUS_COLORS } from "@/data/b2bMockData";
import { toast } from "sonner";
import { StatusBadge } from "./shared/StatusBadge";
import { PageHeader } from "./shared/PageHeader";
import { EmptyState } from "./shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Eye, FileText, Plane, Building2, Map, CalendarCheck } from "lucide-react";

const TYPE_TABS = ["All", "Flight", "Hotel", "Tour"] as const;
const STATUS_TABS = ["All Statuses", "Confirmed", "Paid", "Pending", "Cancelled", "Needs Payment"] as const;

const typeIcons: Record<string, typeof Plane> = { Flight: Plane, Hotel: Building2, Tour: Map };

export const B2BBookings = () => {
  const { bookings, fmtBooking } = useB2B();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All Statuses");
  const [query, setQuery] = useState("");

  const filtered = bookings.filter(b => {
    if (typeFilter !== "All" && b.type !== typeFilter) return false;
    if (statusFilter !== "All Statuses" && b.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return b.booking_id.toLowerCase().includes(q) || b.title.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Booking Queue" description={`${bookings.length} total bookings`} />

      {/* Type tabs */}
      <div className="flex flex-wrap gap-1">
        {TYPE_TABS.map(t => {
          const count = t === "All" ? bookings.length : bookings.filter(b => b.type === t).length;
          return (
            <Button key={t} size="sm" variant={typeFilter === t ? "default" : "ghost"} className="text-xs h-7 gap-1" onClick={() => setTypeFilter(t)}>
              {t} <Badge variant="secondary" className="text-[10px] h-4 min-w-[16px] px-1">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Status filter + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {STATUS_TABS.map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "secondary" : "ghost"} className="text-[10px] h-6 px-2" onClick={() => setStatusFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="relative max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search booking ID, title..." value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-7 text-xs" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No bookings found" description={query ? "Try a different search term" : "No bookings match these filters"} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Booking ID</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const Icon = typeIcons[b.type] || CalendarCheck;
                    return (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-primary/80">{b.booking_id}</td>
                        <td className="px-2 py-2 max-w-[220px] truncate">{b.title}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3 h-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px] h-4">{b.type}</Badge>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={b.status} type="booking" />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {fmtBooking(b)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="View ticket"
                              onClick={() => navigate(`/booking/ticket/${b.id}`)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Booking details"
                              onClick={() => navigate(`/booking/confirmation/${b.id}`)}>
                              <FileText className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Download"
                              onClick={() => {
                                window.open(`/booking/ticket/${b.id}`, "_blank");
                                toast.success(`Opening ticket for ${b.booking_id}`);
                              }}>
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
