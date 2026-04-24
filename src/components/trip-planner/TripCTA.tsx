import React from "react";
import { motion } from "framer-motion";
import { ShoppingCart, PencilLine, Download, Loader2, Shield, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TripCTAProps {
  totalPrice: number;
  formatPrice: (n: number) => string;
  onBook: () => void;
  onCustomize: () => void;
  onDownloadPDF: () => void;
  pdfDownloading: boolean;
  loading: boolean;
}

const TripCTA: React.FC<TripCTAProps> = ({
  totalPrice, formatPrice, onBook, onCustomize, onDownloadPDF, pdfDownloading, loading,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--p-card)) 100%)`,
        border: `1px solid hsl(var(--primary) / 0.25)`,
        boxShadow: `0 8px 32px hsl(var(--primary) / 0.12)`,
      }}
    >
      <div className="p-5 space-y-3">
        {/* Primary CTA */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
          <Button
            onClick={onBook}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold gap-2 shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
          >
            <ShoppingCart className="w-4 h-4" />
            Book This Trip · {formatPrice(totalPrice)}
          </Button>
        </motion.div>

        {/* Secondary CTA */}
        <Button
          onClick={onCustomize}
          disabled={loading}
          variant="outline"
          className="w-full h-10 rounded-xl text-sm font-semibold gap-2 border-accent/30 text-accent hover:bg-accent/5"
        >
          <PencilLine className="w-4 h-4" />
          Customize Plan
        </Button>

        {/* PDF Download */}
        <button
          onClick={onDownloadPDF}
          disabled={pdfDownloading}
          className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ color: `hsl(var(--p-text-muted))` }}
        >
          {pdfDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {pdfDownloading ? "Generating PDF…" : "Download Itinerary PDF"}
        </button>

        {/* Trust / urgency */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <AlertTriangle className="w-3 h-3" style={{ color: `hsl(var(--warning))` }} />
          <span className="text-[10px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>
            Price may change based on availability
          </span>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
            <Shield className="w-2.5 h-2.5" /> Secure Payment
          </span>
          <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
            <Sparkles className="w-2.5 h-2.5" /> AI Verified
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default TripCTA;
