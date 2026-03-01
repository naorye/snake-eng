import * as THREE from "three";
import { LETTER_FONT } from "../core/constants";
import { makeSprite } from "./sprites";
import type { LetterVisual, ToolVisual } from "../core/types";

export function createSnakeSkinTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const cx = cv.getContext("2d");
  if (!cx) throw new Error("2D canvas context is unavailable");

  const grad = cx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, "#6cff98");
  grad.addColorStop(0.5, "#39d86a");
  grad.addColorStop(1, "#20984a");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, cv.width, cv.height);

  cx.strokeStyle = "rgba(16,70,34,0.65)";
  cx.lineWidth = 2;
  const step = 22;
  for (let y = -step; y < cv.height + step; y += step) {
    for (let x = -step; x < cv.width + step; x += step) {
      cx.beginPath();
      cx.ellipse(x + ((y / step) % 2) * 9, y, 9, 6, 0, 0, Math.PI * 2);
      cx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  tex.needsUpdate = true;
  return tex;
}

export function createToolModel(toolId: string, color: number) {
  const g = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24132f, metalness: 0.35, roughness: 0.42 });
  const neonMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.26 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xf4fcff, metalness: 0.1, roughness: 0.2 });

  if (toolId === "shoes") {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), lightMat);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.24, 6, 12), neonMat);
    upper.rotation.z = -Math.PI / 2;
    upper.position.set(-0.03, 0.1, 0);
    g.add(sole, upper);
  } else if (toolId === "wine") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.34, 12), darkMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), lightMat);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.16, 10), neonMat);
    neck.position.y = 0.22;
    liquid.position.y = -0.03;
    g.add(body, neck, liquid);
  } else if (toolId === "magnet") {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 10, 20, Math.PI), neonMat);
    arc.rotation.z = Math.PI;
    arc.position.y = 0.04;
    const capL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.12), lightMat);
    const capR = capL.clone();
    capL.position.set(-0.17, -0.12, 0);
    capR.position.set(0.17, -0.12, 0);
    g.add(arc, capL, capR);
  } else if (toolId === "shield") {
    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), neonMat);
    shield.scale.y = 1.35;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), lightMat);
    core.rotation.z = Math.PI / 2;
    g.add(shield, core);
  } else if (toolId === "multiplier") {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), neonMat);
    const xBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), lightMat);
    const xBar2 = xBar1.clone();
    xBar1.rotation.z = Math.PI / 4;
    xBar2.rotation.z = -Math.PI / 4;
    xBar1.position.set(-0.05, 0.02, 0.06);
    xBar2.position.set(-0.05, 0.02, 0.06);
    const two = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16, Math.PI * 1.5), lightMat);
    two.position.set(0.08, 0.01, 0.06);
    two.rotation.z = Math.PI / 2;
    g.add(coin, xBar1, xBar2, two);
  } else if (toolId === "slow") {
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), lightMat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 10, 20), neonMat);
    ring.rotation.x = Math.PI / 2;
    const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), darkMat);
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), darkMat);
    hand1.position.z = 0.06;
    hand2.position.set(0.04, 0, 0.06);
    g.add(clock, ring, hand1, hand2);
  }

  g.rotation.x = -0.2;
  return g;
}

export function makeLetterVisual(char: string): LetterVisual {
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.12, 18),
    new THREE.MeshStandardMaterial({ color: 0x2d1a59, emissive: 0x4f1b86, emissiveIntensity: 0.24, roughness: 0.34, metalness: 0.4 })
  );

  const txt = makeSprite(char, {
    font: LETTER_FONT,
    fg: "#ccfff9",
    stroke: "#390b5d",
    strokeW: 9,
    glow: "rgba(255,64,220,0.65)",
    shadowBlur: 22,
    scale: 0.76,
  });

  const haloGeo = new THREE.SphereGeometry(0.34, 16, 16);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.28 });
  const halo = new THREE.Mesh(haloGeo, haloMat);

  const g = new THREE.Group();
  txt.position.y = 0.08;
  halo.position.y = 0.04;
  g.add(plate, halo, txt);
  return { group: g, halo, txt, plate };
}

export function makeToolVisual(toolId: string, toolColor: number): ToolVisual {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.22, 20),
    new THREE.MeshStandardMaterial({ color: 0x261342, emissive: 0x3c1d67, emissiveIntensity: 0.34, metalness: 0.42, roughness: 0.28 })
  );
  g.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.06, 10, 24),
    new THREE.MeshStandardMaterial({ color: toolColor, emissive: toolColor, emissiveIntensity: 0.58, roughness: 0.22, metalness: 0.55 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  g.add(rim);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.66, 18, 18),
    new THREE.MeshBasicMaterial({ color: toolColor, transparent: true, opacity: 0.25 })
  );
  halo.scale.y = 0.56;
  halo.position.y = 0.12;
  g.add(halo);

  const model = createToolModel(toolId, toolColor);
  model.position.y = 0.34;
  g.add(model);

  return { group: g, body, model, halo, rim };
}

export function createSnakeMesh(isHead: boolean, snakeSkinTexture: unknown) {
  const g = new THREE.Group();
  void snakeSkinTexture;
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffe66d,
    emissive: 0xffb800,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.34,
  });

  const cubeSize = isHead ? 0.82 : 0.74;
  const core = new THREE.Mesh(new THREE.BoxGeometry(cubeSize, cubeSize * 0.88, cubeSize), skinMat);
  g.add(core);

  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize * 1.02, cubeSize * 0.9, cubeSize * 1.02));
  const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: isHead ? 0xffffff : 0xbffdf2 }));
  edge.position.y = 0.01;
  g.add(edge);

  if (isHead) {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.18, 0.37, 0.14);
    eyeR.position.set(0.18, 0.37, 0.14);
    g.add(eyeL, eyeR);

    const pupilL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.07), pupilMat);
    const pupilR = pupilL.clone();
    pupilL.position.set(-0.18, 0.385, 0.14);
    pupilR.position.set(0.18, 0.385, 0.14);
    g.add(pupilL, pupilR);

    const tongue = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff4aa9, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    tongue.position.set(0, -0.05, 0.52);
    tongue.rotation.x = -Math.PI / 2;
    g.add(tongue);
    g.userData.tongue = tongue;
  }

  g.userData.isHead = isHead;
  return g;
}
