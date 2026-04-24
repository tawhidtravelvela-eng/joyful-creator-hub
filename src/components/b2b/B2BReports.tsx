import { useState } from "react";
import { useB2B } from "@/contexts/B2BContext";
import { PageHeader } from "./shared/PageHeader";
import { KpiCard } from "./shared/KpiCard";
import { StatusBadge } from "./shared/StatusBadge";
import { EmptyState } from "./shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, BarChart3, TrendingUp, DollarSign, Filter, Plane, Building2, Users } from "lucide-react";
import { toast } from "sonner";

type ReportType = "booking" | "sales" | "cancellation" | "wallet" | "customer";

const REPORT_TYPES: { label: string; value: ReportType; icon: any; description: string }[] = [
  { label: "Booking Report", value: "booking", icon: FileText, description: "All bookings with status and details" },
  { label: "Sales Report", value: "sales", icon: TrendingUp, description: "Revenue and sales performance" },
  { label: "Cancellation Report", value: "cancellation", icon: FileText, description: "Cancelled and void bookings" },
  { label: "Wallet Statement", value: "wallet", icon: DollarSign, description: "Complete transaction ledger" },
  { label: "Customer Report", value: "customer", icon: Users, description: "Customer-wise booking analysis" },
];

export const B2BReports = () => {
  const { bookings, fmtNative, fmtBooking } = useB2B();
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const totalRevenue = bookings.filter(b => b.status !== "Cancelled").reduce((s, b) => s + Number(b.total), 0);
  const cancelledCount = bookings.filter(b => b.status === "Cancelled").length;

  if (!selectedReport) return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Generate and download operational reports" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total Revenue" value={fmtNative(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} subtitle="All time" />
        <KpiCard title="Total Bookings" value={String(bookings.length)} icon={<FileText className="w-5 h-5" />} subtitle="All time" />
        <KpiCard title="Cancellations" value={String(cancelledCount)} icon={<FileText className="w-5 h-5" />} subtitle="All time" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map(r => (
          <Card key={r.value} className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all" onClick={() => setSelectedReport(r.value)}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0"><r.icon className="w-4 h-4" /></div>
                <div><h3 className="font-semibold text-sm">{r.label}</h3><p className="text-xs text-muted-foreground mt-0.5">{r.description}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const report = REPORT_TYPES.find(r => r.value === selectedReport)!;
  const filteredBookings = bookings.filter(b => {
    const d = new Date(b.created_at);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    if (selectedReport === "cancellation") return b.status === "Cancelled";
    return true;
  });
  const filteredTotal = filteredBookings.reduce((s, b) => s + Number(b.total), 0);

  return (
    <div className="space-y-4">
      <PageHeader title={report.label} description={report.description} actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedReport(null)}>← Back</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toast.info("CSV export coming soon")}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      } />

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs">From</Label><Input type="date" className="h-9 text-sm w-[160px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" className="h-9 text-sm w-[160px]" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {filteredBookings.length === 0 ? (
        <EmptyState title="No data for this period" description="Try adjusting the date range" />
      ) : (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Report Data</CardTitle>
            <p className="text-xs text-muted-foreground">{dateFrom} — {dateTo}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    {["Date", "Booking ID", "Title", "Type", "Amount", "Status"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(b => (
                    <tr key={b.id} className="border-b border-border/50">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{b.booking_id}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate">{b.title}</td>
                      <td className="px-3 py-2.5 text-xs">{b.type}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmtBooking(b)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={b.status} type="booking" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex justify-between text-xs">
              <span className="text-muted-foreground">Total: {filteredBookings.length} records</span>
              <span className="font-semibold">Total: {fmtNative(filteredTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
