import * as THREE from "three";

type FxData = {
  age: number;
  life: number;
  type?: "flash" | "light" | "cube";
  rise?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  rv?: any;
};

type FxObject = {
  userData: { fx?: FxData; popup?: FxData };
  material?: { map?: { dispose?: () => void }; opacity?: number; transparent?: boolean; dispose?: () => void };
  geometry?: { dispose?: () => void };
  intensity?: number;
  position: { x: number; y: number; z: number; copy: (v: any) => void };
  rotation: { x: number; y: number; z: number };
  scale: { setScalar: (v: number) => void };
};

export function createFxController(params: {
  groupFx: any;
  toWorld: (cellX: number, cellY: number) => any;
  makeSprite: (text: string, opts: Record<string, unknown>) => any;
  rand: (min: number, max: number) => number;
}) {
  const { groupFx, toWorld, makeSprite, rand } = params;

  function popupText(text: string, cellX: number, cellY: number, color = "#ffffff", life = 1300) {
    const sp = makeSprite(text, {
      font: `900 64px "Arial Black", "Heebo", sans-serif`,
      fg: color,
      stroke: "rgba(0,0,0,0.8)",
      strokeW: 10,
      glow: "rgba(0,0,0,0.35)",
      shadowBlur: 8,
      scale: 0.62,
    });
    const wp = toWorld(cellX, cellY);
    sp.position.copy(wp);
    sp.position.y = 1.8;
    groupFx.add(sp);
    sp.userData.popup = { age: 0, life, rise: rand(0.0012, 0.0023) };
  }

  function burstCorrect(cellX: number, cellY: number) {
    const origin = toWorld(cellX, cellY);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xff2df5, transparent: true, opacity: 0.9 })
    );
    flash.position.copy(origin);
    flash.position.y = 0.8;
    flash.userData.fx = { type: "flash", age: 0, life: 280 };
    groupFx.add(flash);

    const pl = new THREE.PointLight(0x00f5ff, 7.2, 8, 2);
    pl.position.copy(origin);
    pl.position.y = 1.2;
    pl.userData.fx = { type: "light", age: 0, life: 220 };
    groupFx.add(pl);

    for (let i = 0; i < 26; i += 1) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.08, 0.18), rand(0.08, 0.18), rand(0.08, 0.18)),
        new THREE.MeshStandardMaterial({ color: 0xff4cf0, emissive: 0x2b0051, emissiveIntensity: 0.52, metalness: 0.36, roughness: 0.24 })
      );
      cube.position.copy(origin);
      cube.position.y = 0.8;
      const ang = rand(0, Math.PI * 2);
      const speed = rand(0.015, 0.05);
      cube.userData.fx = {
        type: "cube",
        age: 0,
        life: rand(520, 900),
        vx: Math.cos(ang) * speed,
        vz: Math.sin(ang) * speed,
        vy: rand(0.006, 0.02),
        rv: new THREE.Vector3(rand(-0.04, 0.04), rand(-0.06, 0.06), rand(-0.04, 0.04)),
      };
      groupFx.add(cube);
    }
  }

  function burstMistake(cellX: number, cellY: number) {
    const origin = toWorld(cellX, cellY);
    for (let i = 0; i < 12; i += 1) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.07, 0.13), rand(0.07, 0.13), rand(0.07, 0.13)),
        new THREE.MeshStandardMaterial({ color: 0xff7a00, emissive: 0x5c1d00, emissiveIntensity: 0.46, metalness: 0.22, roughness: 0.33 })
      );
      cube.position.copy(origin);
      cube.position.y = 0.7;
      const ang = rand(0, Math.PI * 2);
      const speed = rand(0.009, 0.025);
      cube.userData.fx = {
        type: "cube",
        age: 0,
        life: rand(320, 540),
        vx: Math.cos(ang) * speed,
        vz: Math.sin(ang) * speed,
        vy: rand(0.002, 0.01),
        rv: new THREE.Vector3(rand(-0.03, 0.03), rand(-0.05, 0.05), rand(-0.03, 0.03)),
      };
      groupFx.add(cube);
    }
  }

  function updateFx(dt: number) {
    for (let i = groupFx.children.length - 1; i >= 0; i -= 1) {
      const obj = groupFx.children[i] as FxObject;
      const fx = obj.userData.fx ?? obj.userData.popup;
      if (!fx) continue;

      fx.age += dt;
      const t = fx.age / fx.life;

      if (obj.userData.popup) {
        if (typeof fx.rise === "number") obj.position.y += fx.rise * dt;
        if (obj.material) obj.material.opacity = 1 - t;
      } else if (fx.type === "flash") {
        const s = 1 + t * 3.3;
        obj.scale.setScalar(s);
        if (obj.material) obj.material.opacity = 0.9 * (1 - t);
      } else if (fx.type === "light") {
        if (typeof obj.intensity === "number") obj.intensity = 6.5 * (1 - t);
      } else if (fx.type === "cube") {
        if (typeof fx.vx === "number") obj.position.x += fx.vx * dt;
        if (typeof fx.vz === "number") obj.position.z += fx.vz * dt;
        if (typeof fx.vy === "number") {
          obj.position.y += fx.vy * dt;
          fx.vy -= 0.000045 * dt;
        }
        if (fx.rv) {
          obj.rotation.x += fx.rv.x * dt;
          obj.rotation.y += fx.rv.y * dt;
          obj.rotation.z += fx.rv.z * dt;
        }
        if (obj.material) {
          if (obj.material.transparent !== true) obj.material.transparent = true;
          obj.material.opacity = 1 - t;
        }
      }

      if (fx.age >= fx.life) {
        groupFx.remove(obj);
        obj.material?.map?.dispose?.();
        obj.material?.dispose?.();
        obj.geometry?.dispose?.();
      }
    }
  }

  return { popupText, burstCorrect, burstMistake, updateFx };
}
