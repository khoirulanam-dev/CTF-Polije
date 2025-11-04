import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { AuditLogEntry, getAuditLogs } from "@/lib/log";
import { formatRelativeDate } from "@/lib/utils";
import Loader from "@/components/custom/loading";

interface AuditLogListProps {
  // Kalau parent ngirim logs & isLoading, komponen pakai itu.
  // Kalau tidak, komponen fetch sendiri lewat getAuditLogs.
  logs?: AuditLogEntry[];
  isLoading?: boolean;
}

type ActionType =
  | "login"
  | "logout"
  | "user_signedup"
  | "user_deleted"
  | "token_refreshed";

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "user_signedup", label: "Sign Up" },
  { value: "user_deleted", label: "Deleted" },
  { value: "token_refreshed", label: "Session Renewed" },
];

const getActionStyle = (action: string): { color: string; icon: string } => {
  switch (action) {
    case "login":
      return {
        color: "text-green-600 dark:text-green-400",
        icon: "→",
      };
    case "logout":
      return {
        color: "text-yellow-600 dark:text-yellow-400",
        icon: "←",
      };
    case "user_signedup":
      return {
        color: "text-blue-600 dark:text-blue-400",
        icon: "+",
      };
    case "user_deleted":
      return {
        color: "text-red-600 dark:text-red-400",
        icon: "×",
      };
    case "token_refreshed":
      return {
        color: "text-purple-600 dark:text-purple-400",
        icon: "⟲",
      };
    default:
      return {
        color: "text-gray-600 dark:text-gray-400",
        icon: "•",
      };
  }
};

// Ubah label “token_refreshed” → “Session Renewed”
const formatAction = (action: string) => {
  if (action === "token_refreshed") {
    return "Session Renewed";
  }

  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const AuditLogList: React.FC<AuditLogListProps> = ({ logs, isLoading }) => {
  const [selectedActions, setSelectedActions] = React.useState<ActionType[]>(
    []
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  // state internal kalau parent tidak mengirim logs
  const [internalLogs, setInternalLogs] = React.useState<AuditLogEntry[]>([]);
  const [internalLoading, setInternalLoading] = React.useState(false);
  const [limit, setLimit] = React.useState(50);

  const toggleAction = (action: ActionType) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  // sumber data: pakai props kalau ada, kalau tidak pakai internal
  const sourceLogs = React.useMemo(
    () => (logs ? logs : internalLogs),
    [logs, internalLogs]
  );
  const loadingState = isLoading ?? internalLoading;

  // fetch audit logs kalau parent tidak mengirim logs
  React.useEffect(() => {
    let mounted = true;

    const fetchLogs = async () => {
      if (logs) return; // parent sudah provide, jangan fetch

      try {
        setInternalLoading(true);
        const data = await getAuditLogs(limit);
        if (!mounted) return;
        setInternalLogs(data || []);
      } catch (err) {
        console.error("Error fetching audit logs:", err);
        if (mounted) setInternalLogs([]);
      } finally {
        if (mounted) setInternalLoading(false);
      }
    };

    fetchLogs();
    return () => {
      mounted = false;
    };
  }, [limit, logs]);

  const filteredLogs = React.useMemo(() => {
    return sourceLogs.filter((log) => {
      const action = log.payload.action as string;

      // ⛔ log action `token_revoked` tidak ditampilkan sama sekali
      if (action === "token_revoked") {
        return false;
      }

      const matchesAction =
        selectedActions.length === 0 ||
        selectedActions.includes(action as ActionType);

      const email =
        action === "user_deleted"
          ? log.payload.traits?.user_email
          : log.payload.actor_username;

      const matchesSearch =
        !searchQuery ||
        email?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesAction && matchesSearch;
    });
  }, [sourceLogs, selectedActions, searchQuery]);

  if (loadingState) {
    return (
      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Recent Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Loader fullscreen={false} color="text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Recent Audit Logs</CardTitle>

        {/* selector limit */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Limit
          </span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="appearance-none text-xs px-3 py-1.5 pr-8 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
            <option value={1000}>Last 1000</option>
            <option value={2500}>Last 2500</option>
            <option value={5000}>Last 5000</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* filter actions + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* checkbox multi-select */}
          <div className="flex flex-wrap gap-2">
            {ACTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition ${
                  selectedActions.includes(opt.value)
                    ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-300"
                    : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={selectedActions.includes(opt.value)}
                  onChange={() => toggleAction(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* search email */}
          <div className="flex-1 min-w-[180px] sm:max-w-xs">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by email..."
              className="w-full text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* stats */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {filteredLogs.length} of {sourceLogs.length} logs
          {searchQuery && (
            <>
              {" "}
              matching{" "}
              <span className="font-semibold">&quot;{searchQuery}&quot;</span>
            </>
          )}
        </div>

        {/* list log */}
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const action = log.payload.action as string;
            const isUserDeleted = action === "user_deleted";
            const userEmail = isUserDeleted
              ? log.payload.traits?.user_email
              : log.payload.actor_username;
            const style = getActionStyle(action);

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-slate-900/60 px-3 py-2 text-xs"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={style.color}>
                      {style.icon} {formatAction(action)}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {userEmail}
                    </span>
                    {log.payload.traits?.provider && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        {log.payload.traits.provider}
                      </span>
                    )}
                  </div>
                  {isUserDeleted && log.payload.traits?.user_id && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      ID: {log.payload.traits.user_id.slice(0, 8)}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-gray-400">
                  {formatRelativeDate(log.created_at)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditLogList;
