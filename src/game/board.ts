import * as THREE from "three";
import { clearGroup } from "../render/sprites";

type TileFx = { material: any; parity: number; phase: number };

export type BoardController = {
  build: () => void;
  update: (clockMs: number) => void;
};

export function createBoardController(params: {
  groupBoard: any;
  grid: number;
  cell: number;
  boardSize: number;
  boardHalf: number;
  rand: (min: number, max: number) => number;
  clamp: (v: number, min: number, max: number) => number;
}): BoardController {
  const { groupBoard, grid, cell, boardSize, boardHalf, rand, clamp } = params;
  const boardTilesFx: TileFx[] = [];

  function build() {
    clearGroup(groupBoard);
    boardTilesFx.length = 0;

    const baseGeo = new THREE.BoxGeometry(boardSize + 1.2, 1.0, boardSize + 1.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a0e4f, roughness: 0.58, metalness: 0.22 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.64;
    groupBoard.add(base);

    const tileGeo = new THREE.PlaneGeometry(cell, cell);
    for (let y = 0; y < grid; y += 1) {
      for (let x = 0; x < grid; x += 1) {
        const parity = (x + y) % 2;
        const mat = new THREE.MeshStandardMaterial({
          color: parity ? 0x2a164f : 0x16354f,
          emissive: parity ? 0x17052b : 0x06213a,
          emissiveIntensity: 0.35,
          roughness: 0.58,
          metalness: 0.28,
        });
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set((x + 0.5) * cell - boardHalf, 0.001, (y + 0.5) * cell - boardHalf);
        groupBoard.add(tile);
        boardTilesFx.push({ material: mat, parity, phase: rand(0, Math.PI * 2) });
      }
    }

    const gridHelper = new THREE.GridHelper(boardSize, grid, 0x00f5ff, 0xff2df5);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.33;
    gridHelper.material.transparent = true;
    groupBoard.add(gridHelper);
  }

  function update(clockMs: number) {
    const t = clockMs * 0.0012;
    for (const tile of boardTilesFx) {
      const baseHue = tile.parity ? 0.04 : 0.56;
      const waveA = Math.sin(t + tile.phase) * 0.16;
      const waveB = Math.sin(t * 1.9 - tile.phase * 0.7) * 0.07;
      const hue = (baseHue + waveA + waveB + 1) % 1;
      const sat = 0.86;
      const lit = (tile.parity ? 0.34 : 0.4) + Math.sin(t * 2.2 + tile.phase) * 0.06;
      const emissiveLit = 0.14 + (Math.sin(t * 2.7 - tile.phase) + 1) * 0.08;
      tile.material.color.setHSL(hue, sat, clamp(lit, 0.2, 0.58));
      tile.material.emissive.setHSL((hue + 0.03) % 1, 0.96, clamp(emissiveLit, 0.05, 0.32));
    }
  }

  return { build, update };
}
