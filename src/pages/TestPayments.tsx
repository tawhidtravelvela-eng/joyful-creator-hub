import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, CheckCircle, XCircle, Loader2, ArrowLeft, Globe, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { processBkashPayment, processAirwallexPayment, confirmAirwallexPayment } from "@/utils/bookingService";
import { toast } from "sonner";

interface TestGateway {
  id: string;
  label: string;
  icon: typeof CreditCard;
  currency: string;
  amount: number;
  description: string;
}

const TEST_GATEWAYS: TestGateway[] = [
  { id: "airwallex", label: "Airwallex", icon: Globe, currency: "USD", amount: 1.00, description: "Airwallex hosted checkout – $1.00 USD" },
  { id: "airwallex_eur", label: "Airwallex (EUR)", icon: Globe, currency: "EUR", amount: 0.92, description: "Airwallex hosted checkout – €0.92 EUR" },
  { id: "airwallex_gbp", label: "Airwallex (GBP)", icon: Globe, currency: "GBP", amount: 0.79, description: "Airwallex hosted checkout – £0.79 GBP" },
  { id: "airwallex_aud", label: "Airwallex (AUD)", icon: Globe, currency: "AUD", amount: 1.55, description: "Airwallex hosted checkout – A$1.55 AUD" },
  { id: "airwallex_hkd", label: "Airwallex (HKD)", icon: Globe, currency: "HKD", amount: 7.82, description: "Airwallex hosted checkout – HK$7.82 HKD" },
  { id: "airwallex_cny", label: "Airwallex (CNY)", icon: Globe, currency: "CNY", amount: 7.25, description: "Airwallex hosted checkout – ¥7.25 CNY" },
  { id: "bkash", label: "bKash", icon: Smartphone, currency: "BDT", amount: 120, description: "bKash Mobile Banking – ৳120 BDT" },
];

type TestResult = "idle" | "loading" | "success" | "error" | "paid";

interface GatewayResult {
  status: TestResult;
  message?: string;
  intentId?: string;
  clientSecret?: string;
  currency?: string;
}

