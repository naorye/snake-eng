import * as THREE from "three";
import {
  STORAGE_KEY,
  CELL,
  MIN_LEN,
  BASE_POINTS,
  PENALTY,
  SWIPE_THRESHOLD,
  COMBO_STEPS,
  ALPHABET,
  UI_FONT,
  COMPLIMENTS,
  TOOL_DEFS,
  DIR,
} from "../core/constants";
import { createInitialState } from "../core/state";
import { saveStorage, loadStorage } from "../systems/storage";
import { createSceneContext, updateOrthoCamera } from "../render/scene";
import { attachControls } from "../input/controls";
import { clamp, rand, randInt, pick } from "../utils/math";
import { buildABCStage, buildWordStage, currentTarget, expectedKey, formatCase } from "./stages";
import { makeSprite, disposeObject3D } from "../render/sprites";
import { createSnakeSkinTexture, makeLetterVisual, makeToolVisual, createSnakeMesh } from "../render/models";
import { createBoardController } from "./board";
import { createFxController } from "./fx";
import { createGameAudio } from "../audio/sound";

import type { GameState, Direction, Cell, ToolId } from "../core/types";

type Group = any;
type Sprite = any;

const state: GameState = createInitialState();
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const pauseOverlay = document.getElementById("pause-overlay") as HTMLDivElement | null;
const { renderer, scene, camera, ambient, keyLight, rimLight, groups } = createSceneContext(canvas);
const groupBoard = groups.board;
const groupSnake = groups.snake;
const groupLetters = groups.letters;
const groupTools = groups.tools;
const groupFx = groups.fx;
const groupHud = groups.hud;
const ORTHO_HEIGHT = 19.2;

let gridCols = 16;
let gridRows = 16;
let orthoHeightDynamic = ORTHO_HEIGHT;
let cameraCenterZ = 0;
let hudTopPadRatio = 0.065;
let hudY = 2.5;
let hudToolStep = 0.86;
let hudSideInsetRatio = 0.11;
let hudToolRightRatio = 0.18;
let gameReady = false;

function boardWidth() {
  return gridCols * CELL;
}

function boardHeight() {
  return gridRows * CELL;
}

function boardHalfW() {
  return boardWidth() / 2;
}

function boardHalfH() {
  return boardHeight() / 2;
}

const boardController = createBoardController({
  groupBoard,
  rand,
  clamp,
});
const { popupText, burstCorrect, burstMistake, updateFx } = createFxController({
  groupFx,
  toWorld,
  makeSprite,
  rand,
});
const audio = createGameAudio();

function cellKey(c: Cell) {
  return `${c.x},${c.y}`;
}

function normalizeLetter(c: string) {
  return String(c || "").toUpperCase();
}

function comboMul() {
  return COMBO_STEPS[Math.min(state.combo, COMBO_STEPS.length - 1)];
}

function hasTool(id: ToolId) {
  return state.activeTools.some((t) => t.id === id);
}

function toolRemaining(id: ToolId) {
  const t = state.activeTools.find((item) => item.id === id);
  return t ? t.remainingMs : 0;
}

function pickToolForStage() {
  const weighted: ToolId[] = [];

  const pushMany = (id: ToolId, count: number) => {
    for (let i = 0; i < count; i += 1) weighted.push(id);
  };

  pushMany("shoes", 4);
  pushMany("magnet", 4);
  pushMany("multiplier", 4);
  pushMany("shield", 3);
  pushMany("slow", 2);

  if (state.stageIndex >= 3) pushMany("wine", 1);
  if (state.stageIndex >= 7) pushMany("wine", 1);

  return pick(weighted);
}

function toWorld(cellX: number, cellY: number) {
  return new THREE.Vector3((cellX + 0.5) * CELL - boardHalfW(), 0, (cellY + 0.5) * CELL - boardHalfH());
}

function lerpWrapAxis(a: number, b: number, t: number, size: number) {
  let d = b - a;
  if (Math.abs(d) > size / 2) d += d > 0 ? -size : size;
  let v = a + d * t;
  if (v < 0) v += size;
  if (v >= size) v -= size;
  return v;
}

