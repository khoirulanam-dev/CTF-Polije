export interface ChallengeHintItem {
  content: string;
  cost: number; // 0 = Free/Gratis, > 0 = Berbayar
}

/**
 * Normalisasi struktur hint dari database (mendukung format lama string[] dan format baru ChallengeHintItem[])
 */
export function parseChallengeHints(raw: any, challengePoints: number = 100): ChallengeHintItem[] {
  if (!raw) return [];
  let arr: any[] = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        arr = [parsed];
      } else if (typeof parsed === 'string' && parsed.trim()) {
        arr = [parsed];
      }
    } catch {
      if (raw.trim()) arr = [raw];
    }
  }

  const baseCost = Math.max(10, Math.min(50, Math.round((challengePoints || 100) * 0.1)));

  return arr
    .map((item, idx): ChallengeHintItem | null => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) return null;
        return {
          content: trimmed,
          cost: Math.round(baseCost * (1 + idx * 0.5)),
        };
      }

      if (typeof item === 'object' && item !== null) {
        const content = String(item.content || item.text || item.hint || '').trim();
        if (!content) return null;
        const parsedCost = Number(item.cost);
        const cost = isNaN(parsedCost) || parsedCost < 0 ? 0 : Math.round(parsedCost);
        return {
          content,
          cost,
        };
      }

      return null;
    })
    .filter((h): h is ChallengeHintItem => h !== null);
}

/**
 * Validasi batas poin hint
 * - Admin: bebas (cost >= 0)
 * - Contributor: jika berbayar, min 1 max 50 poin
 */
export function validateHintCost(cost: number, isAdmin: boolean): { valid: boolean; error?: string } {
  if (cost === 0) return { valid: true };

  if (cost < 0) {
    return { valid: false, error: 'Poin hint tidak boleh bernilai negatif.' };
  }

  if (!isAdmin && (cost < 1 || cost > 50)) {
    return {
      valid: false,
      error: 'Untuk kontributor, biaya hint berbayar harus antara 1 sampai 50 poin.',
    };
  }

  return { valid: true };
}
