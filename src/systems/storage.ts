import type { GameState } from "../core/types";

export function saveStorage(storageKey: string, state: GameState): void {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      totalScore: state.totalScore,
      bestScore: state.bestScore,
      kidName: state.kidName,
    })
  );
}

export function loadStorage(storageKey: string, state: GameState): void {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { totalScore?: number; bestScore?: number; kidName?: string };
    state.totalScore = Number(parsed.totalScore || 0);
    state.bestScore = Number(parsed.bestScore || 0);
    state.kidName = String(parsed.kidName || "");
  } catch (_e) {
    // Ignore corrupted storage.
  }
}
