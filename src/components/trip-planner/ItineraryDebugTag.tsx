import { Badge } from "@/components/ui/badge";
import { Bot, User, Cpu, Globe } from "lucide-react";

interface Props {
  createdBy?: string;
  lastModifiedSource?: string | null;
  currentVersion?: number;
  itineraryCode?: string | null;
  className?: string;
}

const SOURCE_ICON: Record<string, any> = {
  ai: Bot,
  user: User,
  system: Cpu,
  api: Globe,
};

/**
 * Compact inline tag showing creation/modification info for internal debugging.
 * "Created: AI | Last Updated: USER | Version: v3"
 */
export default function ItineraryDebugTag({ createdBy, lastModifiedSource, currentVersion, itineraryCode, className }: Props) {
  const ModIcon = SOURCE_ICON[lastModifiedSource || ""] || Cpu;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground ${className || ""}`}>
      {itineraryCode && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold border-primary/30 text-primary">
          {itineraryCode}
        </Badge>
      )}
      {createdBy && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 border-border">
          Created: <span className="capitalize font-medium">{createdBy}</span>
        </Badge>
      )}
      {lastModifiedSource && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 border-border">
          <ModIcon className="h-2.5 w-2.5" />
          Updated: <span className="capitalize font-medium">{lastModifiedSource}</span>
        </Badge>
      )}
      {currentVersion != null && currentVersion > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono border-border">
          v{currentVersion}
        </Badge>
      )}
    </div>
  );
}
