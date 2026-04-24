import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const items = (data || []) as unknown as Notification[];
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.is_read).length);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    await supabase
      .from("notifications" as any)
      .update({ is_read: true } as any)
      .eq("id", notificationId)
      .eq("user_id", user.id);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications" as any)
      .update({ is_read: true } as any)
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  // Fetch on mount and subscribe to realtime changes
  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as unknown as Notification;
        setNotifications(prev => [newNotif, ...prev].slice(0, 20));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllRead, refetch: fetchNotifications };
}
