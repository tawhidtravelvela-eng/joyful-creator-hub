/**
 * Records a top-level affiliate conversion when a booking is confirmed.
 *
 * Sub-affiliate conversion logic is temporarily disabled — the legacy
 * whitelabel_sub_affiliates tables were dropped in Phase 0c. Will be
 * reintroduced in Phase 1.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredAttribution,
  clearStoredAttribution,
} from "@/hooks/useAffiliateTracking";

interface ConversionInput {
  bookingId: string;
  bookingAmount: number;
  currency?: string;
  productType?: string;
}

export async function recordAffiliateConversion(input: ConversionInput): Promise<void> {
  const { affiliateId } = getStoredAttribution();
  if (!affiliateId) return;

  const currency = input.currency || "USD";

  try {
    const { data: aff } = await supabase
      .from("affiliates")
      .select("commission_rate")
      .eq("id", affiliateId)
      .maybeSingle();

    const rate = Number(aff?.commission_rate ?? 5);
    const commission = Math.round(input.bookingAmount * (rate / 100) * 100) / 100;

    await supabase.from("affiliate_conversions").insert({
      affiliate_id: affiliateId,
      booking_id: input.bookingId,
      booking_amount: input.bookingAmount,
      commission_rate: rate,
      commission_amount: commission,
      currency,
      status: "pending",
    });
  } catch (e) {
    console.warn("[affiliate] conversion recording failed", e);
  } finally {
    clearStoredAttribution();
  }
}