function computeResponsiveLayout(viewportWidth: number, viewportHeight: number, zoomScale: number) {
  const hudPxReserve = clamp(viewportHeight * 0.18, 96, 172);
  const usableBoardPxHeight = Math.max(180, viewportHeight - hudPxReserve);
  const targetCellPx = clamp(Math.min(viewportWidth / 17, usableBoardPxHeight / 14), 24, 62);
  const cols = clamp(Math.floor(viewportWidth / targetCellPx), 10, 44);
  const rows = clamp(Math.floor(usableBoardPxHeight / targetCellPx), 8, 34);

  const bw = cols * CELL;
  const bh = rows * CELL;
  const boardPadding = 1.0;
  const hudReserve = clamp(bh * 0.2, 3.2, 7.5);
  const orthoHeight = Math.max(bh + boardPadding * 2 + hudReserve, (bw + boardPadding * 2) / Math.max(0.55, viewportWidth / Math.max(1, viewportHeight))) * zoomScale;
  const zOffset = hudReserve * 0.52;

  const compact = viewportHeight < 760 || viewportWidth < 420;
  const topPadRatio = compact ? 0.078 : 0.062;
  const hudWorldY = compact ? 2.2 : 2.5;
  const toolStep = compact ? 0.72 : 0.86;
  const sideInsetRatio = compact ? 0.125 : 0.1;
  const toolRightRatio = compact ? 0.205 : 0.17;

  return { cols, rows, orthoHeight, zOffset, topPadRatio, hudWorldY, toolStep, sideInsetRatio, toolRightRatio };
}

function save() {
  saveStorage(STORAGE_KEY, state);
}

function load() {
  loadStorage(STORAGE_KEY, state);
}

function compliment(ctxType: keyof typeof COMPLIMENTS) {
  const pool = COMPLIMENTS[ctxType] || COMPLIMENTS.success;
  const recent = new Set(state.complimentHistory);
  const options = pool.filter((x) => !recent.has(x));
  let line = pick(options.length ? options : pool);
  if (state.kidName && Math.random() < 0.25) line = `${state.kidName}, ${line}`;
  state.complimentHistory.push(line);
  if (state.complimentHistory.length > 5) state.complimentHistory.shift();
  return line;
}

function stageSpeed() {
  let speed = clamp(5 + state.stageIndex * 0.15, 5, 10);
  if (hasTool("shoes")) speed *= 1.2;
  if (hasTool("slow")) speed *= 0.82;
  return clamp(speed, 3.5, 14);
}

function letterSize() {
  const min = window.innerWidth < 700 ? 72 : 86;
  const max = window.innerWidth < 700 ? 150 : 168;
  return clamp(max - 20 * Math.log(state.stageIndex + 1), min, max);
}

const snakeSkinTexture = createSnakeSkinTexture();

