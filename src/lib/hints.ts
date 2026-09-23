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
      let parsed = JSON.parse(raw);
      // Unwrap recursively if double/triple stringified
      while (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          break;
        }
      }

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

        // Jika string ini sebenarnya adalah JSON array/object yang belum ter-parse
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            let nested = JSON.parse(trimmed);
            while (typeof nested === 'string') {
              try {
                nested = JSON.parse(nested);
              } catch {
                break;
              }
            }

            if (Array.isArray(nested) && nested.length > 0) {
              const target = nested[idx] || nested[0];
              if (typeof target === 'object' && target !== null) {
                const content = String(target.content || target.text || target.hint || '').trim();
                const rawCost = (target as any).cost;
                const parsedCost = Number(rawCost);
                const hasCost = rawCost !== undefined && !isNaN(parsedCost);
                if (!content && !hasCost) return null;
                return {
                  content,
                  cost: isNaN(parsedCost) || parsedCost < 0 ? 0 : Math.round(parsedCost),
                };
              }
              if (typeof target === 'string' && target.trim()) {
                return {
                  content: target.trim(),
                  cost: Math.round(baseCost * (1 + idx * 0.5)),
                };
              }
            } else if (typeof nested === 'object' && nested !== null) {
              const content = String(nested.content || nested.text || nested.hint || '').trim();
              const rawCost = (nested as any).cost;
              const parsedCost = Number(rawCost);
              const hasCost = rawCost !== undefined && !isNaN(parsedCost);
              if (content || hasCost) {
                return {
                  content,
                  cost: isNaN(parsedCost) || parsedCost < 0 ? 0 : Math.round(parsedCost),
                };
              }
            }
          } catch {}
        }

        return {
          content: trimmed,
          cost: Math.round(baseCost * (1 + idx * 0.5)),
        };
      }

      if (typeof item === 'object' && item !== null) {
        let content = String(item.content || item.text || item.hint || '').trim();
        const rawCost = (item as any).cost;
        const parsedCost = Number(rawCost);
        const hasCost = rawCost !== undefined && !isNaN(parsedCost);

        // Jika content kosong dan sama sekali tidak ada properti cost, barulah invalid
        if (!content && !hasCost) return null;

        // Cek jika field content sendiri berisi JSON string
        if (content && ((content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']')))) {
          try {
            const inner = JSON.parse(content);
            if (typeof inner === 'object' && inner !== null && !Array.isArray(inner) && (inner.content || inner.text)) {
              content = String(inner.content || inner.text || '').trim();
            }
          } catch {}
        }

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
