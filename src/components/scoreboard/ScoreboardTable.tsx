import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import ImageWithFallback from "@/components/ImageWithFallback";
import { LeaderboardEntry } from "@/types";
import { usePresence } from "@/contexts/PresenceContext";

interface ScoreboardTableProps {
  leaderboard: LeaderboardEntry[];
  currentUsername?: string;
}

const ScoreboardTable: React.FC<ScoreboardTableProps> = ({
  leaderboard,
  currentUsername,
}) => {
  const pathname = usePathname();
  const { isUserOnline } = usePresence();

  return (
    <Card className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <CardTitle className="text-lg font-bold tracking-wide text-slate-900 dark:text-white">
            Leaderboard Ranking
          </CardTitle>
        </div>
        {pathname === "/scoreboard" && (
          <Link href="/scoreboard/all">
            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs text-white">
              Show All
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
              <TableHead className="w-16 text-center text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                Rank
              </TableHead>
              <TableHead className="text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                User
              </TableHead>
              <TableHead className="text-right sm:text-center text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider pr-4">
                Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry, i) => {
              const isCurrentUser = entry.username === currentUsername;
              const rankNum = entry.rank || i + 1;

              return (
                <TableRow
                  key={entry.username}
                  className={`
                    transition-all border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40
                    ${
                      isCurrentUser
                        ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                        : ""
                    }
                  `}
                >
                  {/* Rank Column with Badges */}
                  <TableCell className="text-center py-3">
                    {rankNum === 1 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/50 font-bold font-mono text-sm shadow-xs">
                        1
                      </span>
                    ) : rankNum === 2 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-300/20 dark:text-slate-200 dark:border-slate-300/50 font-bold font-mono text-sm shadow-xs">
                        2
                      </span>
                    ) : rankNum === 3 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-600/20 dark:text-amber-300 dark:border-amber-600/50 font-bold font-mono text-sm shadow-xs">
                        3
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-semibold">
                        #{rankNum}
                      </span>
                    )}
                  </TableCell>

                  {/* User Column with Circular Avatar */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar container with circular ring */}
                      <div className="relative shrink-0">
                        <ImageWithFallback
                          src={entry.picture}
                          alt={entry.username}
                          size={34}
                          className={`rounded-full ring-2 transition-transform duration-200 hover:scale-105 ${
                            rankNum === 1
                              ? "ring-yellow-400 shadow-sm"
                              : rankNum === 2
                              ? "ring-slate-300 shadow-sm"
                              : rankNum === 3
                              ? "ring-amber-500 shadow-sm"
                              : "ring-slate-200 dark:ring-slate-700/80 border border-slate-100 dark:border-slate-800"
                          }`}
                        />
                        {rankNum <= 3 && (
                          <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                            {rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : "🥉"}
                          </span>
                        )}
                        {isUserOnline(entry.id, entry.username) && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                            title="Online"
                          />
                        )}
                      </div>

                      {/* Username & Badges */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/user/${encodeURIComponent(entry.username)}`}
                          className={`hover:underline font-semibold text-sm truncate ${
                            isCurrentUser
                              ? "text-blue-600 dark:text-blue-400 font-bold"
                              : "text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                          title={entry.username}
                        >
                          {entry.username}
                        </Link>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Score Column */}
                  <TableCell className="text-right sm:text-center py-3 pr-4">
                    <span className="font-bold text-sm text-blue-600 dark:text-cyan-400 font-mono tracking-tight">
                      {entry.score.toLocaleString()}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal ml-1">pts</span>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ScoreboardTable;
