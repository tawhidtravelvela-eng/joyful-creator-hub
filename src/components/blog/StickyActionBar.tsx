import { useNavigate } from "react-router-dom";
import { Sparkles, Plane, Hotel } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const StickyActionBar = ({ visible }: { visible: boolean }) => {
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/40 shadow-2xl shadow-black/20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => navigate("/trip-planner")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold transition-colors shadow-md shadow-accent/20 min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5" /> Plan Trip
            </button>
            <button
              onClick={() => navigate("/flights")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors min-h-[44px]"
            >
              <Plane className="w-3.5 h-3.5" /> Flights
            </button>
            <button
              onClick={() => navigate("/hotels")}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors min-h-[44px]"
            >
              <Hotel className="w-3.5 h-3.5" /> Hotels
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyActionBar;
