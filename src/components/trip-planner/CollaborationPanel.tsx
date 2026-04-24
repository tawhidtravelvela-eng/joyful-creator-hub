import { useState } from "react";
import { Users, Plus, X, Crown, Eye, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Collaborator, PresenceUser } from "@/hooks/useTripCollaboration";

interface Props {
  collaborators: Collaborator[];
  presenceUsers: PresenceUser[];
  isOwner: boolean;
  onAdd: (email: string, role: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  ownerEmail?: string;
}

const CollaborationPanel = ({ collaborators, presenceUsers, isOwner, onAdd, onRemove, ownerEmail }: Props) => {
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setAdding(true);
    const ok = await onAdd(email.trim(), role);
    if (ok) { setEmail(""); setShowAdd(false); }
    setAdding(false);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Header with presence indicators */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Collaborators</span>
          {presenceUsers.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              · {presenceUsers.length + 1} online
            </span>
          )}
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {/* Online presence avatars */}
      {presenceUsers.length > 0 && (
        <div className="px-4 py-2 border-b border-border/30 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Online:</span>
          {presenceUsers.map((p) => (
            <div
              key={p.userId}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-card"
              style={{ backgroundColor: p.color }}
              title={p.email}
            >
              {p.email.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="px-4 py-3 border-b border-border/30 space-y-2">
          <Input
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRole("editor")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors",
                role === "editor" ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
              )}
            >
              <PencilLine className="w-3 h-3" /> Editor
            </button>
            <button
              onClick={() => setRole("viewer")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors",
                role === "viewer" ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
              )}
            >
              <Eye className="w-3 h-3" /> Viewer
            </button>
            <Button size="sm" className="h-7 px-3 text-[10px] ml-auto" onClick={handleAdd} disabled={adding || !email.trim()}>
              {adding ? "Adding..." : "Invite"}
            </Button>
          </div>
        </div>
      )}

      {/* Collaborators list */}
      <div className="divide-y divide-border/30">
        {/* Owner */}
        <div className="px-4 py-2.5 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <Crown className="w-3 h-3 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground truncate">{ownerEmail || "Owner"}</p>
            <p className="text-[9px] text-muted-foreground">Owner</p>
          </div>
        </div>

        {collaborators.map((collab) => {
          const isOnline = presenceUsers.some(p => p.userId === collab.user_id);
          return (
            <div key={collab.id} className="px-4 py-2.5 flex items-center gap-2.5">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-primary-foreground",
                isOnline ? "bg-primary" : "bg-muted-foreground/40"
              )}>
                {(collab.email || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{collab.email || collab.user_id.slice(0, 8)}</p>
                <p className="text-[9px] text-muted-foreground capitalize flex items-center gap-1">
                  {collab.role === "editor" ? <PencilLine className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                  {collab.role}
                  {isOnline && <span className="text-primary ml-1">● online</span>}
                </p>
              </div>
              {isOwner && (
                <button onClick={() => onRemove(collab.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {collaborators.length === 0 && !showAdd && (
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] text-muted-foreground">No collaborators yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaborationPanel;
