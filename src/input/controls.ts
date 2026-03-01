import type { Direction, GameState } from "../core/types";

interface ControlConfig {
  canvas: HTMLCanvasElement;
  state: GameState;
  swipeThreshold: number;
  onDirection: (dir: Direction) => void;
  onTogglePause: () => void;
}

const KEY_TO_DIR: Partial<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export function attachControls({ canvas, state, swipeThreshold, onDirection, onTogglePause }: ControlConfig): void {
  function applySwipeAt(x: number, y: number): boolean {
    const dx = x - state.touch.x;
    const dy = y - state.touch.y;
    if (Math.abs(dx) < swipeThreshold && Math.abs(dy) < swipeThreshold) return false;
    if (Math.abs(dx) > Math.abs(dy)) onDirection(dx > 0 ? "right" : "left");
    else onDirection(dy > 0 ? "down" : "up");
    state.touch.x = x;
    state.touch.y = y;
    return true;
  }

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    const dir = KEY_TO_DIR[e.key];
    if (dir) onDirection(dir);
    if (e.key.toLowerCase() === "p") onTogglePause();
  });

  canvas.addEventListener("pointerdown", (e: PointerEvent) => {
    state.touch.active = true;
    state.touch.x = e.clientX;
    state.touch.y = e.clientY;
  });

  canvas.addEventListener("pointermove", (e: PointerEvent) => {
    if (!state.touch.active) return;
    applySwipeAt(e.clientX, e.clientY);
  });

  canvas.addEventListener("pointerup", (e: PointerEvent) => {
    if (!state.touch.active) return;
    applySwipeAt(e.clientX, e.clientY);
    state.touch.active = false;
  });
}
