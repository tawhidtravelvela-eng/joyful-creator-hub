import { supabase } from "@/integrations/supabase/client";

interface CurrencySnapshot {
  booked_currency: string;
  source_amount?: number;
  source_currency?: string;
  fx_rate_used?: number;
  fx_markup_used?: number;
}

interface BookingData {
  type: string;
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
  total: number;
  bookingId: string;
  confirmationData?: Record<string, any>;
  tenantId?: string | null;
  currencySnapshot?: CurrencySnapshot;
}

export const saveBooking = async (data: BookingData, status: string = "Paid"): Promise<string | null> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  const cs = data.currencySnapshot;

  const { data: row, error } = await supabase.from("bookings").insert({
    user_id: user.id,
    booking_id: data.bookingId,
    type: data.type,
    title: data.title,
    subtitle: data.subtitle,
    details: data.details as any,
    total: data.total,
    status,
    ...(data.tenantId ? { tenant_id: data.tenantId } : {}),
    ...(data.confirmationData ? { confirmation_data: data.confirmationData } as any : {}),
    ...(cs ? {
      booked_currency: cs.booked_currency,
      source_amount: cs.source_amount,
      source_currency: cs.source_currency,
      fx_rate_used: cs.fx_rate_used,
      fx_markup_used: cs.fx_markup_used,
    } as any : {}),
  }).select("id").single();

  return error ? null : row.id;
};

export const updateBookingStatus = async (id: string, status: string): Promise<boolean> => {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  return !error;
};

export const processBkashPayment = async (amount: number, bookingId: string): Promise<{ success: boolean; bkashURL?: string; paymentID?: string; id_token?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("bkash-payment", {
    body: {
      action: "create",
      amount,
      bookingId,
      callbackURL: `${window.location.origin}/booking/confirmation`,
    },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "bKash payment creation failed" };
  return { success: true, bkashURL: data.bkashURL, paymentID: data.paymentID, id_token: data.id_token };
};

export const executeBkashPayment = async (paymentID: string, id_token: string): Promise<{ success: boolean; transactionStatus?: string; trxID?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("bkash-payment", {
    body: { action: "execute", paymentID, id_token },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "bKash execution failed" };
  return { success: true, transactionStatus: data.transactionStatus, trxID: data.trxID };
};

export const processAlipayPayment = async (amount: number, bookingId: string): Promise<{ success: boolean; payURL?: string; outTradeNo?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("alipay-payment", {
    body: {
      action: "create",
      amount,
      bookingId,
      callbackURL: `${window.location.origin}/booking/confirmation`,
    },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "Alipay payment creation failed" };
  return { success: true, payURL: data.payURL, outTradeNo: data.outTradeNo };
};

export const queryAlipayPayment = async (tradeNo: string): Promise<{ success: boolean; trade_status?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("alipay-payment", {
    body: { action: "query", trade_no: tradeNo },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "Alipay query failed" };
  return { success: true, trade_status: data.trade_status };
};

export const processAirwallexPayment = async (
  amount: number,
  currency: string,
  bookingId: string,
  returnUrl: string
): Promise<{ success: boolean; intentId?: string; clientSecret?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("airwallex-payment", {
    body: { action: "create", amount, currency, bookingId, returnUrl },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "Airwallex payment creation failed" };
  return { success: true, intentId: data.intentId, clientSecret: data.clientSecret };
};

export const confirmAirwallexPayment = async (
  intentId: string
): Promise<{ success: boolean; status?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("airwallex-payment", {
    body: { action: "confirm", intentId },
  });
  if (error || !data?.success) return { success: false, error: data?.error || error?.message || "Airwallex confirmation failed" };
  return { success: true, status: data.status };
};
