/**
 * LogoUploader — reusable logo upload + URL input.
 * Uploads to the `assets` bucket under an allowed prefix (logos/whitelabel/avatars).
 * Falls back to manual URL entry. Used by affiliate quick-launch and the studio AI panel.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  /** Storage folder prefix. Must match storage RLS allowed prefixes. */
  folder?: "logos" | "whitelabel" | "avatars";
  /** Optional sub-path appended after folder/ (e.g. affiliate id). */
  subPath?: string;
  label?: string;
  helpText?: string;
  maxSizeMB?: number;
  className?: string;
}

export default function LogoUploader({
  value,
  onChange,
  folder = "logos",
  subPath,
  label = "Logo",
  helpText = "PNG, JPG or SVG. Square works best. Max 2MB.",
  maxSizeMB = 2,
  className,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({ title: `Logo must be under ${maxSizeMB}MB`, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const safeSub = subPath ? `${subPath.replace(/[^a-zA-Z0-9-_]/g, "")}/` : "";
      const path = `${folder}/${safeSub}${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}.${ext}`;

      const { error } = await supabase.storage
        .from("assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast({ title: "Logo uploaded" });
    } catch (e: any) {
      console.error("[LogoUploader] upload failed", e);
      toast({
        title: "Upload failed",
        description: e.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {label && <Label className="text-xs">{label}</Label>}

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="h-16 w-16 shrink-0 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
          {value ? (
            <img
              src={value}
              alt="Logo preview"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-1.5">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5 h-8"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : value ? "Replace" : "Upload logo"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
                disabled={uploading}
                className="h-8 px-2"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste a logo URL"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">{helpText}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
