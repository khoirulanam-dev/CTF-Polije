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

interface ScoreboardTableProps {
  leaderboard: LeaderboardEntry[];
  currentUsername?: string;
}

const ScoreboardTable: React.FC<ScoreboardTableProps> = ({
  leaderboard,
  currentUsername,
}) => {
  const pathname = usePathname();

  return (
    <Card className="bg-slate-900/60 dark:bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <CardTitle className="text-lg font-bold tracking-wide text-white">
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
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="w-16 text-center text-slate-400 font-semibold text-xs uppercase tracking-wider">
                Rank
              </TableHead>
              <TableHead className="text-slate-400 font-semibold text-xs uppercase tracking-wider">
                User
              </TableHead>
              <TableHead className="text-right sm:text-center text-slate-400 font-semibold text-xs uppercase tracking-wider pr-4">
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
                    transition-all border-slate-800/60 hover:bg-slate-800/40
                    ${
                      isCurrentUser
                        ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15"
                        : ""
                    }
                  `}
                >
                  {/* Rank Column with Badges */}
                  <TableCell className="text-center py-3">
                    {rankNum === 1 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 font-bold font-mono text-sm shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                        1
                      </span>
                    ) : rankNum === 2 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/50 font-bold font-mono text-sm shadow-[0_0_6px_rgba(203,213,225,0.3)]">
                        2
                      </span>
                    ) : rankNum === 3 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/20 text-amber-300 border border-amber-600/50 font-bold font-mono text-sm shadow-[0_0_6px_rgba(217,119,6,0.3)]">
                        3
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-slate-400 font-semibold">
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
                              ? "ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                              : rankNum === 2
                              ? "ring-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.4)]"
                              : rankNum === 3
                              ? "ring-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.4)]"
                              : "ring-slate-700/80 border border-slate-800"
                          }`}
                        />
                        {rankNum <= 3 && (
                          <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                            {rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : "🥉"}
                          </span>
                        )}
                      </div>

                      {/* Username & Badges */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/user/${encodeURIComponent(entry.username)}`}
                          className={`hover:underline font-semibold text-sm truncate ${
                            isCurrentUser
                              ? "text-blue-400 hover:text-blue-300"
                              : "text-slate-100 hover:text-blue-400"
                          }`}
                          title={entry.username}
                        >
                          {entry.username}
                        </Link>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Score Column */}
                  <TableCell className="text-right sm:text-center py-3 pr-4">
                    <span className="font-bold text-sm text-cyan-400 font-mono tracking-tight">
                      {entry.score.toLocaleString()}
                      <span className="text-[11px] text-slate-400 font-normal ml-1">pts</span>
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
