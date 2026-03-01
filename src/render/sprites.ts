import * as THREE from "three";

type SpriteTextOptions = {
  size?: number;
  padding?: number;
  font?: string;
  fg?: string;
  bg?: string;
  stroke?: string;
  strokeW?: number;
  glow?: string;
  shadowBlur?: number;
  scale?: number;
};

type Disposable = { dispose: () => void };
type MaterialLike = Disposable & { map?: Disposable };

type NodeLike = {
  traverse?: (cb: (child: NodeLike) => void) => void;
  material?: MaterialLike | MaterialLike[];
  geometry?: Disposable;
};

type GroupLike = { children: unknown[] };

export function createTextTexture(text: string, opts: SpriteTextOptions = {}) {
  const size = opts.size || 72;
  const padding = opts.padding || 26;
  const font = opts.font || `900 ${size}px \"Arial Black\", \"Verdana\", sans-serif`;
  const fg = opts.fg || "#ffffff";
  const bg = opts.bg || "rgba(0,0,0,0)";
  const stroke = opts.stroke || "rgba(0,0,0,0)";
  const strokeW = opts.strokeW || 0;
  const glow = opts.glow || "rgba(0,0,0,0)";

  const cv = document.createElement("canvas");
  const cx = cv.getContext("2d");
  if (!cx) throw new Error("2D canvas context is unavailable");

  cx.font = font;
  const w = Math.ceil(cx.measureText(text).width + padding * 2);
  const h = Math.ceil(size * 1.5 + padding * 2);
  cv.width = Math.max(2, w);
  cv.height = Math.max(2, h);

  cx.fillStyle = bg;
  cx.fillRect(0, 0, cv.width, cv.height);
  cx.font = font;
  cx.textAlign = "center";
  cx.textBaseline = "middle";
  cx.shadowColor = glow;
  cx.shadowBlur = opts.shadowBlur || 0;

  if (strokeW > 0) {
    cx.strokeStyle = stroke;
    cx.lineWidth = strokeW;
    cx.strokeText(text, cv.width / 2, cv.height / 2);
  }
  cx.fillStyle = fg;
  cx.fillText(text, cv.width / 2, cv.height / 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { tex, width: cv.width, height: cv.height, canvas: cv };
}

export function makeSprite(text: string, opts: SpriteTextOptions = {}) {
  const { tex, width, height } = createTextTexture(text, opts);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  const worldW = (width / 160) * (opts.scale || 0.9);
  const worldH = (height / 160) * (opts.scale || 0.9);
  sp.scale.set(worldW, worldH, 1);
  return sp;
}

export function disposeObject3D(node: unknown): void {
  const n = node as NodeLike;
  if (typeof n?.traverse !== "function") return;

  n.traverse((child) => {
    if (Array.isArray(child.material)) child.material.forEach((m) => m?.dispose?.());
    else child.material?.dispose?.();
    child.geometry?.dispose?.();
  });
}

export function clearGroup(group: GroupLike): void {
  while (group.children.length) {
    const node = group.children.pop();
    if (node) disposeObject3D(node);
  }
}
