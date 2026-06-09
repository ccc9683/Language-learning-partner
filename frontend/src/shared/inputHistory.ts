const INPUT_HISTORY_LIMIT = 5;

export function loadInputHistory(key: string): string[] {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const history: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }

      const value = item.trim();
      if (value && !history.includes(value)) {
        history.push(value);
      }

      if (history.length >= INPUT_HISTORY_LIMIT) {
        break;
      }
    }

    return history;
  } catch {
    return [];
  }
}

export function saveInputHistory(key: string, items: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, INPUT_HISTORY_LIMIT)));
  } catch {
    // Ignore storage failures so the main workflow remains usable.
  }
}

export function addInputHistory(key: string, value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return loadInputHistory(key);
  }

  const nextHistory = [
    trimmed,
    ...loadInputHistory(key).filter((historyItem) => historyItem !== trimmed)
  ].slice(0, INPUT_HISTORY_LIMIT);
  saveInputHistory(key, nextHistory);
  return nextHistory;
}

export function removeInputHistory(key: string, value: string): string[] {
  const nextHistory = loadInputHistory(key).filter((historyItem) => historyItem !== value);
  saveInputHistory(key, nextHistory);
  return nextHistory;
}