function makeObjectiveSprite() {
  const cv = document.createElement("canvas");
  const cx = cv.getContext("2d") as CanvasRenderingContext2D;
  const stage = state.stage;

  if (!stage) {
    cv.width = 2;
    cv.height = 2;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    return new THREE.Sprite(mat);
  }

  if (stage.mode === "word") {
    const chars = stage.shownWord.split("");
    const current = stage.progress;
    const size = window.innerWidth < 700 ? 122 : 148;
    const gap = size * 0.18;
    const font = `900 ${size}px "Arial Black", "Verdana", sans-serif`;

    cx.font = font;
    const widths = chars.map((c) => cx.measureText(c).width);
    const textWidth = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    cv.width = Math.ceil(textWidth + 120);
    cv.height = Math.ceil(size * 1.8);

    cx.font = font;
    cx.textAlign = "left";
    cx.textBaseline = "middle";

    let x = 60;
    const y = cv.height * 0.53;
    for (let i = 0; i < chars.length; i += 1) {
      const c = chars[i];
      const isCurrent = i === current;
      if (isCurrent) {
        const rw = widths[i] + 20;
        const rx = x - 10;
        const ry = y - size * 0.58;
        const rh = size * 1.08;
        cx.fillStyle = "rgba(255, 64, 220, 0.26)";
        cx.fillRect(rx, ry, rw, rh);
      }

      cx.shadowColor = isCurrent ? "rgba(255,78,243,0.95)" : "rgba(95,255,243,0.52)";
      cx.shadowBlur = isCurrent ? 32 : 12;
      cx.strokeStyle = "rgba(0,0,0,0.8)";
      cx.lineWidth = isCurrent ? 12 : 10;
      cx.strokeText(c, x, y);
      cx.fillStyle = isCurrent ? "#ff70ef" : "#b9fff8";
      cx.fillText(c, x, y);

      if (isCurrent) {
        cx.shadowBlur = 0;
        cx.fillStyle = "#ff4fe7";
        cx.fillRect(x - 8, y + size * 0.62, widths[i] + 14, 8);
      }

      x += widths[i] + gap;
    }
  } else {
    const label = stage.rule.label;
    const next = currentTarget(stage);
    const cased = stage.rule.onlyCase === "lower" ? next.toLowerCase() : next.toUpperCase();
    cv.width = window.innerWidth < 700 ? 840 : 1040;
    cv.height = window.innerWidth < 700 ? 290 : 360;

    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.font = `900 ${window.innerWidth < 700 ? 78 : 92}px "Arial Black", "Verdana", sans-serif`;
    cx.strokeStyle = "rgba(0,0,0,0.8)";
    cx.lineWidth = 10;
    cx.fillStyle = "#b9fff8";
    cx.strokeText(label, cv.width / 2, cv.height * 0.30);
    cx.fillText(label, cv.width / 2, cv.height * 0.30);

    cx.font = `900 ${window.innerWidth < 700 ? 148 : 188}px "Arial Black", "Verdana", sans-serif`;
    cx.shadowColor = "rgba(255,78,243,0.95)";
    cx.shadowBlur = 34;
    cx.strokeStyle = "rgba(0,0,0,0.88)";
    cx.lineWidth = 14;
    cx.fillStyle = "#ff70ef";
    cx.strokeText(cased, cv.width / 2, cv.height * 0.72);
    cx.fillText(cased, cv.width / 2, cv.height * 0.72);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  const worldW = (cv.width / 160) * 0.72;
  const worldH = (cv.height / 160) * 0.72;
  sprite.scale.set(worldW, worldH, 1);
  return sprite;
}

function snakeSet() {
  return new Set(state.snake.map(cellKey));
}

function freeCell(avoid = new Set<string>()) {
  const blocked = snakeSet();
  for (const k of avoid) blocked.add(k);
  for (let i = 0; i < 140; i += 1) {
    const c = { x: randInt(0, gridCols - 1), y: randInt(0, gridRows - 1) };
    if (!blocked.has(cellKey(c))) return c;
  }
  return null;
}

function spawnLetter(char: string, role: "target" | "distractor", ttlMs: number) {
  const stage = state.stage;
  if (!stage) return;
  const occupied = new Set(state.letters.map((l) => `${l.x},${l.y}`));
  state.boardTools.forEach((t) => occupied.add(`${t.x},${t.y}`));
  occupied.add(cellKey(state.snake[0]));
  const pos = freeCell(occupied);
  if (!pos) return;

  const pref = stage.mode === "word" ? stage.boardCase : stage.rule.onlyCase;
  const finalChar = formatCase(char, pref);
  const visual = makeLetterVisual(finalChar);
  const world = toWorld(pos.x, pos.y);
  visual.group.position.copy?.(world);
  visual.group.position.y = 0.72;
  groupLetters.add(visual.group);

  state.letters.push({
    ...pos,
    char: finalChar,
    role,
    ttlMs,
    spawnTime: state.clock,
    pulse: rand(0, Math.PI * 2),
    visual,
  });
}

function spawnTool(toolId: keyof typeof TOOL_DEFS) {
  const occupied = new Set(state.letters.map((l) => `${l.x},${l.y}`));
  state.boardTools.forEach((t) => occupied.add(`${t.x},${t.y}`));
  occupied.add(cellKey(state.snake[0]));
  const pos = freeCell(occupied);
  if (!pos) return;

  const visual = makeToolVisual(toolId, TOOL_DEFS[toolId].color);
  const world = toWorld(pos.x, pos.y);
  visual.group.position.copy?.(world);
  visual.group.position.y = 0.78;
  groupTools.add(visual.group);

  state.boardTools.push({
    ...pos,
    id: toolId,
    ttlMs: 11000,
    spawnTime: state.clock,
    pulse: rand(0, Math.PI * 2),
    visual,
  });
}

function desiredDistractors() {
  return clamp(3 + Math.floor(state.stageIndex / 2), 3, 12);
}

function ensureSpawns() {
  if (!state.stage || state.stageDone) return;
  const target = currentTarget(state.stage);
  const hasTarget = state.letters.some((l) => normalizeLetter(l.char) === target);
  if (!hasTarget) spawnLetter(target, "target", 7000 + randInt(0, 2200));

  let count = state.letters.filter((l) => l.role === "distractor").length;
  const need = desiredDistractors();
  while (count < need) {
    const c = pick(ALPHABET.filter((x) => x !== target));
    spawnLetter(c, "distractor", 3200 + randInt(0, 2200));
    count += 1;
  }
}

function activateTool(toolId: keyof typeof TOOL_DEFS) {
  const def = TOOL_DEFS[toolId];
  const existing = state.activeTools.find((t) => t.id === toolId);
  if (existing) {
    existing.remainingMs = Math.min(existing.remainingMs + def.durationMs * 0.65, def.durationMs * 1.9);
  } else {
    if (state.activeTools.length >= 2) {
      state.activeTools.sort((a, b) => a.remainingMs - b.remainingMs);
      state.activeTools.shift();
    }
    state.activeTools.push({ id: toolId, remainingMs: def.durationMs });
  }

  const head = state.snake[0];
  popupText(`${def.icon} ${def.name}`, head.x, head.y - 0.6, "#ff80f2", 850);
  void audio.onToolPickup();
  state.hudRefreshAtMs = 0;
}

function applyMagnetPull() {
  const head = state.snake[0];
  const blocked = snakeSet();
  for (const letter of state.letters) {
    const dist = Math.abs(letter.x - head.x) + Math.abs(letter.y - head.y);
    if (dist > 4) continue;

    const stepX = head.x === letter.x ? 0 : head.x > letter.x ? 1 : -1;
    const stepY = head.y === letter.y ? 0 : head.y > letter.y ? 1 : -1;
    const next = {
      x: (letter.x + (Math.abs(head.x - letter.x) >= Math.abs(head.y - letter.y) ? stepX : 0) + gridCols) % gridCols,
      y: (letter.y + (Math.abs(head.x - letter.x) < Math.abs(head.y - letter.y) ? stepY : 0) + gridRows) % gridRows,
    };

    const taken = blocked.has(cellKey(next)) || state.letters.some((l) => l !== letter && l.x === next.x && l.y === next.y) || state.boardTools.some((t) => t.x === next.x && t.y === next.y);
    if (taken) continue;

    letter.x = next.x;
    letter.y = next.y;
    const wp = toWorld(letter.x, letter.y);
    letter.visual.group.position.x = wp.x;
    letter.visual.group.position.z = wp.z;
  }
}

const snakeMeshes: Group[] = [];
let digestPulses: number[] = [];

function syncSnakeMeshes() {
  while (snakeMeshes.length < state.snake.length) {
    const m = createSnakeMesh(snakeMeshes.length === 0, snakeSkinTexture);
    snakeMeshes.push(m);
    groupSnake.add(m);
  }
  while (snakeMeshes.length > state.snake.length) {
    const m = snakeMeshes.pop();
    groupSnake.remove(m);
    disposeObject3D(m);
  }
}

let hudScore: Sprite | null = null;
let hudObjective: Sprite | null = null;
let hudToolSprites: Sprite[] = [];

function clearHudTools() {
  for (const s of hudToolSprites) {
    groupHud.remove(s);
    s.material.map?.dispose();
    s.material.dispose();
  }
  hudToolSprites = [];
}

function updateHud() {
  if (hudScore) {
    groupHud.remove(hudScore);
    hudScore.material.map?.dispose();
    hudScore.material.dispose();
  }
  if (hudObjective) {
    groupHud.remove(hudObjective);
    hudObjective.material.map?.dispose();
    hudObjective.material.dispose();
  }
  clearHudTools();

  hudScore = makeSprite(`${state.score}`, {
    font: `900 122px "Arial Black", "Verdana", sans-serif`,
    fg: "#b9fff8",
    stroke: "rgba(0,0,0,0.92)",
    strokeW: 14,
    glow: "rgba(255,64,220,0.78)",
    shadowBlur: 20,
    scale: 1.12,
  });

  hudObjective = makeObjectiveSprite();
  groupHud.add(hudScore, hudObjective);

  for (const active of state.activeTools) {
    const def = TOOL_DEFS[active.id];
    const sec = Math.max(1, Math.ceil(active.remainingMs / 1000));
    const sprite = makeSprite(`${def.icon} ${def.name} ${sec}s`, {
      font: UI_FONT,
      fg: "#c0fffa",
      stroke: "rgba(0,0,0,0.88)",
      strokeW: 10,
      glow: "rgba(255,85,230,0.65)",
      shadowBlur: 8,
      scale: 0.48,
    });
    hudToolSprites.push(sprite);
    groupHud.add(sprite);
  }
}

function placeHud() {
  if (!hudScore || !hudObjective) return;
  const width = camera.right - camera.left;
  const height = camera.top - camera.bottom;
  const topZ = camera.bottom + height * hudTopPadRatio;

  hudScore.position.set(camera.left + width * hudSideInsetRatio, hudY, topZ);
  hudObjective.position.set(0, hudY, topZ);

  let offset = 0;
  for (const sprite of hudToolSprites) {
    sprite.position.set(camera.right - width * hudToolRightRatio, hudY, topZ + 0.92 + offset);
    offset += hudToolStep;
  }
}

function clearLetters() {
  for (const l of state.letters) {
    groupLetters.remove(l.visual.group);
    l.visual.txt.material.map?.dispose();
    l.visual.txt.material.dispose();
    l.visual.halo.material.dispose();
    l.visual.halo.geometry.dispose();
    l.visual.plate.material.dispose();
    l.visual.plate.geometry.dispose();
  }
  state.letters = [];
}

function clearBoardTools() {
  for (const t of state.boardTools) {
    groupTools.remove(t.visual.group);
    disposeObject3D(t.visual.group);
  }
  state.boardTools = [];
}

function nextStage() {
  state.stageDone = false;
  state.stageTransitionMs = 0;
  state.stageMistakes = 0;
  state.stageStartMs = performance.now();
  state.combo = 0;
  digestPulses = [];

  clearLetters();
  clearBoardTools();

  state.stage = Math.random() < (state.stageIndex % 2 === 0 ? 0.65 : 0.35) ? buildWordStage(state.stageIndex) : buildABCStage(state.stageIndex);
  ensureSpawns();
  updateHud();

  const head = state.snake[0];
  popupText(`שלב ${state.stageIndex}`, head.x, head.y - 1, "#9cff2e", 900);
  void audio.onStageStart(state.stageIndex);
}

function allowOneStepBack(char: string) {
  const stage = state.stage;
  if (!stage || stage.mode !== "abc" || !stage.rule.oneBack || stage.usedStepBack) return false;
  const prev = stage.sequence[stage.progress - 1];
  if (!prev) return false;
  if (normalizeLetter(char) !== prev) return false;
  stage.usedStepBack = true;
  return true;
}

function applyMistake(reason: "self" | "wrong") {
  state.stageMistakes += 1;
  state.combo = 0;
  state.lastMistake = true;
  state.targetFailures += 1;
  if (state.targetFailures >= 3) state.targetHintActive = true;
  state.score = Math.max(0, state.score - PENALTY);
  state.snake.length = Math.max(MIN_LEN, state.snake.length - (state.stageIndex < 4 ? 1 : 2));

  const head = state.snake[0];
  popupText(reason === "self" ? "אופס" : "נסה/י שוב", head.x, head.y, "#ff7a00", 760);
  burstMistake(head.x, head.y);
  void audio.onMistake(reason);
  updateHud();
}

function finishStage() {
  const stage = state.stage;
  if (!stage) return;
  state.stageDone = true;
  state.stageTransitionMs = 860;

  const elapsedSec = (performance.now() - state.stageStartMs) / 1000;
  const diff = Math.floor(state.stageIndex / 2);
  const timeBonus = Math.max(0, Math.round(18 - elapsedSec));
  const bonus = Math.max(30, 50 + diff * 10 + timeBonus - state.stageMistakes * 5);
  state.score += bonus;
  state.totalScore += bonus;
  state.bestScore = Math.max(state.bestScore, state.score);
  save();

  const head = state.snake[0];
  const cType = stage.mode === "abc" && (stage.rule.backward || stage.rule.skip) ? "rule" : "success";
  popupText(compliment(cType), head.x, head.y - 0.7, "#ff70ef", 1450);
  popupText(`+${bonus}`, head.x, head.y, "#9cff2e", 980);
  burstCorrect(head.x, head.y);
  void audio.onStageComplete();
  updateHud();
}

function applyCorrect() {
  const stage = state.stage;
  if (!stage) return;
  state.combo += 1;
  let points = Math.round(BASE_POINTS * comboMul());
  if (hasTool("multiplier")) points *= 2;

  state.score += points;
  state.totalScore += points;
  state.bestScore = Math.max(state.bestScore, state.score);
  state.growBy += 1;

  const head = state.snake[0];
  burstCorrect(head.x, head.y);
  void audio.onCorrect(state.combo);

  if (state.lastMistake) {
    popupText(compliment("recovery"), head.x, head.y - 0.7, "#7ffbff", 980);
    state.lastMistake = false;
  } else if (state.combo > 0 && state.combo % 4 === 0) {
    popupText(compliment("milestone"), head.x, head.y - 0.7, "#7ffbff", 980);
  }

  stage.progress += 1;
  state.targetFailures = 0;
  state.targetHintActive = false;
  if (stage.progress >= stage.targetCount) {
    finishStage();
  }
  updateHud();
}

function consumeToolAtHead() {
  const h = state.snake[0];
  const idx = state.boardTools.findIndex((t) => t.x === h.x && t.y === h.y);
  if (idx < 0) return false;

  const [hit] = state.boardTools.splice(idx, 1);
  groupTools.remove(hit.visual.group);
  disposeObject3D(hit.visual.group);

  activateTool(hit.id);
  return true;
}

function consumeHead() {
  const h = state.snake[0];
  const idx = state.letters.findIndex((l) => l.x === h.x && l.y === h.y);
  if (idx < 0) return false;

  const [hit] = state.letters.splice(idx, 1);
  groupLetters.remove(hit.visual.group);
  hit.visual.txt.material.map?.dispose();
  hit.visual.txt.material.dispose();
  hit.visual.halo.material.dispose();
  hit.visual.halo.geometry.dispose();
  hit.visual.plate.material.dispose();
  hit.visual.plate.geometry.dispose();

  const expected = state.stage ? currentTarget(state.stage) : "";
  const correct = normalizeLetter(hit.char) === expected && hit.role === "target";
  if (correct || allowOneStepBack(hit.char)) applyCorrect();
  else applyMistake("wrong");
  return true;
}

function moveStep() {
  if (state.pause || state.stageDone) return;
  if (digestPulses.length) {
    digestPulses = digestPulses.map((p) => p + 1).filter((p) => p < state.snake.length);
  }

  state.direction = state.nextDirection;
  state.prevSnake = state.snake.map((s) => ({ ...s }));

  const d = DIR[state.direction];
  const h = state.snake[0];
  const next = { x: (h.x + d.x + gridCols) % gridCols, y: (h.y + d.y + gridRows) % gridRows };

  if (state.snake.some((s) => s.x === next.x && s.y === next.y) && !hasTool("shield")) {
    applyMistake("self");
    return;
  }

  state.snake.unshift(next);
  if (state.growBy > 0) state.growBy -= 1;
  else state.snake.pop();

  const ateTool = consumeToolAtHead();
  const ateLetter = consumeHead();
  if (ateTool || ateLetter) digestPulses.push(0);
  ensureSpawns();
  syncSnakeMeshes();
  void audio.onMove(hasTool("shoes") ? 1.18 : 1);
}

function updateLogic(dt: number) {
  if (!state.pause && !state.stageDone) {
    const key = expectedKey(state.stage);
    if (key !== state.expectedKey) {
      state.expectedKey = key;
      state.targetFailures = 0;
      state.targetHintActive = false;
    }

    state.letters = state.letters.filter((l) => {
      const alive = state.clock - l.spawnTime < l.ttlMs;
      if (!alive) {
        groupLetters.remove(l.visual.group);
        l.visual.txt.material.map?.dispose();
        l.visual.txt.material.dispose();
        l.visual.halo.material.dispose();
        l.visual.halo.geometry.dispose();
        l.visual.plate.material.dispose();
        l.visual.plate.geometry.dispose();
      }
      return alive;
    });

    state.boardTools = state.boardTools.filter((t) => {
      const alive = state.clock - t.spawnTime < t.ttlMs;
      if (!alive) {
        groupTools.remove(t.visual.group);
        disposeObject3D(t.visual.group);
      }
      return alive;
    });

    if (Math.random() < dt / 1000) ensureSpawns();

    state.toolSpawnCooldownMs -= dt;
    if (state.toolSpawnCooldownMs <= 0 && state.boardTools.length < 1) {
      spawnTool(pickToolForStage());
      state.toolSpawnCooldownMs = randInt(9000, 14000);
    }

    for (let i = state.activeTools.length - 1; i >= 0; i -= 1) {
      state.activeTools[i].remainingMs -= dt;
      if (state.activeTools[i].remainingMs <= 0) {
        state.activeTools.splice(i, 1);
        state.hudRefreshAtMs = 0;
      }
    }

    if (hasTool("magnet")) {
      state.magnetTickMs += dt;
      if (state.magnetTickMs >= 220) {
        applyMagnetPull();
        state.magnetTickMs = 0;
      }
    }
  }

  const hintTarget = state.stage ? currentTarget(state.stage) : "";
  for (const l of state.letters) {
    const isHintTarget = state.targetHintActive && l.role === "target" && normalizeLetter(l.char) === hintTarget;
    const pulseBase = isHintTarget ? 1.2 : 1;
    const pulseAmp = isHintTarget ? 0.3 : 0.15;
    const pulse = pulseBase + Math.sin(state.clock * 0.006 + l.pulse) * pulseAmp;
    l.visual.halo.scale.setScalar(pulse);
    l.visual.halo.material.opacity = isHintTarget ? 0.5 : 0.2;
    l.visual.halo.material.color?.setHex(isHintTarget ? 0xff2df5 : 0x00f5ff);
    l.visual.txt.material.color?.setStyle(isHintTarget ? "#ff9bf6" : "#ccfff9");
    l.visual.group.rotation.y += 0.012;
  }

  for (const t of state.boardTools) {
    t.visual.group.rotation.y += 0.032;
    const bob = 0.78 + Math.sin(state.clock * 0.005 + t.pulse) * 0.12;
    t.visual.group.position.y = bob;
    const pulse = 1 + Math.sin(state.clock * 0.007 + t.pulse) * 0.12;
    t.visual.halo.scale.set(pulse, pulse * 0.66, pulse);
    t.visual.model.rotation.y += 0.03;
    t.visual.model.rotation.z = Math.sin(state.clock * 0.003 + t.pulse) * 0.12;
  }

  updateFx(dt);

  if (state.stageDone) {
    state.stageTransitionMs -= dt;
    if (state.stageTransitionMs <= 0) {
      state.stageIndex += 1;
      nextStage();
    }
  }

  if (state.clock >= state.hudRefreshAtMs) {
    updateHud();
    state.hudRefreshAtMs = state.clock + 250;
  }
}

function setDirection(dir: Direction) {
  if (!DIR[dir]) return;

  let effective = dir;
  if (hasTool("wine")) {
    if (dir === "up") effective = "down";
    else if (dir === "down") effective = "up";
    else if (dir === "left") effective = "right";
    else if (dir === "right") effective = "left";
  }

  const a = DIR[state.direction];
  const b = DIR[effective];
  if (a.x + b.x === 0 && a.y + b.y === 0) return;
  state.nextDirection = effective;
}

function applyDirectionInput(dir: Direction) {
  void audio.ensureStarted();
  const before = state.nextDirection;
  setDirection(dir);
  if (state.nextDirection === before) return;
  if (state.pause || state.stageDone) return;

  const instantThreshold = state.moveIntervalMs * 0.25;
  const minGapMs = 42;
  if (state.accumulator >= instantThreshold && state.clock - state.lastInstantStepMs >= minGapMs) {
    moveStep();
    state.accumulator = 0;
    state.lastInstantStepMs = state.clock;
  }
}

function applySwipeAt(x: number, y: number) {
  const dx = x - state.touch.x;
  const dy = y - state.touch.y;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return false;

  if (Math.abs(dx) > Math.abs(dy)) applyDirectionInput(dx > 0 ? "right" : "left");
  else applyDirectionInput(dy > 0 ? "down" : "up");

  state.touch.x = x;
  state.touch.y = y;
  return true;
}

function animateSnake(alpha: number) {
  const time = state.clock * 0.005;
  for (let i = 0; i < state.snake.length; i += 1) {
    const cur = state.snake[i];
    const prev = state.prevSnake[i] || cur;
    const x = lerpWrapAxis(prev.x, cur.x, alpha, gridCols);
    const y = lerpWrapAxis(prev.y, cur.y, alpha, gridRows);
    const wp = toWorld(x, y);
    const m = snakeMeshes[i];
    if (!m) continue;
    const tailTaper = 1 - (i / Math.max(1, state.snake.length - 1)) * 0.32;
    let bulge = 0;
    for (const pulse of digestPulses) {
      const d = Math.abs(i - (pulse + alpha));
      if (d < 1.1) bulge += 1 - d / 1.1;
    }
    bulge = clamp(bulge, 0, 1);
    const digestScale = 1 + bulge * 0.42;
    m.position.set(wp.x, 0.38 + Math.sin(time + i * 0.45) * 0.03, wp.z);
    m.scale.set(tailTaper * digestScale, digestScale, tailTaper * digestScale);

    let vx = 0;
    let vy = 1;
    if (i === 0) {
      vx = DIR[state.direction].x;
      vy = DIR[state.direction].y;
    } else {
      const prevSeg = state.snake[i - 1];
      const curSeg = state.snake[i];
      vx = prevSeg.x - curSeg.x;
      vy = prevSeg.y - curSeg.y;
      if (Math.abs(vx) > gridCols / 2) vx += vx > 0 ? -gridCols : gridCols;
      if (Math.abs(vy) > gridRows / 2) vy += vy > 0 ? -gridRows : gridRows;
    }
    m.rotation.y = Math.atan2(vx, vy);

    if (m.userData.isHead && m.userData.tongue) {
      m.userData.tongue.scale.y = 0.8 + Math.sin(time * 4.2) * 0.25;
    }
  }
}

function updateCamera() {
  boardController.update(state.clock);

  const hueA = (0.78 + Math.sin(state.clock * 0.00035) * 0.12 + 1) % 1;
  const hueB = (0.52 + Math.sin(state.clock * 0.00042 + 1.6) * 0.15 + 1) % 1;
  ambient.color.setHSL(hueA, 0.78, 0.62);
  rimLight.color.setHSL(hueB, 0.92, 0.56);
  keyLight.color.setHSL((hueB + 0.18) % 1, 0.72, 0.68);

  camera.position.x = 0;
  camera.position.z = -cameraCenterZ;
  camera.position.y = 26;
  camera.lookAt(0, 0, -cameraCenterZ);
}

function frame(ms: number) {
  const dt = ms - state.lastMs;
  state.lastMs = ms;
  state.clock += dt;

  state.moveIntervalMs = 1000 / stageSpeed();
  if (!state.pause) {
    state.accumulator += dt;
    while (state.accumulator >= state.moveIntervalMs) {
      moveStep();
      state.accumulator -= state.moveIntervalMs;
    }
    updateLogic(dt);
  }

  const alpha = clamp(state.accumulator / state.moveIntervalMs, 0, 1);
  animateSnake(alpha);
  placeHud();
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function initSnake() {
  const centerX = Math.floor(gridCols / 2);
  const centerY = Math.floor(gridRows / 2);
  state.snake = [
    { x: centerX, y: centerY },
    { x: (centerX - 1 + gridCols) % gridCols, y: centerY },
    { x: (centerX - 2 + gridCols) % gridCols, y: centerY },
  ];
  state.prevSnake = state.snake.map((s) => ({ ...s }));
  digestPulses = [];
  syncSnakeMeshes();
}

function attachInput() {
  attachControls({
    canvas,
    state,
    swipeThreshold: SWIPE_THRESHOLD,
    onDirection: applyDirectionInput,
    onTogglePause: () => {
      setPaused(!state.pause);
    },
  });
}

function setPaused(paused: boolean) {
  const changed = state.pause !== paused;
  state.pause = paused;
  if (pauseOverlay) {
    pauseOverlay.classList.toggle("visible", paused);
    pauseOverlay.setAttribute("aria-hidden", paused ? "false" : "true");
  }
  if (changed) void audio.onPause(paused);
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw").catch(() => {
      // ignore
    });
  }
}

