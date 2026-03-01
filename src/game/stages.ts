import { ALPHABET, WORDS } from "../core/constants";
import type { AbcStage, Stage, WordStage } from "../core/types";
import { clamp, pick } from "../utils/math";

export function buildABCStage(stageIndex: number): AbcStage {
  const advanced = stageIndex > 3;
  const hard = stageIndex > 7;
  const rules: AbcStage["rule"][] = [
    { label: "ABC", backward: false, onlyCase: "upper", skip: false, oneBack: false },
    { label: "abc", backward: false, onlyCase: "lower", skip: false, oneBack: false },
  ];
  if (advanced) rules.push({ label: "ZYX", backward: true, onlyCase: Math.random() < 0.5 ? "upper" : "lower", skip: false, oneBack: false });
  if (hard) rules.push({ label: "ACE", backward: false, onlyCase: Math.random() < 0.5 ? "upper" : "lower", skip: true, oneBack: true });

  const rule = pick(rules);
  let seq = ALPHABET.slice();
  if (rule.backward) seq = seq.reverse();
  if (rule.skip) seq = seq.filter((_, i) => i % 2 === 0);

  return { mode: "abc", rule, sequence: seq, progress: 0, targetCount: clamp(6 + Math.floor(stageIndex / 2), 6, 16), usedStepBack: false };
}

export function buildWordStage(stageIndex: number): WordStage {
  const easy = WORDS.filter((w) => w.length <= 4);
  const mid = WORDS.filter((w) => w.length >= 5 && w.length <= 6);
  const hard = WORDS.filter((w) => w.length >= 7);
  const pool = stageIndex < 4 ? easy : stageIndex < 8 ? easy.concat(mid) : mid.concat(hard);
  const raw = pick(pool.length ? pool : WORDS);
  const showLower = Math.random() < 0.5;
  return {
    mode: "word",
    rule: { label: "WORD" },
    shownWord: showLower ? raw.toLowerCase() : raw.toUpperCase(),
    canonicalWord: raw.toUpperCase(),
    boardCase: showLower ? "upper" : "lower",
    targetCount: raw.length,
    progress: 0,
  };
}

export function currentTarget(stage: Stage): string {
  return stage.mode === "word" ? stage.canonicalWord[stage.progress] : stage.sequence[stage.progress];
}

export function expectedKey(stage: Stage | null): string {
  if (!stage) return "";
  return `${stage.mode}:${stage.progress}:${currentTarget(stage)}`;
}

export function formatCase(char: string, style: "upper" | "lower"): string {
  return style === "lower" ? char.toLowerCase() : char.toUpperCase();
}
