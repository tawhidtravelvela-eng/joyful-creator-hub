import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { processBkashPayment } from "@/utils/bookingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Wallet, Plus, ArrowDownLeft, ArrowUpRight,
  Clock, CheckCircle2, Loader2, Building2, Copy, CreditCard, Zap, Landmark, Upload, Paperclip, X,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Search,
  Plane, Hotel as HotelIcon, MapPin, Car, Sparkles, Code as CodeIcon, Globe, Users, RefreshCw, Tag, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  status: string | null;
  description: string;
  reference: string | null;
  created_at: string;
  currency: string | null;
  category?: string | null;
  booking_id?: string | null;
  actor_user_id?: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string;
  swift_code: string;
  routing_number: string;
  currency: string;
  country: string;
  logo_url: string;
  instructions: string;
}

interface WalletSectionProps {
  userId: string;
  balance: number;
  onBalanceChange: () => void;
  /** Override currency for B2B agents — skips conversion, uses raw amounts */
  billingCurrency?: string;
  /** Optional list of currencies the user can switch between (for multi-currency B2B) */
  availableCurrencies?: string[];
  /** Map of balances per currency, only used if availableCurrencies has 2+ entries */
  balancesByCurrency?: Record<string, number>;
  /** Called when user picks a different currency from the wallet switcher */
  onCurrencyChange?: (currency: string) => void;
}

/** Currency-specific rounded quick-pick amounts */
const CURRENCY_QUICK_PICKS: Record<string, number[]> = {
  USD: [50, 100, 250, 500, 1000, 2500],
  EUR: [50, 100, 250, 500, 1000, 2500],
  GBP: [50, 100, 200, 500, 1000, 2000],
  BDT: [5000, 10000, 25000, 50000, 100000, 250000],
  CNY: [500, 1000, 2000, 5000, 10000, 25000],
  INR: [5000, 10000, 25000, 50000, 100000, 250000],
  AED: [200, 500, 1000, 2000, 5000, 10000],
  MYR: [200, 500, 1000, 2000, 5000, 10000],
  SGD: [50, 100, 250, 500, 1000, 2500],
  THB: [1000, 2500, 5000, 10000, 25000, 50000],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿",
};

const formatCurrencyAmount = (amount: number, cur: string) => {
  const sym = CURRENCY_SYMBOLS[cur] || cur + " ";
  return `${sym}${amount.toLocaleString()}`;
};

