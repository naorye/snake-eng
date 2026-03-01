import * as THREE from "three";

type OrthoLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  updateProjectionMatrix: () => void;
};

export function createSceneContext(canvas: HTMLCanvasElement) {
  const initialWidth = canvas.clientWidth || window.innerWidth;
  const initialHeight = canvas.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1b0430, 16, 55);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 26, 0);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xb86bff, 0.62);
  const keyLight = new THREE.DirectionalLight(0x77fff6, 1.2);
  keyLight.position.set(8, 18, 10);
  const rimLight = new THREE.PointLight(0xff2df5, 3.0, 34, 2.0);
  rimLight.position.set(-8, 10, -6);
  scene.add(ambient, keyLight, rimLight);

  const groups = {
    board: new THREE.Group(),
    snake: new THREE.Group(),
    letters: new THREE.Group(),
    tools: new THREE.Group(),
    fx: new THREE.Group(),
    hud: new THREE.Group(),
  };
  scene.add(groups.board, groups.letters, groups.tools, groups.snake, groups.fx, groups.hud);

  return { THREE, renderer, scene, camera, ambient, keyLight, rimLight, groups };
}

export function updateOrthoCamera(camera: OrthoLike, orthoHeight: number, viewportWidth: number, viewportHeight: number): void {
  const aspect = viewportWidth / viewportHeight;
  const orthoWidth = orthoHeight * aspect;
  camera.left = -orthoWidth / 2;
  camera.right = orthoWidth / 2;
  camera.top = orthoHeight / 2;
  camera.bottom = -orthoHeight / 2;
  camera.updateProjectionMatrix();
}
