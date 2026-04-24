import { useState } from "react";
import { Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SocialShareButtons from "./SocialShareButtons";

const ShareFloater = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const title = "Check out these travel stories";

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="bg-card border border-border/40 rounded-2xl p-2 shadow-xl mb-2"
          >
            <div className="flex flex-col gap-1.5">
              <SocialShareButtons
                title={title}
                url={url}
                copied={copied}
                onCopy={handleCopy}
                layout="inline"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-card border border-border/40 shadow-lg flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/30 transition-all"
        aria-label="Share this page"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ShareFloater;