/** Sortable column header with active arrow indicator */
const SortableHeader = ({
  label, active, dir, onClick, align = "left",
}: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; align?: "left" | "right" }) => (
  <TableHead className={`text-xs ${align === "right" ? "text-right" : ""}`}>
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
        active ? "text-foreground font-semibold" : "text-muted-foreground"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      {active
        ? (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  </TableHead>
);

const WalletSection = ({
  userId, balance, onBalanceChange, billingCurrency,
  availableCurrencies, balancesByCurrency, onCurrencyChange,
}: WalletSectionProps) => {
  const { currency: contextCurrency } = useCurrency();
  const { tenant } = useTenant();
  const { methods, loading: methodsLoading } = usePaymentMethods();

  // Use billingCurrency if provided (B2B), otherwise fall back to context currency
  const walletCurrency = billingCurrency || contextCurrency;
  const quickAmounts = CURRENCY_QUICK_PICKS[walletCurrency] || CURRENCY_QUICK_PICKS.USD;
  const hasMultipleCurrencies = !!(availableCurrencies && availableCurrencies.length > 1);

  /** Display wallet amounts in the wallet's native currency — NO conversion */
  const displayPrice = (amt: number) => formatCurrencyAmount(amt, walletCurrency);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [actorMap, setActorMap] = useState<Record<string, { name: string; isStaff: boolean; isSubAgent: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [bankTransferRef, setBankTransferRef] = useState("");
  const [depositTab, setDepositTab] = useState("online");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table controls
  type SortKey = "date" | "type" | "status" | "amount" | "title" | "category";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, [userId, walletCurrency]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const txns = (data as WalletTransaction[]) || [];
    setTransactions(txns);

    // Resolve actor profiles (staff / sub-agents who triggered transactions)
    const actorIds = Array.from(new Set(
      txns.map(t => t.actor_user_id).filter((id): id is string => !!id && id !== userId)
    ));
    if (actorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, parent_agent_id, user_type")
        .in("user_id", actorIds);
      const map: Record<string, { name: string; isStaff: boolean; isSubAgent: boolean }> = {};
      (profiles || []).forEach((p: any) => {
        map[p.user_id] = {
          name: p.full_name || p.email || "Unknown",
          isSubAgent: p.parent_agent_id === userId,
          isStaff: p.user_type === "staff" || p.user_type === "agent_staff",
        };
      });
      setActorMap(map);
    } else {
      setActorMap({});
    }
    setLoading(false);
  };

  const fetchBankAccounts = async () => {
    setBanksLoading(true);
    const { data } = await (supabase as any)
      .from("bank_accounts")
      .select("*")
      .eq("currency", walletCurrency)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setBankAccounts(data || []);
    setBanksLoading(false);
  };

  // Scope txns to the active wallet currency for credits/debits totals + history
  const scopedTxns = transactions.filter(t => {
    const cur = String((t as any).currency || walletCurrency).toUpperCase();
    return cur === walletCurrency.toUpperCase();
  });
  const completedTxns = scopedTxns.filter(t => t.status === "completed");
  const totalCredits = completedTxns
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebits = completedTxns
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + Number(t.amount), 0);

  // ── Category metadata: icon + label + tone for each product family ──
  type Tone = "success" | "destructive" | "warning" | "info" | "muted";
  const CATEGORY_META: Record<string, { label: string; icon: any; tone: Tone }> = {
    flight: { label: "Flight", icon: Plane, tone: "info" },
    hotel: { label: "Hotel", icon: HotelIcon, tone: "info" },
    tour: { label: "Tour", icon: MapPin, tone: "info" },
    transfer: { label: "Transfer", icon: Car, tone: "info" },
    addon: { label: "Add-on", icon: Sparkles, tone: "info" },
    whitelabel: { label: "White-label", icon: Globe, tone: "warning" },
    api: { label: "API Access", icon: CodeIcon, tone: "warning" },
    topup: { label: "Top-up", icon: ArrowDownLeft, tone: "success" },
    commission: { label: "Commission", icon: Users, tone: "info" },
    refund: { label: "Refund", icon: RefreshCw, tone: "warning" },
    other: { label: "Other", icon: Tag, tone: "muted" },
  };
  const deriveCategory = (t: WalletTransaction): keyof typeof CATEGORY_META => {
    if (t.category && CATEGORY_META[t.category]) return t.category as any;
    const ref = (t.reference || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    const blob = ref + " " + desc;
    if (/whitelabel|white-label/.test(blob)) return "whitelabel";
    if (/api[_ ]?access/.test(blob)) return "api";
    // Deposits / top-ups MUST be checked before "transfer" so "deposit via Bank Transfer"
    // isn't wrongly categorised as a ground-transport Transfer.
    if (/deposit|top.?up|wallet\s+deposit/.test(blob) || ref.startsWith("topup")) return "topup";
    if (/flight|pnr/.test(blob)) return "flight";
    if (/hotel/.test(blob)) return "hotel";
    if (/tour|activity/.test(blob)) return "tour";
    if (/airport transfer|transfer booking/.test(blob) || ref.startsWith("transfer")) return "transfer";
    if (/addon|add-on/.test(blob)) return "addon";
    if (/commission/.test(blob)) return "commission";
    if (/refund|reversed|reversal/.test(blob)) return "refund";
    if (t.type === "credit") return "topup";
    return "other";
  };

  // ── Classify each transaction into Type + Status, derive cleaned title ──
  const classifyTxn = (t: WalletTransaction) => {
    const isCredit = t.type === "credit";
    const rawDesc = t.description || "";
    const lower = rawDesc.toLowerCase();
    const status = (t.status || "completed").toLowerCase();

    const cleanTitle = (() => {
      let s = rawDesc.split(/\|/)[0].trim();
      if (status !== "pending") s = s.replace(/\s*\(pending verification\)\s*/i, " ").trim();
      return s || (isCredit ? "Credit" : "Debit");
    })();

    const adminNote = (() => {
      const parts = rawDesc.split(/\|/).slice(1).map(s => s.trim()).filter(Boolean);
      if (!parts.length) return null;
      return parts
        .map(p => p.replace(/^(approved|rejected|reversed|refund(ed)?)[:\s-]*/i, "").trim())
        .filter(Boolean).join(" • ") || null;
    })();

    const statusInfo: { label: string; tone: Tone; key: string } = (() => {
      if (status === "pending") return { label: "Pending", tone: "warning", key: "pending" };
      if (status === "rejected" || status === "failed") return { label: "Rejected", tone: "muted", key: "rejected" };
      if (lower.includes("reversed")) return { label: "Reversed", tone: "warning", key: "reversed" };
      if (lower.includes("refund")) return { label: "Refunded", tone: "info", key: "refunded" };
      return { label: "Completed", tone: "success", key: "completed" };
    })();

    const typeInfo: { label: string; tone: Tone; key: string } = (() => {
      if (lower.includes("setup fee") || lower.includes("white-label") || lower.includes("api access"))
        return { label: "Purchase", tone: "destructive", key: "purchase" };
      if (lower.includes("booking")) return { label: "Booking", tone: "destructive", key: "booking" };
      if (lower.includes("earnings transfer") || lower.includes("sub-agent earnings"))
        return { label: "Earnings", tone: "info", key: "earnings" };
      if (lower.includes("discount subsidy")) return { label: "Subsidy", tone: "warning", key: "subsidy" };
      if (lower.includes("deposit") || lower.includes("top up") || lower.includes("topup"))
        return { label: "Deposit", tone: "success", key: "deposit" };
      return { label: isCredit ? "Credit" : "Debit", tone: isCredit ? "success" : "destructive", key: isCredit ? "credit" : "debit" };
    })();

    const categoryKey = deriveCategory(t);
    const categoryInfo = CATEGORY_META[categoryKey];

    const actorId = t.actor_user_id || null;
    const actor = actorId && actorId !== userId ? actorMap[actorId] : null;
    const actorLabel = actor ? actor.name : "You";
    const actorBadge = actor ? (actor.isSubAgent ? "Sub-agent" : actor.isStaff ? "Staff" : "Member") : null;

    return {
      ...t,
      isCredit,
      cleanTitle,
      adminNote,
      statusInfo,
      typeInfo,
      categoryKey,
      categoryInfo,
      actorLabel,
      actorBadge,
      txnNo: `TXN-${t.id.slice(0, 8).toUpperCase()}`,
      invoiceNo: t.reference?.trim() || null,
      bookingId: t.booking_id || null,
      signedAmount: (isCredit ? 1 : -1) * Number(t.amount),
    };
  };

  const enrichedTxns = scopedTxns.map(classifyTxn);
  const allTypes = Array.from(new Set(enrichedTxns.map(t => t.typeInfo.label))).sort();
  const allStatuses = Array.from(new Set(enrichedTxns.map(t => t.statusInfo.label))).sort();
  const allCategories = Array.from(new Set(enrichedTxns.map(t => t.categoryKey))).sort();

  const filteredTxns = enrichedTxns.filter(t => {
    if (typeFilter !== "all" && t.typeInfo.label !== typeFilter) return false;
    if (statusFilter !== "all" && t.statusInfo.label !== statusFilter) return false;
    if (categoryFilter !== "all" && t.categoryKey !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${t.cleanTitle} ${t.txnNo} ${t.invoiceNo || ""} ${t.adminNote || ""} ${t.actorLabel} ${t.categoryInfo.label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sortedTxns = [...filteredTxns].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "amount": return (a.signedAmount - b.signedAmount) * dir;
      case "type": return a.typeInfo.label.localeCompare(b.typeInfo.label) * dir;
      case "status": return a.statusInfo.label.localeCompare(b.statusInfo.label) * dir;
      case "title": return a.cleanTitle.localeCompare(b.cleanTitle) * dir;
      case "category": return a.categoryInfo.label.localeCompare(b.categoryInfo.label) * dir;
      case "date":
      default:
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "date" || key === "amount" ? "desc" : "asc"); }
  };

  const exportExcel = () => {
    if (!sortedTxns.length) { toast.error("No transactions to export"); return; }
    const rows = sortedTxns.map(t => ({
      "Transaction No": t.txnNo,
      "Date": new Date(t.created_at).toLocaleString(),
      "Category": t.categoryInfo.label,
      "Description": t.cleanTitle,
      "Type": t.typeInfo.label,
      "Status": t.statusInfo.label,
      "Direction": t.isCredit ? "Credit" : "Debit",
      "Amount": Number(t.amount),
      "Currency": String((t as any).currency || walletCurrency).toUpperCase(),
      "Invoice / Reference": t.invoiceNo || "",
      "Booking ID": t.bookingId || "",
      "Initiated By": t.actorLabel,
      "Actor Role": t.actorBadge || "Owner",
      "Note": t.adminNote || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const fname = `wallet-${walletCurrency}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success("Excel downloaded");
  };

  const toneClasses: Record<Tone, string> = {
    success: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
    info: "bg-primary/10 text-primary border-primary/20",
    muted: "bg-muted text-muted-foreground border-border",
  };

  const copyText = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    toast.success(`${label} copied`);
  };

  const handleOnlineDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!selectedPayment) { toast.error("Select a payment method"); return; }

    setProcessing(true);
    try {
      if (selectedPayment === "bkash") {
        const ref = `WAL-${Date.now()}`;
        const res = await processBkashPayment(amt, ref);
        if (!res.success) { toast.error(res.error || "bKash payment failed"); setProcessing(false); return; }
        sessionStorage.setItem("wallet_deposit_amount", String(amt));
        sessionStorage.setItem("wallet_deposit_paymentID", res.paymentID || "");
        sessionStorage.setItem("wallet_deposit_idToken", res.id_token || "");
        if (res.bkashURL) { window.location.href = res.bkashURL; return; }
      }

      const { data, error } = await supabase.functions.invoke("wallet-deposit", {
        body: {
          action: selectedPayment === "bkash" ? "bkash_complete" : "bank_deposit",
          amount: amt,
          currency: walletCurrency,
          paymentMethod: selectedPayment,
          tenantId: tenant?.id || null,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Deposit failed");
        setProcessing(false);
        return;
      }
      toast.success(selectedPayment === "bank" ? "Deposit request submitted for verification." : "Deposit request submitted for processing.");
      closeDeposit();
      onBalanceChange();
      window.dispatchEvent(new Event("wallet:changed"));
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Deposit failed");
    } finally {
      setProcessing(false);
    }
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null;
    setUploadingReceipt(true);
    try {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `receipts/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, receiptFile, { upsert: true });
      if (error) { toast.error("Receipt upload failed"); return null; }
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch {
      toast.error("Receipt upload failed");
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleBankTransferRequest = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!selectedBank) { toast.error("Select a bank account"); return; }

    setProcessing(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt();
      }

      const bank = bankAccounts.find(b => b.id === selectedBank);
      const { data, error } = await supabase.functions.invoke("wallet-deposit", {
        body: {
          action: "bank_deposit",
          amount: amt,
          currency: walletCurrency,
          paymentMethod: "bank_transfer",
          bankAccountId: selectedBank,
          bankName: bank?.bank_name || "",
          transferReference: bankTransferRef,
          receiptUrl,
          tenantId: tenant?.id || null,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Request failed");
        setProcessing(false);
        return;
      }
      toast.success("Bank transfer deposit request submitted! It will be credited after verification.");
      closeDeposit();
      onBalanceChange();
      window.dispatchEvent(new Event("wallet:changed"));
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Request failed");
    } finally {
      setProcessing(false);
    }
  };

  // Handle bKash callback on mount
  useEffect(() => {
    const storedAmount = sessionStorage.getItem("wallet_deposit_amount");
    const paymentID = sessionStorage.getItem("wallet_deposit_paymentID");
    const idToken = sessionStorage.getItem("wallet_deposit_idToken");
    if (storedAmount && paymentID && idToken) {
      sessionStorage.removeItem("wallet_deposit_amount");
      sessionStorage.removeItem("wallet_deposit_paymentID");
      sessionStorage.removeItem("wallet_deposit_idToken");
      const completeBkash = async () => {
        setProcessing(true);
        const { data, error } = await supabase.functions.invoke("wallet-deposit", {
          body: { action: "bkash_complete", amount: parseFloat(storedAmount), paymentID, id_token: idToken, tenantId: tenant?.id || null },
        });
        if (data?.success && data?.transactionStatus === "Completed") {
          toast.success("Wallet topped up via bKash!");
          onBalanceChange();
          window.dispatchEvent(new Event("wallet:changed"));
          fetchTransactions();
        } else {
          toast.error(data?.error || error?.message || "bKash payment was not completed");
        }
        setProcessing(false);
      };
      completeBkash();
    }
  }, []);

  const openDeposit = () => {
    setDepositAmount("");
    setSelectedPayment(methods[0]?.id || "card");
    setSelectedBank("");
    setBankTransferRef("");
    setReceiptFile(null);
    setDepositTab("online");
    setDepositOpen(true);
    fetchBankAccounts();
  };

  const closeDeposit = () => {
    setDepositOpen(false);
    setDepositAmount("");
    setSelectedPayment("");
    setSelectedBank("");
    setBankTransferRef("");
    setReceiptFile(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const onlinePaymentMethods = methods.filter(m => m.id !== "bank");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Wallet</h2>
          <p className="text-sm text-muted-foreground">Manage your wallet balance and transactions</p>
        </div>
        <Button onClick={openDeposit} className="gap-2">
          <Plus className="w-4 h-4" /> Top Up Wallet
        </Button>
      </div>

      {hasMultipleCurrencies && (
        <div className="mb-5 flex flex-wrap gap-2">
          {availableCurrencies!.map((cur) => {
            const bal = balancesByCurrency?.[cur] ?? 0;
            const isActive = cur === walletCurrency;
            return (
              <button
                key={cur}
                onClick={() => onCurrencyChange?.(cur)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span>{cur}</span>
                <span className={`tabular-nums ${isActive ? "opacity-90" : "text-muted-foreground"}`}>
                  {formatCurrencyAmount(bal, cur)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Balance & Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-primary-foreground/80">Available Balance</span>
              </div>
              <p className="text-3xl font-bold">{displayPrice(balance)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5 text-[hsl(var(--success))]" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total Credits</span>
              </div>
              <p className="text-xl font-bold text-foreground">{displayPrice(totalCredits)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total Debits</span>
              </div>
              <p className="text-xl font-bold text-foreground">{displayPrice(totalDebits)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Transaction History
              {!loading && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({sortedTxns.length}{sortedTxns.length !== enrichedTxns.length ? ` of ${enrichedTxns.length}` : ""})
                </span>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search txn, invoice, note…"
                  className="h-8 w-44 sm:w-56 pl-7 text-xs"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_META[c]?.label || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {allStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportExcel} disabled={!sortedTxns.length}>
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : enrichedTxns.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Transactions</h3>
              <p className="text-sm text-muted-foreground mb-4">No {walletCurrency} transactions yet. Top up to get started.</p>
              <Button size="sm" onClick={openDeposit}>
                <Plus className="w-4 h-4 mr-1" /> Top Up
              </Button>
            </div>
          ) : sortedTxns.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No transactions match your filters.
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setSearch(""); }}>
                Reset
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHeader label="Date" active={sortKey === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
                    <SortableHeader label="Category" active={sortKey === "category"} dir={sortDir} onClick={() => toggleSort("category")} />
                    <SortableHeader label="Description" active={sortKey === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
                    <SortableHeader label="Type" active={sortKey === "type"} dir={sortDir} onClick={() => toggleSort("type")} />
                    <SortableHeader label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                    <TableHead className="text-xs">Initiated By</TableHead>
                    <TableHead className="text-xs">Txn / Invoice</TableHead>
                    <SortableHeader label="Amount" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTxns.map((t) => {
                    const fmtDate = new Date(t.created_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    });
                    const dim = t.statusInfo.key === "pending" || t.statusInfo.key === "rejected";
                    return (
                      <TableRow key={t.id} className="align-top">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate}</TableCell>
                        <TableCell>
                          {(() => { const Icon = t.categoryInfo.icon; return (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${toneClasses[t.categoryInfo.tone]}`}>
                              <Icon className="w-3 h-3" /> {t.categoryInfo.label}
                            </Badge>
                          ); })()}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <div className="flex items-start gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              t.isCredit ? "bg-[hsl(var(--success))]/10" : "bg-destructive/10"
                            }`}>
                              {t.isCredit
                                ? <ArrowDownLeft className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                                : <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">{t.cleanTitle}</p>
                              {t.bookingId && (
                                <a
                                  href={`/booking/${t.bookingId}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                                >
                                  View booking <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              {t.adminNote && (
                                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                                  <span className="text-foreground/70">Note:</span> {t.adminNote}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${toneClasses[t.typeInfo.tone]}`}>
                            {t.typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${toneClasses[t.statusInfo.tone]}`}>
                            {t.statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium text-foreground leading-tight truncate max-w-[140px]" title={t.actorLabel}>
                            {t.actorLabel}
                          </p>
                          {t.actorBadge && (
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 mt-0.5 ${
                              t.actorBadge === "Sub-agent" ? toneClasses.info :
                              t.actorBadge === "Staff" ? toneClasses.warning : toneClasses.muted
                            }`}>
                              {t.actorBadge}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => copyText(t.txnNo, "Transaction No")}
                            className="block text-foreground/80 hover:text-foreground truncate max-w-[160px]"
                            title="Copy transaction number"
                          >
                            {t.txnNo}
                          </button>
                          {t.invoiceNo ? (
                            <button
                              type="button"
                              onClick={() => copyText(t.invoiceNo!, "Invoice / Reference")}
                              className="block text-muted-foreground hover:text-foreground truncate max-w-[160px]"
                              title="Copy invoice / reference"
                            >
                              {t.invoiceNo}
                            </button>
                          ) : (
                            <span className="block text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <p className={`text-sm font-bold tabular-nums ${
                            t.isCredit ? "text-[hsl(var(--success))]" : "text-destructive"
                          } ${dim ? "opacity-60" : ""}`}>
                            {t.isCredit ? "+" : "-"}{displayPrice(Number(t.amount))}
                          </p>
                          {t.statusInfo.key === "pending" && (
                            <p className="text-[10px] text-[hsl(var(--warning))]">awaiting verification</p>
                          )}
                          {t.statusInfo.key === "rejected" && (
                            <p className="text-[10px] text-muted-foreground">not credited</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Top Up Wallet
            </DialogTitle>
            <DialogDescription>Choose how you'd like to add funds to your wallet.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Amount input (shared) */}
            <div>
              <Label className="text-sm font-medium">Amount ({walletCurrency})</Label>
              <Input
                type="number"
                min="1"
                step="any"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="mt-1.5 text-lg font-semibold"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={depositAmount === String(amt) ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setDepositAmount(String(amt))}
                  >
                    {formatCurrencyAmount(amt, walletCurrency)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Topup method tabs */}
            <Tabs value={depositTab} onValueChange={setDepositTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="online" className="gap-1.5 text-xs">
                  <Zap className="w-3.5 h-3.5" /> Instant Online
                </TabsTrigger>
                <TabsTrigger value="bank" className="gap-1.5 text-xs">
                  <Landmark className="w-3.5 h-3.5" /> Bank Transfer
                </TabsTrigger>
              </TabsList>

              {/* Online payment tab */}
              <TabsContent value="online" className="mt-3">
                {methodsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading methods…
                  </div>
                ) : onlinePaymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No online payment methods available.</p>
                ) : (
                  <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment} className="space-y-2">
                    {onlinePaymentMethods.map((m) => {
                      const Icon = m.icon;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedPayment === m.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/30 hover:bg-muted/30"
                          }`}
                        >
                          <RadioGroupItem value={m.id} className="sr-only" />
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            selectedPayment === m.id ? "bg-primary/10" : "bg-muted"
                          }`}>
                            <Icon className={`w-4 h-4 ${selectedPayment === m.id ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.description}</p>
                          </div>
                          {selectedPayment === m.id && (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                )}
              </TabsContent>

              {/* Bank transfer tab */}
              <TabsContent value="bank" className="mt-3">
                {banksLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading bank accounts…
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="py-6 text-center">
                    <Landmark className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No bank accounts available for {walletCurrency}.</p>
                    <p className="text-xs text-muted-foreground mt-1">Contact support or try a different payment method.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <RadioGroup value={selectedBank} onValueChange={setSelectedBank} className="space-y-2">
                      {bankAccounts.map((bank) => (
                        <label
                          key={bank.id}
                          className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedBank === bank.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/30 hover:bg-muted/30"
                          }`}
                        >
                          <RadioGroupItem value={bank.id} className="sr-only" />
                          <div className="flex items-center gap-3 mb-2">
                            {bank.logo_url ? (
                              <img src={bank.logo_url} alt={bank.bank_name} className="w-8 h-8 rounded-lg object-contain bg-background border border-border" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{bank.bank_name}</p>
                              {bank.branch && <p className="text-xs text-muted-foreground">{bank.branch}</p>}
                            </div>
                            {selectedBank === bank.id && (
                              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </div>

                          {selectedBank === bank.id && (
                            <div className="mt-3 space-y-2 bg-muted/50 rounded-lg p-3 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Account Name</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-foreground">{bank.account_name}</span>
                                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.preventDefault(); copyToClipboard(bank.account_name, "Account name"); }}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Account Number</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-medium text-foreground">{bank.account_number}</span>
                                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.preventDefault(); copyToClipboard(bank.account_number, "Account number"); }}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              {bank.swift_code && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">SWIFT Code</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-medium text-foreground">{bank.swift_code}</span>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.preventDefault(); copyToClipboard(bank.swift_code, "SWIFT code"); }}>
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {bank.routing_number && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Routing Number</span>
                                  <span className="font-mono font-medium text-foreground">{bank.routing_number}</span>
                                </div>
                              )}
                              {bank.instructions && (
                                <div className="pt-2 border-t border-border/50">
                                  <p className="text-muted-foreground whitespace-pre-line">{bank.instructions}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </label>
                      ))}
                    </RadioGroup>

                    {selectedBank && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Your Transfer Reference (optional)</Label>
                          <Input
                            placeholder="e.g. transaction ID or sender name"
                            value={bankTransferRef}
                            onChange={(e) => setBankTransferRef(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        {/* Receipt Upload */}
                        <div>
                          <Label className="text-xs text-muted-foreground">Upload Receipt (optional)</Label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error("File must be under 5MB");
                                  return;
                                }
                                setReceiptFile(file);
                              }
                            }}
                          />
                          {receiptFile ? (
                            <div className="mt-1 flex items-center gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                              <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="text-sm text-foreground flex-1 truncate">{receiptFile.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1 gap-1.5 w-full"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="w-3.5 h-3.5" /> Choose File
                            </Button>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">Accepted: images or PDF, max 5MB</p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          After transferring, submit this request. Your wallet will be credited once verified by admin.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDeposit} disabled={processing}>
              Cancel
            </Button>
            {depositTab === "online" ? (
              <Button onClick={handleOnlineDeposit} disabled={processing || !depositAmount}>
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processing…</>
                ) : (
                  <><Zap className="w-4 h-4 mr-1" /> Pay {depositAmount ? displayPrice(parseFloat(depositAmount) || 0) : ""}</>
                )}
              </Button>
            ) : (
              <Button onClick={handleBankTransferRequest} disabled={processing || uploadingReceipt || !depositAmount || !selectedBank}>
                {processing || uploadingReceipt ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> {uploadingReceipt ? "Uploading…" : "Submitting…"}</>
                ) : (
                  <><Landmark className="w-4 h-4 mr-1" /> Submit Request {depositAmount ? displayPrice(parseFloat(depositAmount) || 0) : ""}</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default WalletSection;
