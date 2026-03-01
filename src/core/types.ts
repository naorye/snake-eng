export type Direction = "up" | "down" | "left" | "right";
export type ToolId = "shoes" | "wine" | "magnet" | "shield" | "multiplier" | "slow";

export interface Cell {
  x: number;
  y: number;
}

export interface TouchState {
  active: boolean;
  x: number;
  y: number;
}

export interface StageRule {
  label: string;
  backward?: boolean;
  onlyCase?: "upper" | "lower";
  skip?: boolean;
  oneBack?: boolean;
}

export interface WordStage {
  mode: "word";
  rule: StageRule;
  shownWord: string;
  canonicalWord: string;
  boardCase: "upper" | "lower";
  targetCount: number;
  progress: number;
}

export interface AbcStage {
  mode: "abc";
  rule: Required<Pick<StageRule, "label">> & {
    backward: boolean;
    onlyCase: "upper" | "lower";
    skip: boolean;
    oneBack: boolean;
  };
  sequence: string[];
  progress: number;
  targetCount: number;
  usedStepBack: boolean;
}

export type Stage = WordStage | AbcStage;

export interface Disposable {
  dispose(): void;
}

export interface ColorLike {
  setHex(hex: number): void;
  setStyle(style: string): void;
}

export interface MaterialLike extends Disposable {
  map?: Disposable;
  opacity?: number;
  transparent?: boolean;
  color?: ColorLike;
}

export interface TransformLike {
  x: number;
  y: number;
  z: number;
  set?(x: number, y: number, z: number): void;
  copy?(v: { x: number; y: number; z: number }): void;
}

export interface ScalableLike {
  setScalar(v: number): void;
  set(x: number, y: number, z: number): void;
}

export interface GroupLike {
  position: TransformLike;
  rotation: TransformLike;
  scale: ScalableLike;
  userData?: Record<string, unknown>;
  add?: (...nodes: unknown[]) => void;
  remove?: (...nodes: unknown[]) => void;
  children?: unknown[];
  traverse?: (cb: (child: { material?: MaterialLike | MaterialLike[]; geometry?: Disposable }) => void) => void;
}

export interface MeshLike {
  material: MaterialLike;
  geometry: Disposable;
  position: TransformLike;
  rotation: TransformLike;
  scale: ScalableLike;
}

export interface SpriteLike {
  material: MaterialLike;
  position: TransformLike;
  scale: ScalableLike;
}

export interface LetterVisual {
  group: GroupLike;
  halo: MeshLike;
  txt: SpriteLike;
  plate: MeshLike;
}

export interface ToolVisual {
  group: GroupLike;
  body: MeshLike;
  model: GroupLike;
  halo: MeshLike;
  rim: MeshLike;
}

export interface ActiveTool {
  id: ToolId;
  remainingMs: number;
}

export interface LetterItem extends Cell {
  char: string;
  role: "target" | "distractor";
  ttlMs: number;
  spawnTime: number;
  pulse: number;
  visual: LetterVisual;
}

export interface ToolItem extends Cell {
  id: ToolId;
  ttlMs: number;
  spawnTime: number;
  pulse: number;
  visual: ToolVisual;
}

export interface GameState {
  score: number;
  totalScore: number;
  bestScore: number;
  stageIndex: number;
  combo: number;
  stage: Stage | null;
  stageDone: boolean;
  stageMistakes: number;
  stageStartMs: number;
  stageTransitionMs: number;
  lastMistake: boolean;
  complimentHistory: string[];
  snake: Cell[];
  prevSnake: Cell[];
  direction: Direction;
  nextDirection: Direction;
  growBy: number;
  letters: LetterItem[];
  boardTools: ToolItem[];
  activeTools: ActiveTool[];
  toolSpawnCooldownMs: number;
  magnetTickMs: number;
  pause: boolean;
  moveIntervalMs: number;
  accumulator: number;
  clock: number;
  lastMs: number;
  touch: TouchState;
  kidName: string;
  hudRefreshAtMs: number;
  expectedKey: string;
  targetFailures: number;
  targetHintActive: boolean;
  lastInstantStepMs: number;
}
