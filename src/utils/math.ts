import { GRID } from "../core/constants";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function lerpWrap(a: number, b: number, t: number): number {
  let d = b - a;
  if (Math.abs(d) > GRID / 2) d += d > 0 ? -GRID : GRID;
  let v = a + d * t;
  if (v < 0) v += GRID;
  if (v >= GRID) v -= GRID;
  return v;
}
