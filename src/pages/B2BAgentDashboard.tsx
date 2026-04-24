import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { B2BProvider, useB2B } from "@/contexts/B2BContext";
import { B2BLayout } from "@/components/b2b/B2BLayout";
import { B2BDashboardOverview } from "@/components/b2b/B2BDashboardOverview";
import { B2BBookings } from "@/components/b2b/B2BBookings";
import { B2BCustomers } from "@/components/b2b/B2BCustomers";
import { B2BReports } from "@/components/b2b/B2BReports";
import { B2BSupport } from "@/components/b2b/B2BSupport";
import { B2BStaffManagement } from "@/components/b2b/B2BStaffManagement";
import { B2BSettings } from "@/components/b2b/B2BSettings";
import { B2BPartnerApplications } from "@/components/b2b/B2BPartnerApplications";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

// Existing components reused from the old dashboard
import B2BSearchSection from "@/components/dashboard/B2BSearchSection";
import WalletSection from "@/components/dashboard/WalletSection";
import MarkupSettings from "@/components/dashboard/MarkupSettings";
import WhitelabelEarnings from "@/components/dashboard/WhitelabelEarnings";
import SubAgentEarnings from "@/components/dashboard/SubAgentEarnings";
import SubAgentManagement from "@/components/dashboard/SubAgentManagement";
import WhitelabelCouponManagement from "@/components/dashboard/WhitelabelCouponManagement";

// Skin Studio entry card — the full editor lives at /studio.
import CustomWebsiteHub from "@/components/dashboard/CustomWebsiteHub";
import ApiAccessPurchaseGate from "@/components/dashboard/ApiAccessPurchaseGate";
import ApiDocumentation from "@/components/dashboard/ApiDocumentation";
import PaymentGatewayConfig from "@/components/dashboard/PaymentGatewayConfig";
import AgentBankAccounts from "@/components/dashboard/AgentBankAccounts";
import TicketRequestsList from "@/components/dashboard/TicketRequestsList";
import TicketRequestDialog from "@/components/dashboard/TicketRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, RefreshCw, Code } from "lucide-react";

/** Inner content router — requires B2BContext */
const B2BContentRouter = () => {
  const { user } = useAuth();
  const {
    activePage, profile, walletBalance, walletBalances, availableCurrencies,
    activeCurrency, setActiveCurrency, isSubAgent,
    affiliateId, affiliateCode, totalConversions, refresh,
  } = useB2B();

  const [ticketRequestBooking, setTicketRequestBooking] = useState<any>(null);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [apiAccessPurchased, setApiAccessPurchased] = useState<boolean | null>(null);
  const [parentBrandName, setParentBrandName] = useState<string | undefined>(undefined);

  // Check API access purchase status
  useEffect(() => {
    if (!user) return;
    supabase.from("whitelabel_purchases" as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("product_type", "api_access")
      .eq("status", "completed")
      .maybeSingle()
      .then(({ data }) => setApiAccessPurchased(!!data));
  }, [user]);

  // Fetch parent brand name for sub-agents
  useEffect(() => {
    if (!user || !profile.parent_agent_id) return;
    supabase.from("profiles")
      .select("company_name, full_name")
      .eq("user_id", profile.parent_agent_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setParentBrandName((data as any).company_name || (data as any).full_name || undefined);
      });
  }, [user, profile.parent_agent_id]);

  const renderContent = () => {
    switch (activePage) {
      case "overview":
        return <B2BDashboardOverview />;
      case "search-book":
        return <B2BSearchSection />;
      case "bookings":
        return <B2BBookings />;
      case "customers":
        return <B2BCustomers />;
      case "wallet":
        return (
          <WalletSection
            userId={user!.id}
            balance={walletBalance}
            onBalanceChange={refresh}
            billingCurrency={activeCurrency}
            availableCurrencies={availableCurrencies}
            balancesByCurrency={walletBalances}
            onCurrencyChange={setActiveCurrency}
          />
        );
      case "markup":
        return <MarkupSettings userId={user!.id} />;
      case "earnings":
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <WhitelabelEarnings userId={user!.id} />
            {!isSubAgent && <SubAgentEarnings userId={user!.id} />}
          </motion.div>
        );
      case "reports":
        return <B2BReports />;
      case "requests":
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-xl font-bold mb-1">Ticket Requests</h2>
            <p className="text-sm text-muted-foreground mb-5">Manage reissue and refund requests</p>
            <TicketRequestsList userId={user!.id} refreshKey={requestRefreshKey} />
          </motion.div>
        );
      case "support":
        return <B2BSupport />;
      case "staff":
        return (
          <div className="space-y-8">
            <B2BStaffManagement />
            <SubAgentManagement userId={user!.id} walletBalance={walletBalance} onBalanceChange={refresh} />
          </div>
        );
      case "white-label":
        return <CustomWebsiteHub parentBrandName={parentBrandName} />;
      case "api-access":
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">API Access</h2>
              <p className="text-sm text-muted-foreground mb-5">Integrate our booking engine into your systems</p>
            </div>
            {apiAccessPurchased === false && (
              <ApiAccessPurchaseGate userId={user!.id} walletBalance={walletBalance} onPurchased={() => { setApiAccessPurchased(true); refresh(); }} forceCurrency={activeCurrency} />
            )}
            {apiAccessPurchased && <ApiDocumentation userId={user!.id} />}
            {!isSubAgent && <WhitelabelCouponManagement userId={user!.id} mode="agent" />}
          </motion.div>
        );
      case "payment-banks":
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-1">Payment & Bank Accounts</h2>
              <p className="text-sm text-muted-foreground mb-5">Configure payment gateways and bank accounts</p>
            </div>
            <PaymentGatewayConfig userId={user!.id} />
            <AgentBankAccounts userId={user!.id} />
          </motion.div>
        );
      case "partner-applications":
        return <B2BPartnerApplications />;
      case "settings":
        return <B2BSettings />;
      default:
        return <B2BDashboardOverview />;
    }
  };

  return (
    <>
      {renderContent()}
      <TicketRequestDialog
        open={!!ticketRequestBooking}
        onOpenChange={(v) => { if (!v) setTicketRequestBooking(null); }}
        booking={ticketRequestBooking}
        userId={user?.id || ""}
        onSuccess={() => setRequestRefreshKey(k => k + 1)}
      />
    </>
  );
};

/** Main page — wraps everything in B2BProvider + Layout */
const B2BAgentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <B2BProvider>
      <B2BLayout>
        <B2BContentRouter />
      </B2BLayout>
    </B2BProvider>
  );
};

export default B2BAgentDashboard;