const TestPayments = () => {
  const [results, setResults] = useState<Record<string, GatewayResult>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirming, setConfirming] = useState(false);

  // Handle return from Airwallex checkout
  useEffect(() => {
    const gatewayId = searchParams.get("result");
    const intentId = searchParams.get("payment_intent_id");

    if (gatewayId && intentId && !confirming) {
      setConfirming(true);
      // Clean URL
      setSearchParams({}, { replace: true });

      // Confirm payment status
      confirmAirwallexPayment(intentId).then((res) => {
        if (res.success && (res.status === "SUCCEEDED" || res.status === "REQUIRES_CAPTURE")) {
          updateResult(gatewayId, {
            status: "paid",
            message: `✅ Payment completed! Status: ${res.status} | Intent: ${intentId.slice(0, 20)}...`,
            intentId,
          });
          toast.success("Payment completed successfully!");
        } else {
          updateResult(gatewayId, {
            status: "error",
            message: `Payment status: ${res.status || res.error || "Unknown"}`,
            intentId,
          });
          toast.error(`Payment not completed. Status: ${res.status || res.error}`);
        }
        setConfirming(false);
      }).catch(() => {
        updateResult(gatewayId, {
          status: "error",
          message: "Failed to confirm payment status",
          intentId,
        });
        setConfirming(false);
      });
    }
  }, [searchParams]);

  const updateResult = (id: string, result: GatewayResult) => {
    setResults((prev) => ({ ...prev, [id]: result }));
  };

  const testGateway = async (gateway: TestGateway) => {
    updateResult(gateway.id, { status: "loading" });
    const testBookingId = `TEST-${Date.now()}-${gateway.currency}`;
    const returnUrl = `${window.location.origin}/test-payments?result=${gateway.id}`;

    try {
      if (gateway.id.startsWith("airwallex")) {
        const res = await processAirwallexPayment(gateway.amount, gateway.currency, testBookingId, returnUrl);
        if (!res.success) {
          updateResult(gateway.id, { status: "error", message: res.error || "Failed to create PaymentIntent" });
          return;
        }
        updateResult(gateway.id, {
          status: "success",
          message: `PaymentIntent created! Click "Pay Now" to complete payment.`,
          intentId: res.intentId,
          clientSecret: res.clientSecret,
          currency: gateway.currency,
        });
      } else if (gateway.id === "bkash") {
        const res = await processBkashPayment(gateway.amount, testBookingId);
        if (!res.success) {
          updateResult(gateway.id, { status: "error", message: res.error || "bKash initiation failed" });
          return;
        }
        updateResult(gateway.id, {
          status: "success",
          message: `bKash payment created! Payment ID: ${res.paymentID || "N/A"}`,
        });
      }
    } catch (err: any) {
      updateResult(gateway.id, { status: "error", message: err.message || "Unexpected error" });
    }
  };

  const openCheckout = useCallback(async (gateway: TestGateway) => {
    const result = results[gateway.id];
    if (!result?.intentId || !result?.clientSecret) return;

    if (gateway.id.startsWith("airwallex")) {
      try {
        // Dynamically load Airwallex SDK
        const { init } = await import('@airwallex/components-sdk');
        const { payments } = await init({ env: 'prod', origin: window.location.origin, enabledElements: ['payments'] }) as any;
        payments.redirectToCheckout({
          env: 'prod',
          mode: 'payment',
          intent_id: result.intentId,
          client_secret: result.clientSecret!,
          currency: gateway.currency,
          successUrl: `${window.location.origin}/test-payments?result=${gateway.id}&payment_intent_id=${result.intentId}`,
          failUrl: `${window.location.origin}/test-payments?result=${gateway.id}&payment_intent_id=${result.intentId}&status=failed`,
        });
      } catch (err: any) {
        toast.error(`Failed to open checkout: ${err.message}`);
      }
    }
  }, [results]);

  const getStatusIcon = (status: TestResult) => {
    switch (status) {
      case "loading":
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-amber-500" />;
      case "paid":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult) => {
    switch (status) {
      case "loading":
        return <Badge variant="secondary">Testing...</Badge>;
      case "success":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Ready to Pay</Badge>;
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Paid ✓</Badge>;
      case "error":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Not tested</Badge>;
    }
  };

  const testAll = async () => {
    for (const gw of TEST_GATEWAYS) {
      await testGateway(gw);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Confirming overlay */}
          {confirming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
            >
              <Card className="w-80">
                <CardContent className="py-8 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                  <p className="font-semibold text-foreground">Confirming Payment...</p>
                  <p className="text-sm text-muted-foreground mt-1">Checking payment status with Airwallex</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payment Gateway Tests</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Test all integrated payment gateways with ~$1 USD equivalent amounts
              </p>
            </div>
            <Button onClick={testAll} className="gap-2">
              <CreditCard className="w-4 h-4" />
              Test All
            </Button>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {TEST_GATEWAYS.map((gateway, idx) => {
                const result = results[gateway.id] || { status: "idle" as TestResult };

                return (
                  <motion.div
                    key={gateway.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className={`transition-all ${
                      result.status === "paid"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : result.status === "success"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : result.status === "error"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border"
                    }`}>
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-lg shrink-0 ${
                            result.status === "paid"
                              ? "bg-emerald-500/10"
                              : result.status === "success"
                              ? "bg-amber-500/10"
                              : result.status === "error"
                              ? "bg-destructive/10"
                              : "bg-primary/10"
                          }`}>
                            <gateway.icon className={`w-5 h-5 ${
                              result.status === "paid"
                                ? "text-emerald-500"
                                : result.status === "success"
                                ? "text-amber-500"
                                : result.status === "error"
                                ? "text-destructive"
                                : "text-primary"
                            }`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-foreground">{gateway.label}</span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {gateway.currency}
                              </Badge>
                              {getStatusBadge(result.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">{gateway.description}</p>
                            {result.message && (
                              <p className={`text-xs mt-1.5 font-mono ${
                                result.status === "paid"
                                  ? "text-emerald-600"
                                  : result.status === "success"
                                  ? "text-amber-600"
                                  : "text-destructive"
                              }`}>
                                {result.message}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {getStatusIcon(result.status)}
                            {/* Show Pay Now button when intent is ready */}
                            {result.status === "success" && result.intentId && result.clientSecret && gateway.id.startsWith("airwallex") && (
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => openCheckout(gateway)}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Pay Now
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={result.status === "paid" ? "outline" : result.status === "success" ? "outline" : "default"}
                              onClick={() => testGateway(gateway)}
                              disabled={result.status === "loading"}
                            >
                              {result.status === "loading" ? "Testing..." : result.status !== "idle" ? "Retest" : "Test"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Summary */}
          {Object.keys(results).length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Test Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-2xl font-bold text-foreground">{Object.keys(results).length}</p>
                      <p className="text-xs text-muted-foreground">Tested</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-3">
                      <p className="text-2xl font-bold text-amber-600">
                        {Object.values(results).filter((r) => r.status === "success").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Ready</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-3">
                      <p className="text-2xl font-bold text-emerald-600">
                        {Object.values(results).filter((r) => r.status === "paid").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Paid</p>
                    </div>
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <p className="text-2xl font-bold text-destructive">
                        {Object.values(results).filter((r) => r.status === "error").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => window.history.back()} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TestPayments;
