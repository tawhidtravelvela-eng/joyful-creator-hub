import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  created_at: string;
}

export interface PresenceUser {
  userId: string;
  email: string;
  color: string;
  joinedAt: string;
}

const PRESENCE_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316",
];

export function useTripCollaboration(tripId: string | null) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const colorIndexRef = useRef(0);

  // Fetch collaborators list
  const fetchCollaborators = useCallback(async () => {
    if (!tripId || !user) return;
    try {
      const { data, error } = await supabase
        .from("trip_collaborators" as any)
        .select("*")
        .eq("trip_id", tripId);
      if (error) throw error;
      setCollaborators((data || []) as unknown as Collaborator[]);
    } catch (err) {
      console.error("Failed to fetch collaborators:", err);
    }
  }, [tripId, user]);

  // Check ownership
  useEffect(() => {
    if (!tripId || !user) return;
    supabase
      .from("saved_trips")
      .select("user_id")
      .eq("id", tripId)
      .single()
      .then(({ data }) => {
        setIsOwner((data as any)?.user_id === user.id);
      });
  }, [tripId, user]);

  // Add collaborator by email
  const addCollaborator = useCallback(async (email: string, role: string = "editor") => {
    if (!tripId || !user || !isOwner) {
      toast({ title: "Only trip owners can add collaborators", variant: "destructive" });
      return false;
    }

    // Look up user by email in profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("email", email)
      .single();

    if (profileErr || !profile) {
      toast({ title: "User not found", description: "No account with that email.", variant: "destructive" });
      return false;
    }

    const targetUserId = (profile as any).user_id;
    if (targetUserId === user.id) {
      toast({ title: "That's you!", description: "You're already the owner.", variant: "destructive" });
      return false;
    }

    const { error } = await supabase
      .from("trip_collaborators" as any)
      .insert({ trip_id: tripId, user_id: targetUserId, role, invited_by: user.id } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already a collaborator" });
      } else {
        toast({ title: "Failed to add collaborator", description: error.message, variant: "destructive" });
      }
      return false;
    }

    toast({ title: "Collaborator added ✓", description: `${email} can now ${role === "editor" ? "edit" : "view"} this trip.` });
    fetchCollaborators();
    return true;
  }, [tripId, user, isOwner, fetchCollaborators]);

  // Remove collaborator
  const removeCollaborator = useCallback(async (collaboratorId: string) => {
    if (!tripId || !isOwner) return;
    await supabase
      .from("trip_collaborators" as any)
      .delete()
      .eq("id", collaboratorId);
    setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    toast({ title: "Collaborator removed" });
  }, [tripId, isOwner]);

  // Setup Realtime presence + broadcast
  useEffect(() => {
    if (!tripId || !user) return;

    fetchCollaborators();

    const channel = supabase.channel(`trip-collab:${tripId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const [, presences] of Object.entries(state)) {
          for (const p of presences as any[]) {
            if (p.userId !== user.id) {
              users.push({
                userId: p.userId,
                email: p.email || "Unknown",
                color: p.color || PRESENCE_COLORS[0],
                joinedAt: p.joinedAt || new Date().toISOString(),
              });
            }
          }
        }
        setPresenceUsers(users);
      })
      .on("broadcast", { event: "trip_update" }, ({ payload }) => {
        // Dispatch a custom event so the TripPlanner can react
        window.dispatchEvent(new CustomEvent("trip-collab-update", { detail: payload }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const color = PRESENCE_COLORS[colorIndexRef.current % PRESENCE_COLORS.length];
          colorIndexRef.current++;
          await channel.track({
            userId: user.id,
            email: user.email || "Unknown",
            color,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tripId, user, fetchCollaborators]);

  // Broadcast a trip update to other collaborators
  const broadcastUpdate = useCallback((type: string, data: any) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "trip_update",
      payload: { type, data, userId: user.id, timestamp: Date.now() },
    });
  }, [user]);

  return {
    collaborators,
    presenceUsers,
    isOwner,
    addCollaborator,
    removeCollaborator,
    broadcastUpdate,
    fetchCollaborators,
  };
}
