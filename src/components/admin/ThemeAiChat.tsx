import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Sparkles, Bot, User } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ThemeChanges {
  color_changes?: Record<string, string>;
  font_heading?: string;
  font_body?: string;
  radius?: string;
  explanation: string;
}

interface ThemeAiChatProps {
  currentTheme: {
    preset: string;
    overrides: Record<string, string>;
    fontHeading: string;
    fontBody: string;
    radius: string;
  };
  onApplyChanges: (changes: ThemeChanges) => void;
}

export default function ThemeAiChat({ currentTheme, onApplyChanges }: ThemeAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const SUGGESTIONS = [
    "Make it more vibrant and colorful",
    "Switch to a dark theme",
    "Use warmer tones",
    "Make fonts more elegant",
    "Increase border radius for a softer look",
  ];

  const handleSend = async (text?: string) => {
    const instruction = text || input.trim();
    if (!instruction || loading) return;

    const userMsg: ChatMessage = { role: "user", content: instruction };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-design-generator", {
        body: {
          action: "tweak-theme",
          instruction,
          currentTheme: {
            overrides: currentTheme.overrides,
            fontHeading: currentTheme.fontHeading,
            fontBody: currentTheme.fontBody,
            radius: currentTheme.radius,
          },
          chatHistory: messages.slice(-10), // last 10 messages for context
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to get AI response");
      }

      const changes: ThemeChanges = data.changes;
      const assistantMsg: ChatMessage = { role: "assistant", content: changes.explanation };
      setMessages((prev) => [...prev, assistantMsg]);

      // Apply changes
      onApplyChanges(changes);
      toast.success("Theme updated! Review the changes above.");
    } catch (e: any) {
      const errMsg = e.message || "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      toast.error(errMsg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-3">
      {/* Chat messages */}
      {messages.length > 0 ? (
        <ScrollArea className="h-[240px] rounded-lg border bg-muted/30 p-3">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border text-card-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-card border">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Tell the AI what to change — try a suggestion:
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-background border hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="e.g. Make the primary color more blue..."
          disabled={loading}
          className="text-sm"
        />
        <Button size="icon" onClick={() => handleSend()} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
