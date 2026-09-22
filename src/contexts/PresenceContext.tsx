"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import { getInfo } from "@/lib/users";
import { formatRelativeDate } from "@/lib/utils";

type PresenceUserData = {
  username: string;
  online_at: string;
};

interface PresenceContextType {
  onlineCount: number;
  totalUsers: number;
  onlineUsers: Record<string, PresenceUserData>;
  isUserOnline: (userId?: string | null, username?: string | null) => boolean;
  getUserLastSeen: (
    userId?: string | null,
    username?: string | null,
    fallbackDate?: string | null
  ) => { isOnline: boolean; text: string };
  refreshTotalUsers: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineCount: 1,
  totalUsers: 0,
  onlineUsers: {},
  isUserOnline: () => false,
  getUserLastSeen: () => ({ isOnline: false, text: "Offline" }),
  refreshTotalUsers: async () => {},
});

export const usePresence = () => useContext(PresenceContext);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUserData>>({});
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const channelRef = useRef<any>(null);

  // Fetch total registered users
  const refreshTotalUsers = useCallback(async () => {
    try {
      const info = await getInfo();
      if (info && info.total_users > 0) {
        setTotalUsers(info.total_users);
        return;
      }

      // Fallback query if getInfo() returns null
      const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (!error && typeof count === "number") {
        setTotalUsers(count);
      }
    } catch (err) {
      console.error("Failed to fetch total users count:", err);
    }
  }, []);

  useEffect(() => {
    refreshTotalUsers();
    // Refresh total users every 2 minutes
    const interval = setInterval(refreshTotalUsers, 120000);
    return () => clearInterval(interval);
  }, [refreshTotalUsers]);

  // Periodic heartbeat to record user activity in database
  useEffect(() => {
    if (!user?.id) return;

    const pingHeartbeat = () => {
      fetch("/api/user/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {});
    };

    pingHeartbeat();
    const timer = setInterval(pingHeartbeat, 180000); // 3 minutes
    return () => clearInterval(timer);
  }, [user?.id]);

  // Realtime Presence Tracker
  useEffect(() => {
    if (!user) {
      setOnlineUsers({});
      return;
    }

    const channel = supabase.channel("presence-platform-users", {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const map: Record<string, PresenceUserData> = {};

      Object.keys(state).forEach((uid) => {
        const presences = state[uid];
        if (presences && presences.length > 0) {
          const latest = presences[presences.length - 1];
          map[uid] = {
            username: latest?.username || "User",
            online_at: latest?.online_at || new Date().toISOString(),
          };
        }
      });

      // Ensure current user is present
      if (user.id && !map[user.id]) {
        map[user.id] = {
          username: user.username || "User",
          online_at: new Date().toISOString(),
        };
      }

      setOnlineUsers(map);
    });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: user.id,
          username: user.username || "User",
          role: user.is_admin ? "admin" : "user",
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  // Helper: check if a user is online by ID or username
  const isUserOnline = useCallback(
    (userId?: string | null, username?: string | null): boolean => {
      if (!userId && !username) return false;
      if (userId && onlineUsers[userId]) return true;
      if (username) {
        const unameLower = username.toLowerCase();
        return Object.values(onlineUsers).some(
          (u) => u.username.toLowerCase() === unameLower
        );
      }
      return false;
    },
    [onlineUsers]
  );

  // Helper: get human readable last seen or online status
  const getUserLastSeen = useCallback(
    (
      userId?: string | null,
      username?: string | null,
      fallbackDate?: string | null
    ): { isOnline: boolean; text: string } => {
      if (isUserOnline(userId, username)) {
        return { isOnline: true, text: "Online" };
      }

      // If we have recorded an online_at for this user earlier
      if (userId && onlineUsers[userId]?.online_at) {
        return {
          isOnline: false,
          text: `Active ${formatRelativeDate(onlineUsers[userId].online_at)}`,
        };
      }

      // Use fallback activity date (e.g. solve time or update time)
      if (fallbackDate) {
        return {
          isOnline: false,
          text: `Active ${formatRelativeDate(fallbackDate)}`,
        };
      }

      return { isOnline: false, text: "Offline" };
    },
    [isUserOnline, onlineUsers]
  );

  // At least 1 user online if current user is logged in
  const onlineCount = Math.max(Object.keys(onlineUsers).length, user ? 1 : 0);

  return (
    <PresenceContext.Provider
      value={{
        onlineCount,
        totalUsers,
        onlineUsers,
        isUserOnline,
        getUserLastSeen,
        refreshTotalUsers,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
