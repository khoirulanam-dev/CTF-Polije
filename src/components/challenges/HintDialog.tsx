import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChallengeWithSolve } from "@/types";
import { getUnlockedHintsData, unlockHint } from "@/lib/challenges";
import { useAuth } from "@/contexts/AuthContext";
import { getUserDetail } from "@/lib/users";
import { parseChallengeHints, ChallengeHintItem } from "@/lib/hints";
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface HintDialogProps {
  challenge: ChallengeWithSolve | null;
  hintIdx?: number;
  open: boolean;
  onClose: () => void;
  onHintUnlocked?: (hintIdx: number) => void;
}

const HintDialog: React.FC<HintDialogProps> = ({
  challenge,
  hintIdx = 0,
  open,
  onClose,
  onHintUnlocked,
}) => {
  const { user } = useAuth();
  const [unlockedList, setUnlockedList] = useState<number[]>([]);
  const [unlockedContents, setUnlockedContents] = useState<Record<number, string>>({});
  const [userScore, setUserScore] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);

  const hints: ChallengeHintItem[] = parseChallengeHints(challenge?.hint, challenge?.points);
  const currentHint: ChallengeHintItem | undefined = hints[hintIdx];
  const hintCost = currentHint?.cost ?? 0;
  const isFree = hintCost === 0;

  useEffect(() => {
    if (!open || !challenge) return;
    setLoading(true);

    Promise.all([
      getUnlockedHintsData(challenge.id),
      user?.id ? getUserDetail(user.id) : Promise.resolve(null),
    ])
      .then(([hintsData, detail]) => {
        setUnlockedList(hintsData.map(h => h.hint_idx));
        const contentsMap: Record<number, string> = {};
        hintsData.forEach(h => {
          if (h.content) contentsMap[h.hint_idx] = h.content;
        });
        setUnlockedContents(prev => ({ ...prev, ...contentsMap }));
        if (detail) {
          setUserScore(detail.score ?? 0);
        }
      })
      .catch((err) => {
        console.error("Error loading hint / user data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, challenge, hintIdx, user?.id]);

  if (!challenge || !currentHint) return null;

  const isUnlocked = unlockedList.includes(hintIdx);
  const hasInsufficientPoints = !isFree && userScore !== null && userScore < hintCost;

  const handleUnlock = async () => {
    if (hasInsufficientPoints) {
      toast.error(`Poin Anda tidak mencukupi! Anda memiliki ${userScore} pts, dibutuhkan ${hintCost} pts.`);
      return;
    }

    setUnlocking(true);
    try {
      const res = await unlockHint(challenge.id, hintIdx, hintCost);
      if (res.success) {
        toast.success(
          res.message ||
            (isFree
              ? `Hint #${hintIdx + 1} berhasil dibuka!`
              : `Hint #${hintIdx + 1} berhasil dibuka (-${hintCost} pts)`)
        );
        setUnlockedList((prev) => Array.from(new Set([...prev, hintIdx])));
        if (res.content) {
          setUnlockedContents(prev => ({ ...prev, [hintIdx]: res.content! }));
        }
        if (!isFree && userScore !== null) {
          setUserScore(Math.max(0, userScore - hintCost));
        }
        onHintUnlocked?.(hintIdx);
      } else {
        toast.error(res.message || "Gagal membuka hint");
      }
    } catch {
      toast.error("Terjadi kesalahan saat membuka hint");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="bg-[#232344] dark:bg-gray-900 rounded-md shadow-2xl max-w-lg min-w-[320px] w-full border border-[#35355e] dark:border-gray-700 p-6 font-mono [&_button.absolute.right-4.top-4]:block md:[&_button.absolute.right-4.top-4]:hidden [&_button.absolute.right-4.top-4]:text-white"
        style={{ boxShadow: '0 8px 32px #0008', border: '1.5px solid #35355e' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-pink-300 dark:text-pink-200 text-lg">
            <span className="w-8 h-8 bg-blue-200 dark:bg-blue-900 rounded-full flex items-center justify-center">
              {isUnlocked ? "💡" : isFree ? "🎁" : "🔒"}
            </span>
            Hint {hints.length > 1 ? `#${hintIdx + 1}` : ""}: {challenge.title}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              Memeriksa status hint #{hintIdx + 1}...
            </div>
          ) : isUnlocked ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-green-400 bg-green-950/40 border border-green-800/60 px-3 py-1.5 rounded">
                <span>✓ Hint #{hintIdx + 1} Terbuka</span>
                <span className="text-gray-400">
                  {isFree ? "Gratis (0 pts)" : `Poin terpotong: -${hintCost} pts`}
                </span>
              </div>
              <div className="bg-[#35355e] dark:bg-gray-800 border border-[#35355e] dark:border-gray-700 rounded-lg p-4">
                {(() => {
                  const rawDisplayed = unlockedContents[hintIdx] || currentHint.content || '';
                  if (!rawDisplayed) return <p className="text-gray-400 italic text-sm">Tidak ada petunjuk tersedia.</p>;

                  const trimmed = rawDisplayed.trim();
                  let contentToShow = rawDisplayed;

                  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                    try {
                      let parsed = JSON.parse(trimmed);
                      while (typeof parsed === 'string') {
                        try {
                          parsed = JSON.parse(parsed);
                        } catch {
                          break;
                        }
                      }
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        const item = parsed[hintIdx] || parsed[0];
                        contentToShow = typeof item === 'object' && item !== null
                          ? String(item.content || item.text || item.hint || '')
                          : String(item);
                      } else if (typeof parsed === 'object' && parsed !== null) {
                        contentToShow = String(parsed.content || parsed.text || parsed.hint || trimmed);
                      }
                    } catch {}
                  }

                  return (
                    <div className="text-gray-200 dark:text-gray-100 leading-relaxed whitespace-pre-wrap text-sm">
                      {contentToShow}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-2">
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                isFree
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
              }`}>
                {isFree ? "🎁" : "🔒"}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Hint #{hintIdx + 1} {isFree ? "(Gratis)" : "Masih Terkunci"}
                </h4>
                {isFree ? (
                  <p className="text-xs text-emerald-300 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Petunjuk ini disediakan secara <strong className="text-white font-bold">GRATIS</strong> oleh pembuat soal. Membuka petunjuk ini tidak akan memotong skor Anda.
                  </p>
                ) : (
                  <p className="text-xs text-gray-300 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Petunjuk ini bertipe berbayar. Membuka{" "}
                    <span className="text-yellow-400 font-bold">Hint #{hintIdx + 1}</span> akan mengurangi skor Anda sebesar{" "}
                    <span className="text-yellow-400 font-bold">{hintCost} poin</span> pada leaderboard.
                  </p>
                )}
              </div>

              {/* Status Poin User */}
              <div className="flex items-center justify-between text-xs px-3 py-2 rounded bg-[#181829] border border-[#35355e] max-w-sm mx-auto">
                <span className="text-gray-300">Poin Anda Saat Ini:</span>
                <span className={`font-bold ${hasInsufficientPoints ? 'text-red-400' : 'text-cyan-400'}`}>
                  {userScore !== null ? `${userScore} pts` : 'Memuat...'}
                </span>
              </div>

              {hasInsufficientPoints && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs text-left max-w-sm mx-auto flex items-start gap-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <p className="font-semibold text-red-200">Poin Tidak Mencukupi!</p>
                    <p className="mt-0.5 text-gray-300 text-[11px] leading-relaxed">
                      Anda membutuhkan minimal <strong className="text-yellow-400">{hintCost} poin</strong> untuk membuka hint ini. Selesaikan tantangan lain terlebih dahulu untuk menambah poin.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={unlocking || hasInsufficientPoints}
                  className={`px-5 py-2 text-xs rounded font-bold shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    isFree
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950"
                      : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950"
                  }`}
                >
                  {unlocking
                    ? "Membuka..."
                    : hasInsufficientPoints
                    ? "Poin Tidak Cukup"
                    : isFree
                    ? `Buka Hint Gratis (0 pts)`
                    : `Buka Hint #${hintIdx + 1} (-${hintCost} Pts)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HintDialog;
