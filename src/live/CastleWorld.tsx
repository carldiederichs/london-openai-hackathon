import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Pet } from "../game";
import { LIVE_LOCATIONS } from "./shared";

type Props = {
  pets: Pet[];
  selected?: string;
  todd?: string | null;
  onSelect: (id: string) => void;
  allowed?: string[];
};
const POSITIONS: Record<string, [number, number, number]> = {
  garden: [-7, 0, -4],
  tower: [-1, 4.8, -7],
  archives: [6, 1.8, -4],
  attic: [8, 3.4, 1],
  vault: [5, 0, 6],
  moat: [-5, 0, 7],
  tavern: [-8, 0, 2],
  courtyard: [0, 0, 1],
  camp: [-3, 0, 11],
  vet: [5, 0, 11],
  nursery: [0, 0, 11],
};
const PALETTE = {
  stone: "#beb2ce",
  roof: "#68618f",
  trim: "#ddd4e5",
  grass: "#a5b7a1",
  earth: "#737a84",
  dark: "#514c71",
  glow: "#ffe0a8",
};

export default function CastleWorld(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const reset = useRef<() => void>(() => {}),
    zoom = useRef<(n: number) => void>(() => {});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const container = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor("#e9e4f1", 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D haunted castle. Drag to orbit; scroll or pinch to zoom. Use the room buttons below to select with a keyboard.",
    );
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#e9e4f1", 40, 85);
    const camera = new THREE.OrthographicCamera(-19, 19, 15, -15, 0.1, 100);
    camera.position.set(24, 26, 31);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 1);
    controls.enablePan = false;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.2;
    controls.minZoom = 0.65;
    controls.maxZoom = 2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    reset.current = () => {
      camera.position.set(24, 26, 31);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.target.set(0, 1.2, 1);
      controls.update();
    };
    zoom.current = (n) => {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * n, 0.65, 2);
      camera.updateProjectionMatrix();
    };
    scene.add(new THREE.HemisphereLight("#fff6e5", "#70758c", 2.7));
    const sun = new THREE.DirectionalLight("#fff5e0", 3.2);
    sun.position.set(-12, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -20,
      right: 20,
      top: 20,
      bottom: -20,
    });
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const textures = new Set<THREE.Texture>();
    const mat = (color: string) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    function mesh(
      geo: THREE.BufferGeometry,
      color: string,
      xyz: number[],
      parent: THREE.Object3D = scene,
    ) {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(xyz[0], xyz[1], xyz[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color = PALETTE.stone,
      parent: THREE.Object3D = scene,
    ) {
      return mesh(new THREE.BoxGeometry(w, h, d), color, [x, y, z], parent);
    }
    function label(text: string, x: number, y: number, z: number, scale = 3.7) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 96;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#fffdf7";
      c.beginPath();
      c.roundRect(4, 4, 504, 84, 28);
      c.fill();
      c.fillStyle = "#49455c";
      c.font = "600 26px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, 256, 46, 470);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      );
      sprite.position.set(x, y, z);
      sprite.scale.set(scale, (scale * 96) / 512, 1);
      sprite.renderOrder = 10;
      scene.add(sprite);
      return sprite;
    }
    // A floating island with a cutaway keep: every hiding spot stays visible.
    mesh(
      new THREE.CylinderGeometry(15, 12.8, 2.5, 12),
      PALETTE.earth,
      [0, -1.6, 1],
    );
    mesh(
      new THREE.CylinderGeometry(15, 15, 0.45, 12),
      PALETTE.grass,
      [0, -0.2, 1],
    );
    const water = mesh(
      new THREE.TorusGeometry(12.4, 1, 8, 64),
      "#91bfc8",
      [0, 0.1, 1],
    );
    water.rotation.x = Math.PI / 2;
    water.receiveShadow = false;
    box(0, 0.1, 1, 7, 0.25, 10, "#d6cec1");
    box(-5, 0.12, 1, 9, 0.18, 1.3, "#d6cec1");
    box(5, 0.12, 3, 8, 0.18, 1.3, "#d6cec1");
    box(0, 0.22, 12, 3, 0.25, 5, "#b8a18e");
    box(0, 1.5, -6, 12, 3, 1.2);
    for (let i = -6; i <= 6; i += 1.4)
      box(i, 3.3, -6, 0.8, 0.8, 1.4, PALETTE.trim);
    function tower(x: number, z: number, height: number, r = 1.6) {
      mesh(new THREE.CylinderGeometry(r, r + 0.15, height, 10), PALETTE.stone, [
        x,
        height / 2,
        z,
      ]);
      mesh(
        new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.5, 10),
        PALETTE.trim,
        [x, height - 0.2, z],
      );
      mesh(new THREE.ConeGeometry(r + 0.4, 2.4, 10), PALETTE.roof, [
        x,
        height + 1.2,
        z,
      ]);
      box(x, height - 0.9, z + r, 0.5, 0.9, 0.1, PALETTE.dark);
      box(x, height - 0.86, z + r + 0.07, 0.12, 0.7, 0.06, PALETTE.glow);
      const pole = box(x, height + 3, z, 0.07, 1.3, 0.07, PALETTE.dark);
      box(x + 0.4, pole.position.y + 0.3, z, 0.8, 0.45, 0.05, "#d69790");
    }
    tower(-5, -6, 4);
    tower(5, -6, 4);
    tower(-1, -7, 6);
    box(6, 1.3, -3, 4, 2.6, 3);
    mesh(
      new THREE.ConeGeometry(3, 1.5, 4),
      PALETTE.roof,
      [6, 3.3, -3],
    ).rotation.y = Math.PI / 4;
    tower(8, 1, 3.5, 1.25);
    box(5, 0.9, 6, 3, 1.8, 2.5, PALETTE.dark);
    box(5, 1, 7.3, 1.5, 1.5, 0.12, "#b5acbc");
    box(-8, 1, 2, 3, 2, 3, "#d0bba7");
    mesh(
      new THREE.ConeGeometry(2.7, 1.7, 4),
      "#b28b83",
      [-8, 2.8, 2],
    ).rotation.y = Math.PI / 4;
    box(-8, 0.8, 3.53, 0.7, 1.6, 0.1, PALETTE.dark);
    for (const x of [-8.5, -6.7])
      for (const z of [-5, -3.4]) {
        box(x, 0.2, z, 1.1, 0.35, 1.1, "#7f927f");
        for (let j = 0; j < 3; j++)
          mesh(
            new THREE.SphereGeometry(0.2, 6, 4),
            ["#edb4be", "#ebcf8f", "#bdb0db"][j],
            [x + (j - 1) * 0.25, 0.5, z],
          );
      }
    mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.15, 24),
      "#87b6c2",
      [-5, 0.12, 7],
    );
    mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16), "#c7b9d2", [0, 0.3, 1]);
    mesh(new THREE.OctahedronGeometry(0.65), "#d3abd0", [0, 1.2, 1]);
    // Trees, pumpkins and little lights around the castle boundary.
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2,
        r = 13.4;
      const x = Math.cos(a) * r,
        z = 1 + Math.sin(a) * r;
      if (z > 12 && Math.abs(x) < 4) continue;
      box(x, 0.6, z, 0.2, 1.2, 0.2, "#928580");
      mesh(new THREE.ConeGeometry(0.8, 2.2, 5), i % 2 ? "#798f83" : "#97a78e", [
        x,
        2,
        z,
      ]);
    }
    for (const [x, z] of [
      [-3, 5],
      [3, 5],
      [-6, -1],
      [6, 9],
      [-10, 0],
    ]) {
      mesh(new THREE.SphereGeometry(0.4, 8, 6), "#dfaa7a", [x, 0.4, z]);
      box(x, 0.85, z, 0.1, 0.2, 0.1, "#7d896c");
      box(x - 0.13, 0.45, z + 0.36, 0.09, 0.12, 0.08, PALETTE.dark);
      box(x + 0.13, 0.45, z + 0.36, 0.09, 0.12, 0.08, PALETTE.dark);
    }
    label("BASE CAMP", -3, 0.7, 11, 2.5);
    label("VET +50", 5, 0.7, 11, 2.3);
    label("NURSERY", 0, 0.7, 11, 2.5);
    const targets: THREE.Object3D[] = [];
    const halos = new Map<string, THREE.Mesh>();
    LIVE_LOCATIONS.forEach((l, i) => {
      const [x, y, z] = POSITIONS[l.id];
      const marker = mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.15, 24),
        "#f6e2aa",
        [x, y + 0.35, z],
      );
      marker.userData.location = l.id;
      targets.push(marker);
      const halo = mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 32), "#647e68", [
        x,
        y + 0.3,
        z,
      ]);
      halo.rotation.x = Math.PI / 2;
      halos.set(l.id, halo);
      const tag = label(`${i + 1}  ${l.name}`, x, y + 1.25, z, 4.2);
      tag.userData.location = l.id;
      targets.push(tag);
    });
    const petObjects = new Map<
      string,
      { object: THREE.Group; target: THREE.Vector3; image?: string }
    >();
    const todd = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.48, 20, 16), "#262531", [0, 0, 0], todd);
    for (const x of [-0.16, 0.16])
      mesh(
        new THREE.SphereGeometry(0.065, 8, 8),
        "#ffffff",
        [x, 0.07, 0.44],
        todd,
      );
    scene.add(todd);
    todd.visible = false;
    let previousPets: Pet[] | null = null;
    function disposeObject(object: THREE.Object3D) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((m) => {
            const map = (m as THREE.MeshStandardMaterial).map;
            if (map) {
              map.dispose();
              textures.delete(map);
            }
            m.dispose();
          });
        }
      });
      scene.remove(object);
    }
    function updatePets() {
      const pets = latest.current.pets;
      if (pets === previousPets) return;
      previousPets = pets;
      for (const [id, p] of petObjects)
        if (!pets.some((p) => p.id === id)) {
          disposeObject(p.object);
          petObjects.delete(id);
        }
      pets.forEach((p, i) => {
        let item = petObjects.get(p.id);
        if (!item) {
          const group = new THREE.Group();
          scene.add(group);
          item = { object: group, target: new THREE.Vector3(), image: p.image };
          petObjects.set(p.id, item);
          if (p.image) {
            const tex = new THREE.TextureLoader().load(p.image, (t) => {
              if (disposed) {
                t.dispose();
                return;
              }
              t.colorSpace = THREE.SRGBColorSpace;
            });
            textures.add(tex);
            const sprite = new THREE.Sprite(
              new THREE.SpriteMaterial({ map: tex }),
            );
            sprite.scale.set(1.5, 1.5, 1);
            group.add(sprite);
          } else {
            mesh(
              new THREE.SphereGeometry(0.4, 10, 8),
              p.color,
              [0, 0, 0],
              group,
            );
            for (const x of [-0.18, 0.18]) {
              if (p.species === "bunny")
                mesh(
                  new THREE.CapsuleGeometry(0.09, 0.5, 3, 6),
                  p.color,
                  [x, 0.5, 0],
                  group,
                );
              else if (["cat", "dog", "dragon"].includes(p.species))
                mesh(
                  new THREE.ConeGeometry(0.17, 0.35, 4),
                  p.color,
                  [x, 0.38, 0],
                  group,
                );
              if (p.species === "owl" || p.species === "dragon")
                mesh(
                  new THREE.SphereGeometry(0.25, 6, 4),
                  p.color,
                  [x * 2.7, -0.02, 0],
                  group,
                ).scale.set(1, 0.35, 1.6);
              mesh(
                new THREE.SphereGeometry(0.055, 6, 6),
                PALETTE.dark,
                [x, 0.07, 0.36],
                group,
              );
            }
            mesh(
              new THREE.SphereGeometry(0.06, 6, 6),
              "#fff2dc",
              [0, -0.08, 0.4],
              group,
            );
            if (p.species === "robot")
              box(0, 0.5, 0, 0.08, 0.3, 0.08, PALETTE.dark, group);
          }
          group.position.set(-3, 0.8, 11);
        }
        const base = POSITIONS[p.location] || POSITIONS.camp;
        const peers = pets.filter((q) => q.location === p.location),
          index = peers.findIndex((q) => q.id === p.id),
          angle = (index / Math.max(peers.length, 1)) * Math.PI * 2;
        item.target.set(
          base[0] + Math.cos(angle) * 0.8,
          base[1] + 0.8,
          base[2] + Math.sin(angle) * 0.8,
        );
        item.object.userData.offset = i;
      });
    }
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(targets)[0];
      if (hit) latest.current.onSelect(hit.object.userData.location);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const aspect = w / h;
      const height = Math.max(15, 18 / aspect);
      camera.left = -height * aspect;
      camera.right = height * aspect;
      camera.top = height;
      camera.bottom = -height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    renderer.setAnimationLoop((time) => {
      if (document.hidden) return;
      updatePets();
      const t = time / 1000;
      for (const p of petObjects.values()) {
        p.object.position.lerp(p.target, media.matches ? 1 : 0.075);
        if (!media.matches)
          p.object.position.y =
            p.target.y + Math.sin(t * 3 + p.object.userData.offset) * 0.07;
        p.object.rotation.y = Math.atan2(
          camera.position.x - p.object.position.x,
          camera.position.z - p.object.position.z,
        );
      }
      for (const [id, halo] of halos) {
        halo.visible = id === latest.current.selected;
        (halo.material as THREE.MeshStandardMaterial).color.set(
          latest.current.allowed && !latest.current.allowed.includes(id)
            ? "#bb7d7b"
            : "#647e68",
        );
      }
      const reveal = latest.current.todd;
      todd.visible = !!reveal;
      if (reveal && POSITIONS[reveal]) {
        const [x, y, z] = POSITIONS[reveal];
        todd.position.set(
          x,
          y + 1.1 + (media.matches ? 0 : Math.sin(t * 2) * 0.1),
          z,
        );
        todd.lookAt(camera.position);
      }
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeObject(scene);
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="world-shell">
      <div ref={mount} className="castle-world" hidden={failed} />
      {failed && (
        <div className="world-fallback">
          <span>♜</span>
          <h2>The castle is still open.</h2>
          <p>
            This device could not start 3D. All rooms and actions work through
            the buttons below.
          </p>
        </div>
      )}
      <div className="world-caption">
        <span>THE HAUNTED KEEP</span>
        <small>
          {failed
            ? "Accessible room view"
            : "Drag to orbit · pinch or scroll to zoom"}
        </small>
      </div>
      {!failed && (
        <div className="camera-controls">
          <button onClick={() => zoom.current(1.15)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoom.current(1 / 1.15)} aria-label="Zoom out">
            −
          </button>
          <button onClick={() => reset.current()}>Reset view</button>
        </div>
      )}
    </div>
  );
}
