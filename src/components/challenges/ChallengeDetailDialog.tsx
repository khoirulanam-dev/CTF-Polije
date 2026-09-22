import React, { useState } from 'react';
import CustomBadge from '@/components/ui/CustomBadge';
import DifficultyBadge from '@/components/custom/DifficultyBadge';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import SolversList, { Solver } from './SolversList';
import HintDialog from './HintDialog';
import { Attachment, ChallengeWithSolve } from '@/types';
import { normalizeExternalHttpsUrl } from '@/lib/safe-url';
import { getUnlockedHints } from '@/lib/challenges';
import { useAuth } from '@/contexts/AuthContext';

interface ChallengeDetailDialogProps {
  open: boolean;
  challenge: ChallengeWithSolve | null;
  solvers: Solver[];
  challengeTab: 'challenge' | 'solvers';
  setChallengeTab: (tab: 'challenge' | 'solvers', challengeId?: string) => void;
  onClose: () => void;
  flagInputs: { [key: string]: string };
  handleFlagInputChange: (challengeId: string, value: string) => void;
  handleFlagSubmit: (challengeId: string) => void;
  submitting: { [key: string]: boolean };
  flagFeedback: { [key: string]: { success: boolean, message: string } | null };
  downloading: { [key: string]: boolean };
  downloadFile: (attachment: Attachment, attachmentKey: string) => void;
  showHintModal: { challenge: ChallengeWithSolve | null, hintIdx?: number };
  setShowHintModal: (modal: { challenge: ChallengeWithSolve | null, hintIdx?: number }) => void;
}