function rebuildBoard(cols: number, rows: number) {
  gridCols = cols;
  gridRows = rows;
  boardController.build({
    cols: gridCols,
    rows: gridRows,
    cell: CELL,
    width: boardWidth(),
    height: boardHeight(),
    halfW: boardHalfW(),
    halfH: boardHalfH(),
  });
}

function onResize() {
  const rect = canvas.getBoundingClientRect();
  const viewportWidth = Math.max(1, rect.width || window.innerWidth);
  const viewportHeight = Math.max(1, rect.height || window.innerHeight);
  const zoomScale = window.visualViewport?.scale ?? 1;

  const prevCols = gridCols;
  const prevRows = gridRows;
  const layout = computeResponsiveLayout(viewportWidth, viewportHeight, zoomScale);
  const gridChanged = layout.cols !== prevCols || layout.rows !== prevRows;
  if (gridChanged) rebuildBoard(layout.cols, layout.rows);

  orthoHeightDynamic = layout.orthoHeight;
  cameraCenterZ = layout.zOffset;
  hudTopPadRatio = layout.topPadRatio;
  hudY = layout.hudWorldY;
  hudToolStep = layout.toolStep;
  hudSideInsetRatio = layout.sideInsetRatio;
  hudToolRightRatio = layout.toolRightRatio;
  updateOrthoCamera(camera, orthoHeightDynamic, viewportWidth, viewportHeight);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewportWidth, viewportHeight, false);

  if (gridChanged && gameReady) {
    clearLetters();
    clearBoardTools();
    initSnake();
    nextStage();
  }

  state.hudRefreshAtMs = 0;
  updateHud();
}

export function initGame() {
  load();
  attachInput();
  registerSW();
  onResize();
  initSnake();
  nextStage();
  gameReady = true;
  setPaused(state.pause);
  const onFirstInteraction = () => {
    void audio.ensureStarted();
    window.removeEventListener("pointerdown", onFirstInteraction);
    window.removeEventListener("keydown", onFirstInteraction);
  };
  const onPauseOverlayPointerDown = (e: PointerEvent) => {
    if (!state.pause) return;
    e.preventDefault();
    e.stopPropagation();
    state.touch.active = false;
    setPaused(false);
  };
  const forcePauseIfInactive = () => {
    state.touch.active = false;
    setPaused(true);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") forcePauseIfInactive();
  };

  window.addEventListener("pointerdown", onFirstInteraction, { passive: true });
  window.addEventListener("keydown", onFirstInteraction);
  pauseOverlay?.addEventListener("pointerdown", onPauseOverlayPointerDown);
  window.addEventListener("resize", onResize);
  window.addEventListener("blur", forcePauseIfInactive);
  window.addEventListener("pagehide", forcePauseIfInactive);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.visualViewport?.addEventListener("resize", onResize);
  requestAnimationFrame(frame);
}