const ChallengeDetailDialog: React.FC<ChallengeDetailDialogProps> = ({
  open,
  challenge,
  solvers,
  challengeTab,
  setChallengeTab,
  onClose,
  flagInputs,
  handleFlagInputChange,
  handleFlagSubmit,
  submitting,
  flagFeedback,
  downloading,
  downloadFile,
  showHintModal,
  setShowHintModal,
}) => {
  const [copiedAll, setCopiedAll] = useState<{ [key: string]: boolean }>({});
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);
  const { user } = useAuth();
  const isContributorRole = user?.role === 'contributor' && !user?.is_admin;

  const getAuthor = () => {
    if (challenge?.author) return challenge.author;
    const match = challenge?.description?.match(/Author:\s*([^\n\r]+)/i);
    if (match) return match[1].trim();
    return 'Mas Anam';
  };
  const authorName = getAuthor();
  const cleanDescription = challenge?.description
    ? challenge.description.replace(/^Author:\s*[^\n\r]+[\r\n]*/i, '').trim()
    : '';

  React.useEffect(() => {
    if (open && challenge?.id) {
      getUnlockedHints(challenge.id).then(setUnlockedHints);
    }
  }, [open, challenge?.id]);

  if (!challenge) return null;

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="w-full max-w-lg rounded-md bg-[#232344] dark:bg-gray-900 border border-[#35355e] dark:border-gray-700 p-8 font-mono max-h-[90vh] overflow-y-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scroll-hidden [&_button.absolute.right-4.top-4]:block md:[&_button.absolute.right-4.top-4]:hidden [&_button.absolute.right-4.top-4]:text-white"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 8px 32px #0008', border: '1.5px solid #35355e' }}
      >
        {/* Header: title + close (DialogTitle for accessibility) */}
        <DialogTitle asChild>
          <h2
            className={`text-xl font-bold tracking-wide ${challenge.is_solved ? 'text-green-400 dark:text-green-300' : 'text-pink-400 dark:text-pink-300'}`}
            style={{ fontSize: '1.25rem' }}
          >
            {challenge.title}
          </h2>
        </DialogTitle>

        {/* Tabs */}
         <div className="flex justify-between gap-2">
          <button
            className={`flex-1 px-2 py-1 rounded-t-md font-bold text-sm transition-colors ${challengeTab === 'challenge' ? 'bg-[#35355e] dark:bg-gray-800 text-pink-300 dark:text-pink-200' : 'bg-[#232344] dark:bg-gray-900 text-gray-300 dark:text-gray-400 hover:text-pink-200'}`}
            onClick={() => setChallengeTab('challenge', challenge.id)}
          >
            Challenge
          </button>
          <button
            className={`flex-1 px-2 py-1 rounded-t-md font-bold text-sm transition-colors ${challengeTab === 'solvers' ? 'bg-[#35355e] dark:bg-gray-800 text-pink-300 dark:text-pink-200' : 'bg-[#232344] dark:bg-gray-900 text-gray-300 dark:text-gray-400 hover:text-pink-200'}`}
            onClick={() => setChallengeTab('solvers', challenge.id)}
          >
            {solvers.length ? `${solvers.length} ${solvers.length === 1 ? 'solve' : 'solves'}` : "0 solves"}
          </button>
        </div>

        {/* Content: Challenge detail */}
        {challengeTab === 'challenge' && (
          <>
            {/* Description for accessibility (DialogDescription) */}
            <DialogDescription asChild>
              <div className="sr-only">{cleanDescription || challenge.description}</div>
            </DialogDescription>
            {/* Badge bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CustomBadge label={challenge.category} color="bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" />
                {/* Difficulty badge */}
                <span>
                  <React.Suspense fallback={<span className="inline-block min-w-[64px] text-center text-xs font-semibold">{challenge.difficulty}</span>}>
                    <DifficultyBadge className="min-w-[62px]" difficulty={challenge.difficulty} />
                  </React.Suspense>
                </span>
              </div>
              <span className={`flex items-center gap-1 text-base font-bold ${challenge.is_solved ? 'text-green-300 dark:text-white' : 'text-yellow-300 dark:text-white'}`}>
                🪙 {challenge.points}
              </span>
            </div>

            {/* Author bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181829] dark:bg-gray-800 border border-[#35355e] dark:border-gray-700 text-xs">
              <span className="text-pink-400 dark:text-pink-300 font-bold">Author:</span>
              <span className="text-slate-200 dark:text-slate-200">@{authorName}</span>
            </div>

            {/* Description */}
            <div className="max-w-full overflow-x-auto break-words">
              <MarkdownRenderer content={cleanDescription} className="max-w-full break-words" />
            </div>

            {/* Attachments */}
            {challenge.attachments && challenge.attachments.length > 0 && (
              <div className="mb-1 space-y-3">
                {/* File Attachments */}
                {challenge.attachments.some(att => att.type === 'file') && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">📂 Files</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Copy wget commands for all files (compact icon/text) */}
                      <button
                      key="copy-wget-all"
                      type="button"
                      title="Copy wget commands for all files"
                      className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded-md shadow transition"
                      onClick={e => {
                        e.stopPropagation();
                        const fileAttachments = challenge.attachments!.filter(att => att.type === 'file' && (att.url || att.name));
                        if (!fileAttachments.length) return;
                        const commands = fileAttachments.map((att, idx) => {
                          const url = att.url || '';
                          const filename = (att.name && att.name.trim()) || url.split('/').pop() || `file-${idx}`;
                          const escUrl = url.replace(/'/g, "'\\'\'");
                          const escName = filename.replace(/'/g, "'\\'\'");
                          return `wget '${escUrl}' -O '${escName}'`;
                        });
                        const joined = commands.join(' && ');
                        if (!navigator.clipboard) {
                          toast.error('Clipboard not available')
                          return
                        }
                        navigator.clipboard.writeText(joined).then(() => {
                          const key = `${challenge.id}-copied`;
                          setCopiedAll(prev => ({ ...prev, [key]: true }));
                          setTimeout(() => setCopiedAll(prev => ({ ...prev, [key]: false })), 2000);
                          toast.success('Copied wget commands to clipboard')
                        }).catch((err) => {
                          console.error('Copy failed', err)
                          toast.error('Failed to copy to clipboard')
                        });
                      }}
                    >
                      <span className="text-xs font-mono">
                        {copiedAll[`${challenge.id}-copied`] ? 'Copied!' : 'copy wget'}
                      </span>
                    </button>

                    {/* 🧱 Pembatas visual */}
                    <span className="text-gray-500">|</span>

                      {challenge.attachments.filter(att => att.type === 'file').map((attachment, idx) => {
                        const displayName = attachment.name?.length > 40 ? attachment.name.slice(0, 37) + "..." : attachment.name || 'file';
                        const key = `${challenge.id}-${idx}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            title={attachment.name}
                            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-md shadow"
                            onClick={e => {
                              e.stopPropagation();
                              downloadFile(attachment, key);
                            }}
                            disabled={downloading[key]}
                          >
                            {downloading[key] ? "Downloading..." : displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* URL Attachments */}
                {challenge.attachments.some(att => att.type !== 'file') && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">🔗 Links</p>
                    <div className="flex flex-wrap gap-2">
                      {challenge.attachments.filter(att => att.type !== 'file' && normalizeExternalHttpsUrl(att.url)).map((attachment, idx) => {
                        const displayName = attachment.name?.length > 40 ? attachment.name.slice(0, 37) + "..." : attachment.name || (attachment.url ? attachment.url.slice(0, 40) + "..." : 'link');
                        const safeUrl = normalizeExternalHttpsUrl(attachment.url);
                        return (
                          <a
                            key={idx}
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={safeUrl}
                            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-md shadow"
                          >
                            {displayName}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hint buttons */}
            {Array.isArray(challenge.hint) && challenge.hint.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-2">
                {(challenge.hint ?? []).map((hint: string, idx: number) => {
                  const isUnlocked = unlockedHints.includes(idx);
                  const baseCost = Math.max(10, Math.min(50, Math.round((challenge.points || 100) * 0.1)));
                  const cost = Math.round(baseCost * (1 + idx * 0.5));
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`px-3 py-1.5 rounded font-semibold text-xs transition flex items-center gap-1.5 shadow-sm border ${
                        isUnlocked
                          ? "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30"
                          : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30"
                      }`}
                      onClick={e => {
                        e.stopPropagation();
                        setShowHintModal({ challenge, hintIdx: idx });
                      }}
                    >
                      <span>{isUnlocked ? "✓" : "🔒"} Hint {(challenge.hint?.length ?? 0) > 1 ? `#${idx + 1}` : ''}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isUnlocked ? "bg-green-400/20 text-green-200" : "bg-yellow-400/20 text-yellow-200"}`}>
                        {isUnlocked ? "Terbuka" : `-${cost} pts`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Flag input / Contributor restriction */}
            {isContributorRole ? (
              <div className="p-3.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2.5">
                <span className="text-base">🔒</span>
                <span>Role Kontributor: Akun kontributor hanya untuk membuat soal dan tidak dapat melakukan submit flag.</span>
              </div>
            ) : (
              <form
                className="space-y-1.5"
                onSubmit={e => {
                  e.preventDefault();
                  const val = (flagInputs[challenge.id] || '').trim();
                  if (!/^POLIJE\{[ -~]+\}$/.test(val)) {
                    toast.error('Format flag tidak valid! Format wajib: POLIJE{.......}');
                    return;
                  }
                  handleFlagSubmit(challenge.id);
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={flagInputs[challenge.id] || ''}
                    onChange={e => handleFlagInputChange(challenge.id, e.target.value)}
                    placeholder="POLIJE{.......}"
                    className="flex-1 px-3 py-2 rounded border border-[#35355e] dark:border-gray-700 bg-[#181829] dark:bg-gray-800 text-white font-mono text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={submitting[challenge.id] || !flagInputs[challenge.id]?.trim()}
                    className="px-5 py-2 rounded bg-gradient-to-br from-pink-500 to-pink-400 text-white font-bold shadow hover:from-pink-400 hover:to-pink-500 transition disabled:opacity-50"
                  >
                    {submitting[challenge.id] ? '...' : 'Submit'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  Format Flag: <span className="text-pink-400 font-semibold">POLIJE&#123;.......&#125;</span>
                </p>
              </form>
            )}

            {/* Feedback box */}
            {flagFeedback[challenge.id] && (
              <div
                className={`mt-2 p-2 rounded text-sm font-semibold
                  ${flagFeedback[challenge.id]?.success
                    ? 'bg-green-600 text-white dark:bg-green-700 dark:text-white'
                    : 'bg-red-600 text-white dark:bg-red-700 dark:text-white'}
                `}
              >
                {flagFeedback[challenge.id]?.message}
              </div>
            )}
          </>
        )}

        {/* Content: Solvers */}
        {challengeTab === 'solvers' && (
          <SolversList solvers={solvers} />
        )}
      </DialogContent>
      {/* Hint Dialog Modular */}
      <HintDialog
        challenge={showHintModal.challenge}
        hintIdx={showHintModal.hintIdx}
        open={!!showHintModal.challenge}
        onClose={() => setShowHintModal({ challenge: null })}
        onHintUnlocked={(unlockedIdx) => {
          setUnlockedHints(prev => Array.from(new Set([...prev, unlockedIdx])));
        }}
      />
    </Dialog>
  );
};

export default ChallengeDetailDialog;
