import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CODEX_PETS, type Pet } from "../pets";
import { ROOM_FLOORS, POSITIONS, INTERIORS, ANNEX_ROOMS } from "./world";
import {
  planJourney,
  roomPoint,
  sampleJourney,
  spriteFrame,
  type Journey,
  type Point,
} from "./movement";

export type Travel = {
  id: string;
  name: string;
  from: string;
  to: string;
  mode: Journey["mode"];
};
import { GATES, STAT_LABELS, LIVE_LOCATIONS } from "./shared";

type Props = {
  pets: Pet[];
  selected?: string;
  todd?: string | null;
  onSelect: (id: string) => void;
  allowed?: string[];
  selectedPet?: string;
  paused?: boolean;
  onTravelChange?: (travel: Travel[]) => void;
};
const PALETTE = {
  stone: "#9d9279",
  roof: "#353e3d",
  trim: "#baad91",
  grass: "#526951",
  earth: "#263b34",
  dark: "#202f2a",
  glow: "#ffc57e",
};

export default function CastleWorld(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const reset = useRef<() => void>(() => {}),
    zoom = useRef<(n: number) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [simple, setSimple] = useState(false);
  const [inside, setInside] = useState(false);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(false);
  followRef.current = follow;
  const floorRef = useRef(0);
  useEffect(() => {
    if (props.selected && props.selected in INTERIORS) {
      setInside(true);
    }
  }, [props.selected]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverPlace = LIVE_LOCATIONS.find(
    (l) => l.id === (hoverId || props.selected),
  );
  const hoverGate = hoverPlace ? GATES[hoverPlace.id] : undefined;
  const insideRef = useRef(false);
  insideRef.current = inside;
  const autoInside =
    props.pets.some(
      (p) =>
        p.location in INTERIORS ||
        (p.position && p.position[2] < 0 && Math.abs(p.position[0]) < 44),
    ) || !!(props.todd && props.todd in INTERIORS);
  useEffect(() => {
    if (simple || failed) props.onTravelChange?.([]);
  }, [simple, failed, props.onTravelChange]);
  useEffect(() => {
    if (simple || failed) return;
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
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1 : 1.35),
    );
    renderer.setClearColor("#152421", 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D haunted castle. Drag to orbit; right-drag to pan; scroll or pinch to zoom. Open Rooms in the left overlay to select with a keyboard.",
    );
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#152421", 145, 260);
    const camera = new THREE.OrthographicCamera(-19, 19, 15, -15, 0.1, 320);
    camera.position.set(65, 88, 85);
    camera.zoom = 0.65;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 4, -10);
    controls.enablePan = true;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.2;
    controls.minZoom = 0.65;
    controls.maxZoom = 3.5;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    reset.current = () => {
      camera.position.set(65, 88, 85);
      camera.zoom = 0.65;
      camera.updateProjectionMatrix();
      controls.target.set(0, 4, -10);
      controls.update();
    };
    zoom.current = (n) => {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * n, 0.65, 3.5);
      camera.updateProjectionMatrix();
    };
    scene.add(new THREE.HemisphereLight("#dce6d0", "#1d3534", 1.9));
    const sun = new THREE.DirectionalLight("#d3dfd7", 2.2);
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
    let activeParent: THREE.Object3D = scene;
    const upperCastle = new THREE.Group();
    scene.add(upperCastle);
    const mat = (color: string) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    function mesh(
      geo: THREE.BufferGeometry,
      color: string,
      xyz: number[],
      parent: THREE.Object3D = activeParent,
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
      parent: THREE.Object3D = activeParent,
    ) {
      return mesh(new THREE.BoxGeometry(w, h, d), color, [x, y, z], parent);
    }
    function label(text: string, x: number, y: number, z: number, scale = 3.7) {
      const canvas = document.createElement("canvas");
      canvas.width = text === "♥" ? 128 : 512;
      canvas.height = text === "♥" ? 128 : 96;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#e5d9b7";
      c.beginPath();
      c.roundRect(4, 4, 504, 84, 28);
      if (text !== "♥") c.fill();
      c.fillStyle = text === "♥" ? "#efa0b7" : "#26392f";
      c.font = text === "♥" ? "100px sans-serif" : "600 32px monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 12);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      );
      sprite.position.set(x, y, z);
      sprite.scale.set(scale, (scale * canvas.height) / canvas.width, 1);
      sprite.renderOrder = 10;
      scene.add(sprite);
      return sprite;
    }
    // Original procedural model inspired by Ardross Castle's exterior, not a
    // survey or a floor plan: a long baronial façade, square tower, and terrace.
    mesh(
      new THREE.PlaneGeometry(210, 210),
      "#30472e",
      [0, -0.15, 0],
    ).rotation.x = -Math.PI / 2;
    const lawn = mesh(new THREE.PlaneGeometry(38, 32), "#526a39", [0, -0.1, 3]);
    lawn.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 12; i++)
      box(
        -16 + i * 2.8,
        -0.07,
        10,
        1.4,
        0.025,
        16,
        i % 2 ? "#4a6134" : "#526a39",
      );
    box(0, 0.35, 0, 24, 0.8, 12, "#797768");
    box(0, 0.78, 0, 23.8, 0.12, 11.8, "#b3a88c");
    const stone = PALETTE.stone,
      trim = PALETTE.trim,
      roofColor = PALETTE.roof;
    function roof(
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number,
    ) {
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2, 0);
      shape.lineTo(0, h);
      shape.lineTo(d / 2, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: w,
        bevelEnabled: false,
        steps: 1,
      });
      geo.rotateY(Math.PI / 2);
      return mesh(geo, roofColor, [x - w / 2, y, z]);
    }
    function windowAt(x: number, y: number, z: number, w = 0.62, h = 1.15) {
      box(x, y, z, w + 0.18, h + 0.18, 0.18, trim);
      const pane = box(x, y, z + 0.12, w, h, 0.08, "#29302b");
      if (Math.round(x * 3 + y) % 3 === 0) {
        pane.material.emissive.set("#a96b2e");
        pane.material.emissiveIntensity = 0.45;
      }
      box(x, y, z + 0.18, 0.065, h, 0.04, trim);
      box(x, y, z + 0.18, w, 0.065, 0.04, trim);
      box(x, y - h / 2 - 0.1, z + 0.15, w + 0.3, 0.13, 0.3, trim);
    }
    function turret(x: number, z: number, base: number, h: number, r = 0.42) {
      mesh(new THREE.CylinderGeometry(r, r + 0.09, h, 12), stone, [
        x,
        base + h / 2,
        z,
      ]);
      mesh(new THREE.ConeGeometry(r + 0.16, 1.7, 12), roofColor, [
        x,
        base + h + 0.85,
        z,
      ]);
      mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.15, 12), trim, [
        x,
        base + h - 0.1,
        z,
      ]);
    }
    upperCastle.scale.y = 1;
    activeParent = upperCastle;
    // The entrance belongs to the same architectural scale as the four wings.
    box(-4, 6.4, -3.5, 12, 11, 6.5, stone);
    roof(-4, 12, -3.5, 13, 7.5, 4);
    for (const x of [-10, 2]) turret(x, -0.8, 8, 5.2, 0.75);
    box(-4, 2.5, -0.15, 2.4, 3.3, 0.3, "#25312b");
    mesh(
      new THREE.TorusGeometry(1.2, 0.3, 8, 24, Math.PI),
      trim,
      [-4, 4.1, 0.08],
    );
    for (const x of [-5.6, -2.4]) box(x, 2.3, 0.1, 0.4, 3, 1, trim);
    box(-4, 4.65, 0.4, 4.3, 0.3, 2, trim);
    for (const x of [-7.5, -0.5])
      for (const y of [6.3, 9.4]) windowAt(x, y, -0.1, 1.3, 2.1);
    windowAt(-4, 9.4, -0.1, 1.7, 2.1);
    const interiors = new THREE.Group();
    scene.add(interiors);
    interiors.visible = false;
    activeParent = interiors;
    // Low walls and door gaps keep every interior readable in the cutaway.
    box(-1, 0.88, -4.3, 20, 0.14, 6.5, "#756d57");
    box(-8, 1.6, -7.5, 6, 1.4, 0.25, stone);
    box(3, 1.6, -7.5, 12, 1.4, 0.25, stone);
    for (const x of [-11, 9]) box(x, 1.6, -4.3, 0.25, 1.4, 6.5, stone);
    for (const x of [-6, -2, 4]) {
      box(x, 1.6, -6.5, 0.2, 1.4, 2);
      box(x, 1.6, -2.1, 0.2, 1.4, 2.1);
    }
    box(6.5, 1.5, -4.7, 5, 1.2, 0.18, stone);
    for (const [x, z, w, d, color] of [
      [-8.5, -4.3, 4.5, 5.8, "#735448"],
      [-4, -4.3, 3.6, 5.8, "#77725c"],
      [1, -4.3, 5.5, 5.8, "#5c6559"],
      [6.5, -6, 4.5, 2.6, "#80745d"],
      [6.5, -2.7, 4.5, 2.8, "#4b5753"],
    ] as Array<[number, number, number, number, string]>)
      box(x, 0.98, z, w, 0.06, d, color);
    // Tavern: long dining table, chairs, sideboard and bottle-shaped traps as decor.
    box(-8.4, 1.5, -5.5, 1.5, 0.15, 1.6, "#62442e");
    for (const x of [-9.6, -7.2])
      for (const z of [-6.5, -4.5]) {
        box(x, 1.2, z, 0.6, 0.15, 0.65, "#4e392b");
        box(x, 1.6, z + 0.3, 0.6, 0.75, 0.1, "#4e392b");
      }
    box(-10.5, 1.4, -5.8, 0.6, 0.8, 2, "#463e2c");
    for (const z of [-5.8, -5.3]) {
      mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.35, 8), "#4c653c", [
        -10.5,
        1.98,
        z,
      ]);
      mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8), "#4c653c", [
        -10.5,
        2.23,
        z,
      ]);
    }
    // Tower room: a curved stair, telescope and a chart table.
    for (let i = 0; i < 10; i++) {
      const a = i * 0.45;
      const step = box(
        -4 + Math.cos(a) * 1.1,
        1.04 + i * 0.09,
        -5 + Math.sin(a) * 1.1,
        0.6,
        0.12,
        0.45,
        "#b2a489",
      );
      step.rotation.y = -a;
    }
    box(-3.9, 1.4, -2.1, 1.2, 0.15, 0.7, "#5d4b34");
    box(-3.9, 1.5, -2.1, 0.8, 0.04, 0.5, "#cfc19a");
    // Library: shelves with colored book spines, reading desk and rug.
    box(0.8, 1.02, -3.8, 3, 0.04, 3, "#7d5148");
    for (const x of [-0.7, 0.7, 2.1, 3.4]) {
      box(x, 1.8, -7, 0.95, 1.6, 0.5, "#493d2e");
      for (let row = 0; row < 2; row++)
        for (let b = 0; b < 4; b++)
          box(
            x - 0.32 + b * 0.21,
            1.35 + row * 0.65,
            -6.68,
            0.14,
            0.45,
            0.12,
            ["#857348", "#576346", "#7c4b3c", "#637477"][b],
          );
    }
    box(1, 1.5, -5, 1.8, 0.15, 0.9, "#63503a");
    box(1, 1.61, -5, 0.65, 0.05, 0.4, "#d7caa5");
    // Antique photographs of the mansion's fictional former residents.
    const portraitPlaceholder = document.createElement("canvas");
    portraitPlaceholder.width = portraitPlaceholder.height = 1;
    const portraitAtlas: THREE.Texture = new THREE.Texture(portraitPlaceholder);
    portraitAtlas.needsUpdate = true;
    new THREE.ImageLoader().load("/ancestors-atlas.png", (loaded) => {
      if (disposed) return;
      portraitAtlas.image = loaded;
      for (const texture of textures)
        if (texture.source === portraitAtlas.source) texture.needsUpdate = true;
    });
    portraitAtlas.colorSpace = THREE.SRGBColorSpace;
    textures.add(portraitAtlas);
    // A stylized guest portrait, separate from the fictional pet ancestor atlas.
    const tiboPhoto: THREE.Texture = new THREE.Texture(portraitPlaceholder);
    tiboPhoto.colorSpace = THREE.SRGBColorSpace;
    tiboPhoto.needsUpdate = true;
    textures.add(tiboPhoto);
    new THREE.ImageLoader().load("/tibo-pixel.png", (loaded) => {
      if (disposed) return;
      tiboPhoto.image = loaded;
      tiboPhoto.needsUpdate = true;
    });
    const portraitWalls = [
      [-0.7, 3.15, -7],
      [0.7, 3.15, -7],
      [2.1, 3.15, -7],
      [3.5, 3.15, -7],
      [-9.7, 2.65, -6.8],
      [-7.6, 2.65, -6.8],
      [-5, 2.65, -6.9],
      [-3.2, 2.65, -6.9],
      [5.5, 2.65, -7.15],
      [7.5, 2.65, -7.15],
      [5.5, 2.4, -4.05],
      [7.5, 2.4, -4.05],
      [-9.7, 2.5, -2],
      [-7.6, 2.5, -2],
      [-5, 2.5, -1.6],
      [-3.2, 2.5, -1.6],
    ];
    for (let i = 0; i < portraitWalls.length; i++) {
      const [x, originalY, pz] = portraitWalls[i];
      const isTibo = i === 5;
      const py = isTibo ? 3.45 : originalY;
      box(
        x,
        py,
        pz,
        isTibo ? 2.35 : 1.35,
        isTibo ? 2.55 : 1.55,
        0.18,
        isTibo ? "#d4b56f" : "#a1844c",
      );
      // Right-hand tavern frame, clear of the sideboard.
      const ancestorIndex = i === 4 ? 5 : i;
      const photo = isTibo ? tiboPhoto : portraitAtlas.clone();
      if (!isTibo) {
        photo.repeat.set(0.25, 0.25);
        photo.offset.set(
          (ancestorIndex % 4) * 0.25,
          0.75 - Math.floor(ancestorIndex / 4) * 0.25,
        );
      }
      textures.add(photo);
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(isTibo ? 2.1 : 1.15, isTibo ? 2.1 : 1.35),
        new THREE.MeshBasicMaterial({ map: photo }),
      );
      frame.name = isTibo
        ? "Tibo — Keeper of the Reset"
        : `Pet ancestor ${ancestorIndex + 1}`;
      frame.position.set(x, py + (isTibo ? 0.1 : 0), pz + 0.15);
      interiors.add(frame);
      if (isTibo) {
        const plaqueCanvas = document.createElement("canvas");
        plaqueCanvas.width = 512;
        plaqueCanvas.height = 96;
        const ink = plaqueCanvas.getContext("2d")!;
        ink.fillStyle = "#bba16b";
        ink.fillRect(0, 0, 512, 96);
        ink.fillStyle = "#30291c";
        ink.textAlign = "center";
        ink.font = "600 36px Georgia";
        ink.fillText("TIBO", 256, 38);
        ink.font = "24px Georgia";
        ink.fillText("Keeper of the Reset", 256, 76);
        const plaqueTexture = new THREE.CanvasTexture(plaqueCanvas);
        plaqueTexture.colorSpace = THREE.SRGBColorSpace;
        textures.add(plaqueTexture);
        const plaque = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 0.32),
          new THREE.MeshBasicMaterial({ map: plaqueTexture }),
        );
        plaque.position.set(x, py - 1.08, pz + 0.16);
        interiors.add(plaque);
        // Tibo's one-charge reset lives below his portrait. Searching the tavern
        // activates it through the authoritative room server, like other finds.
        const resetZ = pz + 2.15;
        box(x, 1.48, resetZ, 1.2, 1.2, 1.15, "#60695a");
        box(x, 2.12, resetZ, 1.45, 0.16, 1.4, "#d4b56f");
        const portraitLight = new THREE.PointLight("#ffdf9a", 14, 7, 2);
        portraitLight.position.set(x, 4.5, pz + 1.7);
        interiors.add(portraitLight);
        const button = mesh(
          new THREE.CylinderGeometry(0.46, 0.5, 0.25, 24),
          "#df493c",
          [x, 2.3, resetZ],
        );
        button.material.emissive.set("#6b1008");
        button.material.emissiveIntensity = 1.4;
        const resetLabel = document.createElement("canvas");
        resetLabel.width = 256;
        resetLabel.height = 64;
        const resetInk = resetLabel.getContext("2d")!;
        resetInk.fillStyle = "#ae965c";
        resetInk.fillRect(0, 0, 256, 64);
        resetInk.fillStyle = "#30291c";
        resetInk.font = "bold 36px monospace";
        resetInk.textAlign = "center";
        resetInk.fillText("RESET", 128, 44);
        const resetTexture = new THREE.CanvasTexture(resetLabel);
        resetTexture.colorSpace = THREE.SRGBColorSpace;
        textures.add(resetTexture);
        const resetPlaque = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 0.3),
          new THREE.MeshBasicMaterial({ map: resetTexture }),
        );
        resetPlaque.position.set(x, 1.8, resetZ + 0.585);
        interiors.add(resetPlaque);
      }
    }
    const storeys = new Map<number, THREE.Group>();
    // A huge, single-storey mansion: 21 new rooms around broad connected galleries.
    box(0, 0.76, -36, 88, 0.28, 76, stone, scene);
    // Distinct top surfaces: foundation .90, side passages .92, galleries
    // .94, room floors .98, rugs 1.03. Coplanar slabs shimmer when orbiting.
    // Build each side passage once, not once per cross-gallery.
    for (let col = 0; col <= 7; col++)
      box(-42 + col * 12, 0.91, -36, 2.5, 0.02, 50, "#b0a387");
    for (let row = 0; row < 3; row++)
      box(0, 0.93, -12 - row * 24, 86, 0.02, 3.4, "#b0a387");
    box(-4, 0.9, -8.7, 2, 0.1, 3, stone);
    for (const room of ANNEX_ROOMS) {
      const { x, z, index, id } = room;
      const dark = ["coldstorage", "cinema", "drain"].includes(id);
      box(
        x,
        0.93,
        z,
        9.8,
        0.1,
        9.4,
        dark
          ? "#3c4948"
          : ["#756655", "#6b7868", "#715e59", "#637678"][index % 4],
      );
      if ([9, 10, 11].includes(index)) {
        for (const dx of [-3.2, 3.2])
          box(x + dx, 1.65, z - 4.8, 3.6, 1.5, 0.2, stone);
      } else box(x, 1.65, z - 4.8, 10, 1.5, 0.2, stone);
      for (const dx of [-5, 5]) box(x + dx, 1.65, z, 0.2, 1.5, 9.6, stone);
      // A generous front door, aligned with its routing node.
      for (const dx of [-3.2, 3.2])
        box(x + dx, 1.65, z + 4.8, 3.6, 1.5, 0.2, stone);
      box(x, 0.99, z + 4.8, 2.8, 0.08, 0.5, trim);
      const rug = ["#875f50", "#526b64", "#76704e", "#5c576c"][index % 4];
      box(x, 1.01, z, 6.5, 0.04, 5.8, rug);
      if (["floodedcellar", "bathhouse"].includes(id)) {
        box(x, 1.05, z, 6.5, 0.12, 6, "#426f79");
        for (const dx of [-3.6, 3.6])
          box(x + dx, 1.25, z, 0.35, 0.5, 6.5, trim);
      } else if (id === "dormitory") {
        for (const dx of [-2.5, 2.5]) {
          box(x + dx, 1.4, z - 1, 2, 0.8, 3.2, "#574334");
          box(x + dx, 1.86, z - 1, 1.9, 0.15, 3, "#8c626b");
          box(x + dx, 2.8, z - 1, 2.2, 0.15, 3.4, "#574334");
        }
      } else if (["serverloft", "workshop", "laboratory"].includes(id)) {
        for (const dx of [-3, 0, 3]) {
          box(x + dx, 1.9, z - 2.8, 1.6, 1.9, 0.9, "#34494b");
          for (let k = 0; k < 4; k++)
            box(x + dx, 1.25 + k * 0.4, z - 2.3, 1.3, 0.06, 0.05, "#91bdb0");
        }
      } else if (id === "music") {
        box(x - 2, 1.6, z - 1, 2.5, 1.3, 2, "#293b37");
        box(x - 2, 2.3, z, 2.3, 0.1, 0.6, "#ded6b8");
        for (let k = 0; k < 9; k++)
          box(x - 3 + k * 0.25, 2.36, z + 0.1, 0.08, 0.06, 0.35, "#252e2b");
      } else if (id === "cinema") {
        box(x, 2.5, z - 4.6, 6, 2.4, 0.1, "#b8b3a0");
        for (const dx of [-2, 0, 2])
          for (const dz of [-1.5, 0])
            box(x + dx, 1.4, z + dz, 1.1, 0.8, 0.9, "#65474e");
      } else if (["orangery", "wardrobe", "mailroom"].includes(id)) {
        for (const dx of [-3, 0, 3]) {
          box(x + dx, 1.3, z - 2, 1, 0.6, 1, "#8f7254");
          mesh(
            new THREE.IcosahedronGeometry(0.8, 0),
            id === "orangery" ? "#617d4b" : "#ad9568",
            [x + dx, 2.1, z - 2],
          );
        }
      } else if (["kitchen", "dining", "billiards"].includes(id)) {
        box(
          x,
          1.6,
          z - 1,
          5,
          0.25,
          2.6,
          id === "billiards" ? "#3f7160" : "#6d5038",
        );
        for (const dx of [-2, 2])
          for (const dz of [-2, 0])
            box(x + dx, 1.25, z + dz, 0.6, 0.6, 0.6, "#624c37");
        for (let k = 0; k < 4; k++)
          mesh(
            new THREE.SphereGeometry(0.12, 6, 5),
            ["#e3d8b8", "#b85442", "#ceaa61", "#738d9c"][k],
            [x - 1.5 + k, 1.84, z - 1],
          );
      } else {
        // Desks, curios and reading shelves sit behind the clear arrival area.
        box(x, 1.55, z - 1.8, 3.2, 0.2, 1.5, "#68513d");
        mesh(
          new THREE.IcosahedronGeometry(0.45, 1),
          dark ? "#89a3a5" : "#c9b26d",
          [x, 2.05, z - 1.8],
        );
        for (const dx of [-3.5, 3.5]) {
          box(x + dx, 1.8, z - 3.8, 1.6, 1.8, 0.45, "#4a4436");
          for (let k = 0; k < 5; k++)
            box(
              x + dx - 0.6 + k * 0.3,
              1.9,
              z - 3.5,
              0.2,
              1.4,
              0.2,
              ["#75816b", "#9d7458", "#787695"][k % 3],
            );
        }
      }
      // Room-scale detail stays behind the arrival lane and joins the static batches.
      const wood = "#574334",
        brass = "#b59b63",
        linen = "#ded6b8";
      for (const side of [-1, 1]) {
        box(x + side * 4.65, 1.8, z - 1, 0.12, 1.65, 7.5, wood);
        box(x + side * 4.52, 2.65, z - 1, 0.18, 0.12, 7.5, brass);
        for (let panel = 0; panel < 5; panel++)
          box(
            x + side * 4.42,
            1.8,
            z - 4 + panel * 1.45,
            0.12,
            1.25,
            0.1,
            brass,
          );
        box(x + side * 3.8, 1.45, z + 1.8, 0.85, 0.9, 0.85, wood);
        mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.48, 8), "#8f7254", [
          x + side * 3.8,
          2.05,
          z + 1.8,
        ]);
        mesh(new THREE.IcosahedronGeometry(0.55, 0), "#617d4b", [
          x + side * 3.8,
          2.55,
          z + 1.8,
        ]);
      }
      const candle = (cx: number, cy: number, cz: number) => {
        mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.14, 8), brass, [
          cx,
          cy,
          cz,
        ]);
        box(cx, cy + 0.23, cz, 0.09, 0.4, 0.09, linen);
        const flame = mesh(new THREE.OctahedronGeometry(0.07), "#ffc777", [
          cx,
          cy + 0.47,
          cz,
        ]);
        flame.material.emissive.set("#ffc777");
        flame.material.emissiveIntensity = 1.5;
      };
      if (["kitchen", "dining", "ballroom"].includes(id)) {
        for (let n = 0; n < 5; n++) {
          const px = x - 2 + n;
          mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.035, 12), linen, [
            px,
            1.79,
            z - 1,
          ]);
          box(px + 0.32, 1.81, z - 1, 0.04, 0.03, 0.55, brass);
          candle(px, 1.9, z - 2);
        }
        if (id === "kitchen")
          for (let n = 0; n < 3; n++) {
            box(x - 3 + n * 2, 1.6, z - 3.6, 1.6, 1.2, 0.9, "#34494b");
            mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.35, 12), "#777e75", [
              x - 3 + n * 2,
              2.4,
              z - 3.6,
            ]);
            box(x - 3 + n * 2, 2.7, z - 3.6, 0.6, 0.06, 0.6, brass);
          }
        if (id === "ballroom") {
          mesh(new THREE.TorusGeometry(1.2, 0.08, 6, 16), brass, [
            x,
            4.6,
            z - 2,
          ]).rotation.x = Math.PI / 2;
          for (let n = 0; n < 8; n++) {
            const a = (n * Math.PI) / 4;
            candle(x + Math.cos(a) * 1.2, 4.5, z - 2 + Math.sin(a) * 1.2);
          }
        }
      } else if (id === "music") {
        for (let n = 0; n < 7; n++)
          box(x + 2 + n * 0.16, 2.5, z - 2, 0.025, 2.2 - n * 0.18, 0.04, brass);
        box(x + 2.5, 1.5, z - 2, 1.4, 0.15, 0.5, wood);
        box(x + 2.5, 3.5, z - 2, 1.4, 0.15, 0.5, wood).rotation.z = -0.3;
        mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16), brass, [
          x + 2.5,
          2.2,
          z + 0.3,
        ]);
        box(x + 2.5, 1.5, z + 0.3, 0.08, 1.4, 0.08, wood);
      } else if (id === "billiards") {
        for (let n = 0; n < 5; n++)
          box(x - 3 + n * 0.25, 2.4, z - 4, 0.05, 2.6, 0.05, brass).rotation.z =
            0.1;
        box(x - 2.5, 1.15, z - 4, 1.6, 0.15, 0.4, wood);
        box(x + 1.9, 1.82, z - 1, 0.18, 0.12, 0.18, "#738d9c");
      } else if (["observatory", "maproom"].includes(id)) {
        const telescope = mesh(
          new THREE.CylinderGeometry(0.3, 0.42, 2.3, 16),
          brass,
          [x + 2.5, 2.7, z - 2],
        );
        telescope.rotation.z = 0.7;
        for (const dx of [-0.5, 0.5])
          box(x + 2.5 + dx, 1.6, z - 2, 0.08, 1.5, 0.08, wood).rotation.z =
            dx * 0.7;
        mesh(new THREE.SphereGeometry(0.65, 12, 8), "#738d9c", [
          x - 2.6,
          2.5,
          z - 2,
        ]);
        mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), brass, [
          x - 2.6,
          2.5,
          z - 2,
        ]).rotation.z = 0.4;
        box(x, 1.7, z - 1.8, 2, 0.03, 1.1, linen);
      } else if (["serverloft", "workshop", "laboratory"].includes(id)) {
        for (let n = 0; n < 5; n++) {
          const px = x - 2 + n;
          if (id === "laboratory") {
            mesh(new THREE.SphereGeometry(0.19, 10, 8), "#83c3b2", [
              px,
              1.95,
              z + 0.2,
            ]);
            mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), linen, [
              px,
              2.2,
              z + 0.2,
            ]);
          } else {
            box(px, 2.8, z - 2.24, 0.45, 0.3, 0.05, "#83c3b2");
            for (let led = 0; led < 3; led++)
              box(
                px - 0.15 + led * 0.15,
                2.25,
                z - 2.23,
                0.05,
                0.07,
                0.03,
                brass,
              );
          }
        }
        box(x, 1.65, z + 0.2, 5, 0.15, 1.2, wood);
        for (const dx of [-2, 2])
          box(x + dx, 1.25, z + 0.2, 0.12, 0.8, 0.8, wood);
        if (id === "workshop")
          for (let n = 0; n < 3; n++)
            mesh(new THREE.TorusGeometry(0.3 + n * 0.08, 0.1, 4, 8), brass, [
              x - 1 + n,
              1.86,
              z + 0.2,
            ]).rotation.x = Math.PI / 2;
      } else if (["chapel", "cinema"].includes(id)) {
        for (const dx of [-2.5, 2.5])
          for (let n = 0; n < 3; n++) {
            box(x + dx, 1.35, z - 0.5 + n, 1.7, 0.2, 0.65, wood);
            box(
              x + dx,
              1.7,
              z - 0.75 + n,
              1.7,
              0.75,
              0.1,
              id === "chapel" ? wood : "#65474e",
            );
          }
        if (id === "chapel") {
          box(x, 2.4, z - 3, 0.2, 2.1, 0.15, brass);
          box(x, 2.9, z - 3, 1.2, 0.16, 0.15, brass);
          for (const dx of [-1.5, 1.5]) candle(x + dx, 1.9, z - 3);
        } else {
          box(x, 2.7, z + 1.5, 1, 0.6, 0.7, "#34494b");
          mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), brass, [
            x,
            2.7,
            z + 1,
          ]).rotation.x = Math.PI / 2;
        }
      } else if (id === "dormitory") {
        for (const dx of [-2.5, 2.5]) {
          box(x + dx, 2.05, z - 2, 1.5, 0.22, 0.6, linen);
          box(x + dx, 1.98, z - 0.1, 1.9, 0.06, 1.1, "#738d9c");
          candle(x + dx + 1.25, 1.65, z - 2);
        }
      } else if (["coldstorage", "floodedcellar", "drain"].includes(id)) {
        for (let n = 0; n < 4; n++) {
          const pipe = mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 2.8, 10),
            "#777e75",
            [x - 3 + n * 2, 1.4, z - 3.8],
          );
          pipe.rotation.z = Math.PI / 2;
          mesh(new THREE.TorusGeometry(0.22, 0.055, 6, 12), brass, [
            x - 3 + n * 2,
            1.8,
            z - 3.5,
          ]);
        }
        for (const dx of [-3, 3]) {
          mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 12), wood, [
            x + dx,
            1.6,
            z,
          ]);
          for (const y of [1.3, 1.9])
            mesh(new THREE.TorusGeometry(0.51, 0.04, 5, 12), brass, [
              x + dx,
              y,
              z,
            ]).rotation.x = Math.PI / 2;
        }
      } else if (id === "wardrobe") {
        for (const dx of [-2.5, 2.5]) {
          box(x + dx, 2.5, z - 3, 1.8, 2.8, 0.6, wood);
          box(x + dx, 2.5, z - 2.65, 1.5, 2.4, 0.04, "#8c626b");
          box(x + dx, 1.13, z, 0.7, 0.2, 0.35, brass);
        }
      } else if (id === "mailroom") {
        for (let col = 0; col < 7; col++)
          for (let row = 0; row < 3; row++) {
            const px = x - 3 + col;
            box(px, 1.5 + row * 0.55, z - 3.8, 0.9, 0.46, 0.55, wood);
            box(px, 1.5 + row * 0.55, z - 3.49, 0.65, 0.15, 0.04, linen);
          }
      } else if (id === "orangery") {
        for (const dx of [-3, 0, 3])
          for (let n = 0; n < 4; n++)
            mesh(new THREE.SphereGeometry(0.13, 6, 5), "#ceaa61", [
              x + dx + Math.sin(n) * 0.45,
              2.2 + Math.cos(n) * 0.35,
              z - 1.65,
            ]);
        box(x, 1.3, z + 1, 4, 0.25, 0.8, wood);
      } else if (id === "eyrie") {
        for (const dx of [-2.5, 2.5]) {
          mesh(new THREE.TorusGeometry(0.65, 0.18, 5, 12), wood, [
            x + dx,
            1.4,
            z - 2,
          ]).rotation.x = Math.PI / 2;
          for (let n = 0; n < 3; n++)
            mesh(new THREE.SphereGeometry(0.18, 8, 6), linen, [
              x + dx - 0.25 + n * 0.25,
              1.5,
              z - 2,
            ]);
        }
      }
      for (const dx of [-2.5, 2.5]) {
        box(x + dx, 3, z - 4.65, 1.7, 1.9, 0.12, "#a1844c");
        const photo = portraitAtlas.clone();
        photo.repeat.set(0.25, 0.25);
        const n = (index * 2 + (dx > 0 ? 1 : 0)) % 16;
        photo.offset.set((n % 4) * 0.25, 0.75 - Math.floor(n / 4) * 0.25);
        textures.add(photo);
        const portrait = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 1.7),
          new THREE.MeshBasicMaterial({ map: photo }),
        );
        portrait.position.set(x + dx, 3, z - 4.51);
        interiors.add(portrait);
      }
      // All annex roofs lift with the original castle; there is no upper floor.
      activeParent = upperCastle;
      box(x, 3.1, z - 4.8, 10, 3.6, 0.25, stone);
      for (const dx of [-5, 5]) box(x + dx, 3.1, z, 0.25, 3.6, 9.6, stone);

      for (const dx of [-3, 3])
        box(x + dx, 3.5, z - 4.96, 1, 1.8, 0.08, "#40504d");
      activeParent = interiors;
    }
    // Four attached ranges enclose a generous court. Hip roofs meet at the
    // corners; their ridges follow the wings instead of spanning an empty shed.
    activeParent = upperCastle;
    function hipRoof(
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number,
      turn = false,
    ) {
      const inset = Math.min(d * 0.48, w * 0.22);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            -w / 2,
            0,
            -d / 2,
            w / 2,
            0,
            -d / 2,
            w / 2,
            0,
            d / 2,
            -w / 2,
            0,
            d / 2,
            -w / 2 + inset,
            h,
            0,
            w / 2 - inset,
            h,
            0,
          ],
          3,
        ),
      );
      geo.setIndex([0, 4, 5, 0, 5, 1, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2]);
      // Keep the standard attribute layout for static batching, and separate
      // face normals so the hips have crisp edges rather than pillowed shading.
      geo.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(new Float32Array(12), 2),
      );
      const faces = geo.toNonIndexed();
      geo.dispose();
      faces.computeVertexNormals();
      if (turn) faces.rotateY(Math.PI / 2);
      return mesh(faces, roofColor, [x, y, z]);
    }
    // Two stone levels are exterior ornament only; all play stays on the ground.
    for (const z of [-1, -73]) {
      for (const side of [-1, 1]) {
        box(side * 25, 5.6, z, 36, 9.5, 0.5, stone);
        box(side * 25, 10.5, z, 36, 0.35, 0.85, trim);
        box(side * 25, 5.5, z, 36, 0.2, 0.75, trim);
      }
      if (z < -1) box(0, 5.6, z, 14, 9.5, 0.5, stone);
      for (let x = -39; x <= 39; x += 6) {
        if (z === -1 && x > -11 && x < 4) continue;
        for (const y of [3.3, 8]) windowAt(x, y, z + 0.3, 1.4, 2.3);
        box(x + 2.8, 5.6, z + 0.3, 0.5, 9.7, 0.6, trim);
      }
    }
    for (const x of [-43, 43]) {
      box(x, 5.6, -37, 0.5, 9.5, 72, stone);
      for (const y of [1.1, 5.5, 10.5]) box(x, y, -37, 0.8, 0.3, 72, trim);
      for (let z = -7; z >= -67; z -= 6) {
        box(x, 5.6, z + 2.8, 0.8, 9.5, 0.5, trim);
        for (const y of [3.3, 8]) {
          box(x, y, z, 0.65, 2.6, 1.7, trim);
          box(x + Math.sign(x) * 0.36, y, z, 0.1, 2.3, 1.4, "#293c38");
          box(x + Math.sign(x) * 0.43, y, z, 0.05, 0.09, 1.4, trim);
          box(x + Math.sign(x) * 0.43, y, z, 0.05, 2.3, 0.09, trim);
        }
      }
    }
    hipRoof(0, 10.7, -7, 87, 13, 4.4);
    hipRoof(0, 10.7, -19, 87, 13, 4.4);
    hipRoof(0, 10.7, -67, 87, 14, 4.8);
    for (const x of [-31, 31]) hipRoof(x, 10.7, -43, 36, 25, 6, true);
    // One dominant keep, balanced by smaller corner pavilions.
    box(-19, 12.3, -5, 8, 23, 8, stone);
    box(-19, 24, -5, 8.7, 0.6, 8.7, trim);
    hipRoof(-19, 24.3, -5, 9, 9, 5);
    for (const dx of [-3.8, 3.8])
      for (const dz of [-3.8, 3.8]) turret(-19 + dx, -5 + dz, 20, 5, 0.65);
    for (const y of [7.5, 12.5, 17.5, 21.5])
      for (const x of [-21, -17]) windowAt(x, y, -0.85, 1.25, 2.1);
    for (const x of [-41, 41])
      for (const z of [-3, -71]) {
        box(x, 7.6, z, 5.8, 13.5, 5.8, stone);
        box(x, 14.5, z, 6.2, 0.4, 6.2, trim);
        hipRoof(x, 14.7, z, 6.8, 6.8, 4.5);
        for (const y of [4.2, 9.7]) windowAt(x, y, z + 3, 1.4, 2.3);
        for (const dx of [-2.6, 2.6]) turret(x + dx, z + 2.6, 11.7, 3.5, 0.55);
      }
    // Repeated gabled bays and proper chimney stacks tie the whole frontage together.
    for (const x of [-32, -11, 11, 24, 34]) {
      box(x, 10.8, -1.5, 4.5, 3.6, 3, stone);
      roof(x, 12.7, -1.5, 5, 3.5, 2.7);
      for (let k = 0; k < 5; k++)
        for (const sign of [-1, 1])
          box(
            x + sign * (2.2 - k * 0.44),
            12.7 + k * 0.5,
            0.3,
            0.55,
            0.6,
            0.45,
            trim,
          );
      windowAt(x, 11.3, 0.1, 1.5, 1.8);
    }
    for (const x of [-32, -8, 16, 32])
      for (const z of [-9, -67]) {
        box(x, 15.8, z, 1.4, 3.3, 1.4, stone);
        box(x, 17.5, z, 1.8, 0.3, 1.8, trim);
        for (const dx of [-0.4, 0.4])
          mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.65, 6), "#796553", [
            x + dx,
            17.95,
            z,
          ]);
      }
    // Courtyard elevations enclose the open air, with a colonnade at walking level.
    for (const z of [-25, -60]) {
      box(0, 8, z, 37, 5, 0.4, stone);
      box(0, 10.5, z, 37, 0.3, 0.7, trim);
      for (let x = -16; x <= 16; x += 4) {
        box(x, 3.2, z, 0.45, 4.8, 0.6, trim);
        windowAt(x, 8, z + 0.3, 1.2, 1.9);
        const arch = mesh(
          new THREE.TorusGeometry(1.7, 0.16, 6, 16, Math.PI),
          trim,
          [x + 2, 4.6, z],
        );
        arch.rotation.z = 0;
      }
    }
    for (const x of [-18.5, 18.5]) {
      box(x, 8, -42.5, 0.4, 5, 35, stone);
      box(x, 10.5, -42.5, 0.7, 0.3, 35, trim);
      for (let z = -28; z >= -56; z -= 4) {
        box(x, 3.2, z, 0.6, 4.8, 0.45, trim);
        box(x, 8, z, 0.6, 2.1, 1.4, trim);
        box(x - Math.sign(x) * 0.35, 8, z, 0.08, 1.8, 1.1, "#293c38");
      }
    }
    activeParent = scene;
    box(0, 0.94, -42.5, 36, 0.16, 35, "#b2a58b");
    for (const x of [-11, 11])
      for (const z of [-32, -52]) {
        box(x, 1.05, z, 8, 0.2, 10, "#7e8560");
        for (const dx of [-4, 4])
          box(x + dx, 1.4, z, 0.5, 0.7, 10.5, "#456242");
        for (const dz of [-5, 5]) box(x, 1.4, z + dz, 8.5, 0.7, 0.5, "#456242");
        mesh(new THREE.SphereGeometry(1.3, 8, 6), "#587348", [x, 2.2, z]);
      }
    mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.55, 32), trim, [0, 1.2, -42]);
    mesh(
      new THREE.CylinderGeometry(2.25, 2.25, 0.04, 32),
      "#588e92",
      [0, 1.5, -42],
    );
    mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.5, 12), stone, [0, 2.2, -42]);
    mesh(new THREE.SphereGeometry(0.6, 12, 8), "#ae986d", [0, 3.2, -42]);
    for (const x of [-8, 8])
      for (const z of [-39, -45]) box(x, 1.4, z, 3, 0.45, 0.8, "#6b5b40");
    activeParent = interiors;
    // The broad front galleries tie the entrance rooms into the same footprint.
    for (const x of [-27, 27]) {
      box(x, 0.92, -5.5, 32, 0.04, 9, "#918571");
      box(x, 1.65, -1, 32, 1.5, 0.3, stone);
    }
    activeParent = interiors;
    // Hearth, candlesticks, a grandfather clock, and abandoned letters.
    box(-10.3, 1.8, -6.5, 1.4, 1.8, 0.5, "#635c4e");
    box(-10.3, 1.4, -6.2, 0.9, 0.8, 0.05, "#242924");
    const ember = mesh(
      new THREE.OctahedronGeometry(0.24),
      "#e3a057",
      [-10.3, 1.2, -6.1],
    );
    ember.material.emissive.set("#e37c30");
    ember.material.emissiveIntensity = 1;
    for (const z of [-5, -3.5]) {
      box(-8.4, 1.8, z, 0.07, 0.5, 0.07, "#d1bd88");
      mesh(new THREE.SphereGeometry(0.06, 6, 6), "#ffd790", [-8.4, 2.1, z]);
    }
    box(3.7, 1.95, -4.7, 0.55, 2, 0.45, "#564330");
    const clockFace = mesh(
      new THREE.CircleGeometry(0.21, 16),
      "#e0d2b3",
      [3.7, 2.55, -4.46],
    );
    box(3.7, 2.61, -4.43, 0.025, 0.14, 0.025, "#383d35");
    for (let i = 0; i < 4; i++)
      box(0.3 + i * 0.35, 1.62, -3.3, 0.3, 0.015, 0.4, "#cbbd93").rotation.y =
        i * 0.4;
    for (const [cx, cz] of [
      [-8.4, -6.3],
      [-4, -6.3],
      [1, -6.3],
      [6.5, -6.6],
      [7.2, -3.7],
    ]) {
      for (let n = 0; n < 4; n++)
        box(
          cx - 0.55 + n * 0.35,
          1.16,
          cz,
          0.28,
          0.3 + n * 0.04,
          0.4,
          ["#75816b", "#9d7458", "#787695"][n % 3],
        );
      mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.35, 10), "#ae986d", [
        cx + 0.8,
        1.3,
        cz,
      ]);
      for (let n = 0; n < 3; n++)
        box(
          cx + 0.7 + n * 0.08,
          1.7,
          cz,
          0.04,
          0.6,
          0.04,
          "#617d4b",
        ).rotation.z = (n - 1) * 0.25;
    }
    // Attic: trunks, rafters and a narrow entrance; vault: steel door and crates.
    for (const [x, z] of [
      [5.2, -6.5],
      [7.5, -6],
      [6, -5.3],
    ]) {
      box(x, 1.3, z, 0.9, 0.7, 0.7, "#7a603c");
      box(x, 1.3, z, 0.12, 0.74, 0.74, "#3f4637");
    }
    box(8.5, 1.75, -2.7, 0.2, 1.6, 1.6, "#717b71");
    const wheel = mesh(
      new THREE.TorusGeometry(0.3, 0.05, 6, 20),
      "#b2b4a0",
      [8.35, 1.8, -2.7],
    );
    wheel.rotation.y = Math.PI / 2;
    box(5.1, 1.3, -2, 1, 0.6, 0.8, "#6c725a");
    box(6.2, 1.25, -2.2, 0.7, 0.5, 0.7, "#8a7953");
    activeParent = scene;
    const upperMaterials = new Set<THREE.Material>();
    upperCastle.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((m) => {
          m.transparent = true;
          upperMaterials.add(m);
        });
      }
    });
    let openness = 0;

    // A broad terrace and curved staircase echo the show's entrance approach.
    for (let i = 0; i < 8; i++) {
      const r = 4.7 - i * 0.16,
        y = 0.02 + i * 0.1;
      const step = mesh(
        new THREE.CylinderGeometry(
          r,
          r,
          0.13,
          48,
          1,
          false,
          -Math.PI / 2,
          Math.PI,
        ),
        "#a1987f",
        [0, y, 5.4],
      );
      step.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 17; i++) {
      const a = (i / 16) * Math.PI;
      const x = Math.cos(a) * 4.8,
        z = 5.4 + Math.sin(a) * 4.8;
      box(x, 0.8, z, 0.14, 1, 0.14, trim);
    }
    const railPoints = Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * Math.PI;
      return new THREE.Vector3(
        Math.cos(a) * 4.8,
        1.35,
        5.4 + Math.sin(a) * 4.8,
      );
    });
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(railPoints),
        48,
        0.1,
        6,
        false,
      ),
      trim,
      [0, 0, 0],
    );
    for (const x of [-11.7, 11.7])
      for (let z = -5.8; z < 5.8; z += 0.65)
        box(x, 1.2, z, 0.14, 0.8, 0.14, trim);
    for (const x of [-11.7, 11.7]) box(x, 1.65, 0, 0.28, 0.18, 12, trim);
    box(0, -0.015, 13, 3, 0.1, 9, "#8d8d72");
    // Enlarge every garden object and authored route by the same transform.
    const gardenRoot = new THREE.Group();
    gardenRoot.scale.set(1.8, 1, 1.8);
    gardenRoot.position.z = -4;
    scene.add(gardenRoot);
    const beforeGardens = new Set(scene.children);
    // Formal hedges, lawn paths and a stream retain the eight game destinations.
    for (const x of [-10, -6, 6, 10]) box(x, 0.35, 9, 0.65, 0.8, 6, "#304a2a");
    for (const z of [6.2, 11.8]) {
      box(-8, 0.35, z, 4.5, 0.8, 0.65, "#304a2a");
      box(8, 0.35, z, 4.5, 0.8, 0.65, "#304a2a");
    }
    const stream = mesh(
      new THREE.PlaneGeometry(2, 32),
      "#365a52",
      [-14, -0.04, 2],
    );
    stream.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 10; i++)
      mesh(new THREE.DodecahedronGeometry(0.35, 0), "#687366", [
        -12.8,
        0.08,
        -9 + i * 2.7,
      ]);
    box(-14, 0.12, 4, 4, 0.2, 1.4, "#8e886e");
    // Service roofs lift away on arrival, leaving an actual treatment table and bed.
    const serviceRoofs = new Map<string, THREE.Group>();
    for (const [id, x, z] of [
      ["vet", 10, 12],
      ["nursery", 5, 13],
    ] as const) {
      box(x, 0.12, z, 3.4, 0.25, 2.8, "#7c8273");
      box(x, 0.65, z - 1.3, 3.4, 1.2, 0.15, stone);
      box(x - 1.6, 0.65, z, 0.15, 1.2, 2.8, stone);
      const shell = new THREE.Group();
      scene.add(shell);
      serviceRoofs.set(id, shell);
      activeParent = shell;
      roof(x, 1.65, z, 3.5, 3, 1.1);
      activeParent = scene;
    }
    box(10, 0.7, 12, 2.2, 0.35, 1.3, "#abc5ba");
    for (const x of [9.2, 10.8]) box(x, 0.35, 12, 0.12, 0.65, 0.9, "#637e73");
    box(11.2, 1.1, 11.3, 0.12, 1.6, 0.12, "#99b8af");
    box(11.2, 1.8, 11.3, 0.4, 0.5, 0.18, "#83ddc1");
    box(5, 0.45, 13, 2.4, 0.5, 1.9, "#53493f");
    box(5, 0.74, 13, 2.3, 0.18, 1.8, "#eee4ce");
    box(5, 0.9, 12.4, 1.7, 0.2, 0.4, "#f8efdf");
    const quiltGeo = new THREE.PlaneGeometry(2.4, 1.55, 20, 16);
    quiltGeo.rotateX(-Math.PI / 2);
    const quilt = mesh(quiltGeo, "#8c5664", [5, 0.92, 13.25]);
    quilt.material.side = THREE.DoubleSide;
    const quiltBase = Float32Array.from(quiltGeo.attributes.position.array);
    const hearts = Array.from({ length: 9 }, (_, i) =>
      label("♥", 5, 2, 13, 0.5 + i * 0.07),
    );
    const healCross = new THREE.Group();
    scene.add(healCross);
    box(0, 0, 0, 0.18, 0.65, 0.12, "#86e2bc", healCross);
    box(0, 0, 0, 0.6, 0.18, 0.12, "#86e2bc", healCross);
    // Distinct silhouettes make the specialist hiding places readable from the lawn.
    const cistern = mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.4, 24),
      "#426d71",
      [-10, 0.12, 14],
    );
    mesh(
      new THREE.TorusGeometry(1.3, 0.16, 6, 24),
      stone,
      [-10, 0.3, 14],
    ).rotation.x = Math.PI / 2;
    box(-10, 3.2, -7, 0.5, 6.4, 0.5, stone);
    mesh(new THREE.ConeGeometry(1.6, 0.6, 8), "#736349", [-10, 6.7, -7]);
    box(10, 2, -8, 0.35, 4, 0.35, stone);
    mesh(
      new THREE.CylinderGeometry(0.65, 0.9, 0.8, 12),
      "#b49b61",
      [10, 4, -8],
    );
    box(10, 2.2, -8, 0.05, 3.5, 0.05, "#b7aa8a");
    mesh(
      new THREE.SphereGeometry(0.9, 12, 8),
      "#30452e",
      [10, 0.1, 7],
    ).scale.set(1, 0.65, 1);
    mesh(new THREE.CircleGeometry(0.35, 16), "#111d1a", [10, 0.25, 7.8]);
    box(-9, 0.65, -8, 2, 1.2, 1.8, "#41443f");
    box(-9, 0.55, -7.08, 0.6, 0.9, 0.05, "#111916");
    label("TEMPERATURE 2.0", -8.4, 2, -3, 2.4);
    label("KV CACHE", 1, 1.8, -3, 1.5);
    label("CHECKPOINT CLINIC", 10, 2.7, 12, 2.8);
    label("FORK / MERGE", 5, 2.7, 13, 2.5);
    // Walled gardens: flower parterres, fountain, glasshouse and gravel paths.
    for (const [x, z] of [
      [-8, 10],
      [8, 8],
      [-5, 14],
    ]) {
      box(x, 0.08, z, 2.4, 0.16, 2, "#77694f");
      for (const dx of [-1.25, 1.25])
        box(x + dx, 0.18, z, 0.15, 0.25, 2.2, stone);
      for (const dz of [-1.05, 1.05])
        box(x, 0.18, z + dz, 2.6, 0.25, 0.15, stone);
    }
    const flowers = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      mat("#ffffff"),
      72,
    );
    const flowerDummy = new THREE.Object3D();
    for (let i = 0; i < 72; i++) {
      const [x, z] = [
        [-8, 10],
        [8, 8],
        [-5, 14],
      ][Math.floor(i / 24)];
      flowerDummy.position.set(
        x - 0.9 + (i % 6) * 0.36,
        0.38,
        z - 0.7 + (Math.floor(i / 6) % 4) * 0.45,
      );
      flowerDummy.updateMatrix();
      flowers.setMatrixAt(i, flowerDummy.matrix);
      flowers.setColorAt(
        i,
        new THREE.Color(["#ba6f81", "#dbba6a", "#9c93b9", "#d6ccb5"][i % 4]),
      );
    }
    scene.add(flowers);
    mesh(
      new THREE.CylinderGeometry(0.85, 1.05, 0.35, 24),
      stone,
      [-8, 0.2, 7.5],
    );
    mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.04, 24),
      "#719b98",
      [-8, 0.4, 7.5],
    );
    mesh(
      new THREE.CylinderGeometry(0.16, 0.25, 1.1, 12),
      stone,
      [-8, 0.85, 7.5],
    );
    mesh(new THREE.SphereGeometry(0.16, 12, 8), "#b6dbd2", [-8, 1.5, 7.5]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      mesh(new THREE.SphereGeometry(0.055, 6, 6), "#a7d2ca", [
        -8 + Math.cos(a) * 0.4,
        1.05,
        7.5 + Math.sin(a) * 0.4,
      ]);
    }
    box(-10.5, 0.1, 10.5, 2.2, 0.2, 2.8, stone);
    const glasshouse = box(-10.5, 1, 10.5, 2, 1.8, 2.6, "#92ada0");
    glasshouse.material.transparent = true;
    glasshouse.material.opacity = 0.23;
    glasshouse.material.depthWrite = false;
    for (const x of [-11.5, -9.5])
      for (const z of [9.2, 10.5, 11.8]) box(x, 1, z, 0.06, 2, 0.06, "#a1ac94");
    for (const z of [9.2, 11.8]) box(-10.5, 2, z, 2, 0.06, 0.06, "#a1ac94");
    for (let i = 0; i < 5; i++) {
      mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.22, 8), "#a87753", [
        -10.5,
        0.3,
        9.5 + i * 0.45,
      ]);
      mesh(new THREE.SphereGeometry(0.23, 6, 6), "#5c8051", [
        -10.5,
        0.6,
        9.5 + i * 0.45,
      ]);
    }
    box(-6, 0.03, 12.8, 6, 0.05, 0.55, "#9b967c");
    box(8, 0.03, 14.7, 7, 0.05, 0.55, "#9b967c");
    // Extended estate: a broad connected promenade and distinct garden districts.
    box(0, -0.05, 22, 48, 0.1, 27, "#4a6344");
    for (const x of [-23.8, 23.8]) box(x, 0.55, 22, 0.4, 1.2, 28, stone);
    box(0, 0.55, 35.8, 48, 1.2, 0.4, stone);
    const paths: Array<[number, number, number, number]> = [
      [0, 10, 0, 32],
      [-18, 19, 18, 19],
      [-18, 19, -18, 27],
      [14, 19, 14, 27],
      [-18, 13, -18, 19],
      [16, 13, 16, 19],
      [-18, 29, 0, 29],
      [0, 29, 14, 29],
      [-13, 24, -13, 29],
    ];
    for (const [x1, z1, x2, z2] of paths) {
      const path = box(
        (x1 + x2) / 2,
        0.035,
        (z1 + z2) / 2,
        1.4,
        0.06,
        Math.hypot(x2 - x1, z2 - z1),
        "#9b967e",
      );
      path.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    }
    const lake = mesh(
      new THREE.CircleGeometry(5.5, 48),
      "#477579",
      [-18, 0.08, 24],
    );
    lake.rotation.x = -Math.PI / 2;
    lake.scale.y = 0.75;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const lily = mesh(new THREE.CircleGeometry(0.24, 12), "#849461", [
        -18 + Math.cos(a) * 3,
        0.1,
        24 + Math.sin(a) * 2,
      ]);
      lily.rotation.x = -Math.PI / 2;
    }
    box(-13, 0.3, 27, 2, 0.3, 5, "#80694b");
    for (const x of [-14, -12]) box(x, 0.5, 29, 0.15, 1, 0.15, "#5b503b");
    box(-13, 0.7, 30, 3, 1.4, 2.5, stone);
    roof(-13, 1.4, 30, 3.4, 2.8, 1.2);
    const boat = mesh(
      new THREE.SphereGeometry(0.6, 10, 6),
      "#78513b",
      [-15, 0.2, 27],
    );
    boat.scale.set(0.6, 0.25, 2);
    // Extrude the actual OpenAI knot silhouette as clipped hedges.
    new SVGLoader().load("/openai-knot.svg", (data) => {
      if (disposed) return;
      const knot = new THREE.Group();
      for (const path of data.paths)
        for (const shape of SVGLoader.createShapes(path)) {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 1.7,
            bevelEnabled: false,
            curveSegments: 12,
          });
          const hedge = new THREE.Mesh(geometry, mat("#385638"));
          hedge.castShadow = true;
          hedge.receiveShadow = true;
          knot.add(hedge);
        }
      knot.rotation.x = -Math.PI / 2;
      knot.scale.set(0.64, 0.64, 0.64);
      knot.position.set(8.9, 0.15, 29.1);
      gardenRoot.add(knot);
    });
    for (let i = 0; i < 9; i++) {
      const x = 14 + (i % 3) * 2,
        z = 10 + Math.floor(i / 3) * 2;
      box(x, 1, z, 0.2, 2, 0.2, "#66553b");
      mesh(new THREE.IcosahedronGeometry(0.95, 1), "#526f3e", [x, 2, z]);
      for (let j = 0; j < 3; j++)
        mesh(new THREE.SphereGeometry(0.1, 6, 6), "#b9765f", [
          x + Math.sin(j * 2) * 0.7,
          2,
          z + Math.cos(j * 2) * 0.7,
        ]);
    }
    const greenhouse = box(-18, 1, 13, 3.5, 2, 4.5, "#9db9aa");
    greenhouse.material.transparent = true;
    greenhouse.material.opacity = 0.25;
    greenhouse.material.depthWrite = false;
    for (const x of [-19.75, -16.25])
      for (const z of [10.75, 13, 15.25])
        box(x, 1, z, 0.08, 2.2, 0.08, "#bdc2a6");
    box(-18, 0.3, 13, 2, 0.6, 3, "#765d40");
    for (let i = 0; i < 6; i++)
      mesh(new THREE.IcosahedronGeometry(0.25, 0), "#83a35c", [
        -18 + (i % 2) * 0.7 - 0.35,
        0.9,
        12 + Math.floor(i / 2),
      ]);
    mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.25, 8), stone, [0, 0.15, 31]);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      box(
        Math.cos(a) * 2.2,
        1.4,
        31 + Math.sin(a) * 2.2,
        0.14,
        2.6,
        0.14,
        "#b7b39a",
      );
    }
    mesh(new THREE.ConeGeometry(3, 1.4, 6), "#69776c", [0, 3, 31]);
    for (const x of [-6, 6])
      for (const z of [22, 27, 32]) {
        box(x, 0.5, z, 2, 0.15, 0.7, "#81745c");
        for (const dx of [-0.7, 0.7])
          box(x + dx, 0.25, z, 0.1, 0.5, 0.5, "#514f3f");
      }
    // Graveyard memorials link the retired residents to the dark-mode crypt.
    box(20, 0.05, 31, 7, 0.1, 8, "#4b574b");
    for (const x of [17, 23]) box(x, 0.4, 31, 0.2, 0.8, 8, "#737d70");
    for (let i = 0; i < 6; i++) {
      const x = 18 + (i % 3) * 1.7,
        z = 29 + Math.floor(i / 3) * 2;
      box(x, 0.6, z, 0.7, 1.2, 0.18, "#8a9385");
      mesh(new THREE.SphereGeometry(0.35, 8, 6), "#8a9385", [
        x,
        1.2,
        z,
      ]).scale.set(1, 0.5, 0.3);
      box(x, 0.85, z + 0.11, 0.35, 0.035, 0.015, "#49564c");
    }
    box(21, 0.9, 34, 2.2, 1.8, 2, stone);
    roof(21, 1.8, 34, 2.5, 2.3, 0.8);
    box(21, 0.7, 32.98, 0.7, 1.4, 0.03, "#162526");
    box(18, 0.035, 27.7, 7, 0.06, 1, "#9b967e");
    box(17, 0.035, 30, 1, 0.06, 5, "#9b967e");
    mesh(new THREE.CylinderGeometry(1.25, 1.5, 10, 12), "#ded9bd", [20, 5, 4]);
    mesh(
      new THREE.CylinderGeometry(1.65, 1.65, 0.25, 12),
      "#f0e9cd",
      [20, 10, 4],
    );
    mesh(new THREE.ConeGeometry(1.8, 2.2, 12), "#d4c8a2", [20, 11.3, 4]);
    for (const y of [2, 4.5, 7]) box(20, y, 5.5, 0.45, 1, 0.08, "#52616a");
    box(20, 0.035, 8, 1, 0.06, 7, "#9b967e");
    // Lanterns and warm ground pools share materials and batch with garden props.
    for (const x of [-13, 0, 14])
      for (const z of [16, 21, 26, 31]) {
        const lx = x + 1.5;
        box(lx, 0.65, z, 0.12, 1.3, 0.12, "#303b32");
        box(lx, 1.35, z, 0.35, 0.12, 0.35, "#ae986d");
        const glass = box(lx, 1.65, z, 0.28, 0.5, 0.28, "#ffd99a");
        glass.material.emissive.set("#ffcb77");
        glass.material.emissiveIntensity = 1.4;
        mesh(new THREE.ConeGeometry(0.3, 0.25, 4), "#303b32", [lx, 2.02, z]);
        const glow = mesh(new THREE.CircleGeometry(1.15, 16), "#a69a5d", [
          lx,
          0.018,
          z,
        ]);
        glow.rotation.x = -Math.PI / 2;
        glow.material.transparent = true;
        glow.material.opacity = 0.2;
        glow.material.depthWrite = false;
      }
    for (const [x, z] of [
      [-12, 18],
      [10, 15],
      [3, 30],
    ]) {
      const light = new THREE.PointLight("#ffe0a0", 18, 28, 2);
      light.position.set(x, 4.5, z);
      gardenRoot.add(light);
    }
    for (const child of [...scene.children]) {
      if (beforeGardens.has(child)) continue;
      if (
        child.position.z >= 5 ||
        (Math.abs(child.position.x) > 12 && child.position.z >= 0) ||
        child === flowers ||
        child === healCross ||
        [...serviceRoofs.values()].includes(child as THREE.Group)
      )
        gardenRoot.add(child);
    }
    // Cypress-lined grounds; instancing keeps the woodland inexpensive on phones.
    const treePositions: Array<[number, number, number]> = [];
    for (let i = 0; i < 80; i++) {
      const a = i * 2.399963,
        r = 78 + (i % 6) * 2.7;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r - 20;
      if (z > 10 || (z > 4 && x > 10)) continue;
      treePositions.push([x, 3.5 + (i % 4) * 0.8, z]);
    }
    for (const x of [-48, 48])
      for (let z = -9; z <= 3; z += 4) treePositions.push([x, 5.7, z]);
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.5, 7, 8),
      mat("#253f2b"),
      treePositions.length,
    );
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.3, 2, 6),
      mat("#3e4130"),
      treePositions.length,
    );
    const dummy = new THREE.Object3D();
    treePositions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(0.9, y / 4, 0.9);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.7, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
    });
    trees.castShadow = true;
    scene.add(trees, trunks);
    for (let i = 0; i < 9; i++) {
      const hill = mesh(new THREE.IcosahedronGeometry(12, 1), "#253b30", [
        -48 + i * 12,
        -1,
        -96 - (i % 2) * 10,
      ]);
      hill.scale.set(1.5, 0.55, 1);
    }
    // Amber torches mark the entrance and terrace, without illuminating secret rooms.
    for (const [x, z] of [
      [-6, 1],
      [-3, 1],
      [-4.8, 5.4],
      [4.8, 5.4],
    ]) {
      box(x, 1.25, z, 0.12, 1, 0.12, "#262e28");
      const flame = mesh(new THREE.OctahedronGeometry(0.2), "#ffc777", [
        x,
        1.9,
        z,
      ]);
      flame.scale.y = 1.6;
      flame.material.emissive.set("#ffa944");
      flame.material.emissiveIntensity = 2;
      const light = new THREE.PointLight("#ffb85e", 7, 5, 2);
      light.position.set(x, 2, z);
      scene.add(light);
    }
    // Batch static geometry per parent/material; keep animated cloth and instances separate.
    const parents: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.children.length) parents.push(o);
    });
    for (const parent of parents) {
      const batches = new Map<string, THREE.Mesh[]>();
      for (const child of [...parent.children]) {
        if (
          !(child instanceof THREE.Mesh) ||
          child instanceof THREE.InstancedMesh ||
          child === quilt ||
          child.children.length ||
          Array.isArray(child.material)
        )
          continue;
        const material = child.material as THREE.MeshStandardMaterial;
        if (material.map || (material.transparent && parent !== upperCastle))
          continue;
        const key = [
          material.type,
          material.color?.getHex(),
          material.emissive?.getHex(),
          material.emissiveIntensity,
          material.roughness,
          material.side,
          child.castShadow,
          child.receiveShadow,
        ].join(":");
        const list = batches.get(key) || [];
        list.push(child);
        batches.set(key, list);
      }
      for (const objects of batches.values()) {
        if (objects.length < 3) continue;
        const pieces = objects.map((o) => {
          o.updateMatrix();
          const g = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
          g.applyMatrix4(o.matrix);
          return g;
        });
        const merged = mergeGeometries(pieces);
        pieces.forEach((g) => g.dispose());
        if (!merged) continue;
        const combined = new THREE.Mesh(merged, objects[0].material);
        combined.castShadow = objects[0].castShadow;
        combined.receiveShadow = objects[0].receiveShadow;
        parent.add(combined);
        objects.forEach((o, i) => {
          parent.remove(o);
          o.geometry.dispose();
          if (i > 0) (o.material as THREE.Material).dispose();
        });
      }
    }
    upperMaterials.clear();
    upperCastle.traverse((o) => {
      if (o instanceof THREE.Mesh && !Array.isArray(o.material))
        upperMaterials.add(o.material);
    });
    label("BASE CAMP", POSITIONS.camp[0], 0.7, POSITIONS.camp[2], 2.5);

    const targets: THREE.Object3D[] = [];
    const halos = new Map<string, THREE.Mesh>();
    const markers = new Map<string, { marker: THREE.Mesh }>();
    LIVE_LOCATIONS.forEach((l, i) => {
      const [x, y, z] = POSITIONS[l.id];
      const marker = mesh(new THREE.SphereGeometry(1.15, 8, 6), "#edb866", [
        x,
        y + 0.35,
        z,
      ]);
      marker.material.transparent = true;
      marker.material.opacity = 0;
      marker.material.depthWrite = false;
      marker.userData.location = l.id;
      targets.push(marker);
      const halo = mesh(
        new THREE.TorusGeometry(0.46, 0.045, 6, 32),
        "#b1bdac",
        [x, y + 0.3, z],
      );
      halo.rotation.x = Math.PI / 2;
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 16),
        new THREE.MeshBasicMaterial({
          color: "#edf3dc",
          side: THREE.DoubleSide,
        }),
      );
      dot.position.z = 0.015;
      halo.add(dot);
      halos.set(l.id, halo);
      markers.set(l.id, { marker });
    });
    const petObjects = new Map<
      string,
      {
        object: THREE.Group;
        target: THREE.Vector3;
        image?: string;
        spriteRows?: 9 | 11;
        sprite?: THREE.Sprite;
        location: string;
        from: string;
        journey?: Journey;
        elapsed: number;
        floor: number;
        phase: number;
        stride: number;
        runBlend: number;
        effectStamp?: number;
        effectElapsed: number;
        rig?: THREE.Group;
        legs: THREE.Group[];
        wings: THREE.Mesh[];
        tag: THREE.Sprite;
        trail: THREE.Line;
      }
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
    let toddLocation: string | null = null,
      toddJourney: Journey | undefined,
      toddElapsed = 0;
    function disposeObject(object: THREE.Object3D) {
      object.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.Sprite ||
          child instanceof THREE.Line
        ) {
          if (!(child instanceof THREE.Sprite)) child.geometry.dispose();
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
    const atlasTextures = new Map<string, THREE.Texture>();
    function updatePets() {
      const pets = latest.current.pets;
      if (pets === previousPets) return;
      previousPets = pets;
      const currentIds = new Set(pets.map((p) => p.id));
      const byLocation = new Map<string, Pet[]>();
      for (const pet of pets) {
        const group = byLocation.get(pet.location) ?? [];
        group.push(pet);
        byLocation.set(pet.location, group);
      }
      for (const [id, p] of petObjects)
        if (!currentIds.has(id)) {
          disposeObject(p.object);
          disposeObject(p.trail);
          petObjects.delete(id);
        }
      pets.forEach((p, i) => {
        if (!p.image && pets.length > 40) {
          const art =
            CODEX_PETS.find((c) => c.species === p.species) ?? CODEX_PETS[0];
          p = { ...p, image: art.image, spriteRows: art.spriteRows };
        }
        const peers = byLocation.get(p.location)!;
        const end: Point = p.position
          ? [...p.position]
          : roomPoint(
              p.location,
              peers.findIndex((q) => q.id === p.id),
              peers.length,
            );
        // Fan a stationary crowd across the lawn; fade the visual spacing as
        // each pet leaves spawn. Server positions and room searches stay exact.
        if (p.position && pets.length > 20) {
          const spawn = roomPoint("camp");
          const spread = Math.max(
            0,
            1 -
              Math.hypot(p.position[0] - spawn[0], p.position[2] - spawn[2]) /
                5,
          );
          const radius = Math.sqrt(i) * 0.65 * spread;
          end[0] += Math.cos(i * 2.399963) * radius;
          end[2] += Math.sin(i * 2.399963) * radius;
        }
        let item = petObjects.get(p.id);
        const retained = item?.object.position.clone();
        if (
          item &&
          (item.image !== p.image || item.spriteRows !== p.spriteRows)
        ) {
          disposeObject(item.object);
          disposeObject(item.trail);
          petObjects.delete(p.id);
          item = undefined;
        }
        if (!item) {
          const group = new THREE.Group();
          scene.add(group);
          const tag = label(p.name, 0, 1.25, 0, 2.2);
          group.add(tag);
          const trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
              color: p.color,
              transparent: true,
              opacity: 0.4,
              depthWrite: false,
            }),
          );
          trail.visible = false;
          scene.add(trail);
          item = {
            object: group,
            target: new THREE.Vector3(...end),
            image: p.image,
            spriteRows: p.spriteRows,
            location: p.location,
            from: p.location,
            elapsed: 0,
            floor: ROOM_FLOORS[p.location] ?? 0,
            phase: 0,
            stride: 0,
            runBlend: 0,
            effectElapsed: 0,
            legs: [],
            wings: [],
            tag,
            trail,
          };
          petObjects.set(p.id, item);
          if (p.image) {
            let base = atlasTextures.get(p.image);
            if (!base) {
              base = new THREE.TextureLoader().load(p.image, (t) => {
                if (disposed) {
                  t.dispose();
                  return;
                }
                t.colorSpace = THREE.SRGBColorSpace;
                for (const tex of textures)
                  if (tex.source === t.source) tex.needsUpdate = true;
              });
              base.colorSpace = THREE.SRGBColorSpace;
              atlasTextures.set(p.image, base);
              textures.add(base);
            }
            const tex = base.clone();
            tex.needsUpdate = true;
            tex.colorSpace = THREE.SRGBColorSpace;
            if (p.spriteRows) {
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;
              tex.generateMipmaps = false;
              tex.repeat.set(1 / 8, 1 / p.spriteRows);
              tex.offset.set(0, 1 - 1 / p.spriteRows);
            }
            textures.add(tex);
            const sprite = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
              }),
            );
            sprite.scale.set(1.5, p.spriteRows ? 1.625 : 1.5, 1);
            item.sprite = sprite;
            group.add(sprite);
          } else {
            mesh(
              p.species === "robot"
                ? new THREE.BoxGeometry(0.7, 0.75, 0.6)
                : p.species === "ghost"
                  ? new THREE.ConeGeometry(0.45, 0.9, 8)
                  : new THREE.SphereGeometry(0.4, 10, 8),
              p.color,
              [0, 0, 0],
              group,
            );
            if (p.species === "dragon") {
              const tail = mesh(
                new THREE.ConeGeometry(0.18, 0.9, 5),
                p.color,
                [0, -0.1, -0.55],
                group,
              );
              tail.rotation.x = -Math.PI / 2;
              for (const x of [-0.55, 0.55]) {
                const wing = mesh(
                  new THREE.ConeGeometry(0.4, 0.6, 3),
                  "#b4c69b",
                  [x, 0.2, -0.1],
                  group,
                );
                wing.rotation.z = x > 0 ? -0.8 : 0.8;
                wing.userData.rest = wing.rotation.z;
                item.wings.push(wing);
              }
            }
            if (p.species === "frog")
              for (const x of [-0.28, 0.28]) {
                mesh(
                  new THREE.SphereGeometry(0.17, 8, 6),
                  p.color,
                  [x, 0.35, 0.1],
                  group,
                );
                mesh(
                  new THREE.SphereGeometry(0.08, 8, 6),
                  "#fff2d0",
                  [x, 0.4, 0.23],
                  group,
                );
              }
            if (p.species === "dog")
              for (const x of [-0.36, 0.36])
                mesh(
                  new THREE.CapsuleGeometry(0.12, 0.32, 3, 6),
                  "#806d55",
                  [x, 0.15, 0],
                  group,
                );
            if (p.species === "owl") {
              mesh(
                new THREE.SphereGeometry(0.29, 8, 6),
                "#e4dcc1",
                [0, 0.03, 0.22],
                group,
              );
              const beak = mesh(
                new THREE.ConeGeometry(0.08, 0.2, 4),
                "#d8ac64",
                [0, -0.02, 0.5],
                group,
              );
              beak.rotation.x = Math.PI / 2;
            }
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
              if (p.species === "owl") {
                const wing = mesh(
                  new THREE.SphereGeometry(0.25, 6, 4),
                  p.color,
                  [x * 2.7, -0.02, 0],
                  group,
                );
                wing.scale.set(1, 0.35, 1.6);
                wing.userData.rest = 0;
                item.wings.push(wing);
              }
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
          if (!p.image) {
            const rig = new THREE.Group();
            for (const child of [...group.children])
              if (child !== tag) rig.add(child);
            group.add(rig);
            item.rig = rig;
            if (p.species !== "ghost") {
              const feet =
                p.species === "robot" || p.species === "owl"
                  ? [
                      [-0.22, 0],
                      [0.22, 0],
                    ]
                  : [
                      [-0.23, 0.24],
                      [0.23, 0.24],
                      [-0.23, -0.24],
                      [0.23, -0.24],
                    ];
              feet.forEach(([x, z], index) => {
                const leg = new THREE.Group();
                leg.position.set(x, -0.22, z);
                rig.add(leg);
                mesh(
                  new THREE.CapsuleGeometry(
                    p.species === "frog" ? 0.13 : 0.09,
                    0.25,
                    2,
                    5,
                  ),
                  p.species === "owl" ? "#c99648" : p.color,
                  [0, -0.16, 0.03],
                  leg,
                );
                leg.userData.phase = index === 0 || index === 3 ? 0 : Math.PI;
                item!.legs.push(leg);
              });
            }
          }
          const effect = new THREE.Group();
          effect.name = "effect";
          group.add(effect);
          const bottle = new THREE.Group();
          bottle.name = "bottle";
          effect.add(bottle);
          mesh(
            new THREE.CylinderGeometry(0.13, 0.16, 0.5, 8),
            "#70915a",
            [0.55, 0.55, 0],
            bottle,
          );
          mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8),
            "#c9ab70",
            [0.55, 0.9, 0],
            bottle,
          );
          const resetButton = new THREE.Group();
          resetButton.name = "reset";
          effect.add(resetButton);
          box(0.6, 0.35, 0, 0.65, 0.16, 0.65, "#555f59", resetButton);
          mesh(
            new THREE.CylinderGeometry(0.23, 0.23, 0.17, 16),
            "#e4755b",
            [0.6, 0.5, 0],
            resetButton,
          );
          group.position.copy(retained || new THREE.Vector3(...end));
        }
        if (p.position) {
          item.journey = undefined;
          item.location = p.location;
        } else if (item.location !== p.location) {
          item.from = item.location;
          item.journey = planJourney(
            item.location,
            p.location,
            item.object.position.toArray() as Point,
            end,
            (p as Pet & { stats?: { speed: number } }).stats?.speed ?? 4,
            item.floor,
          );
          item.elapsed = 0;
          item.location = p.location;
          item.trail.geometry.dispose();
          item.trail.geometry = new THREE.BufferGeometry().setFromPoints(
            item.journey.points.map((v) => new THREE.Vector3(...v)),
          );
        }
        item.target.fromArray(end);
        if (item.effectStamp !== p.effect?.at) {
          item.effectStamp = p.effect?.at;
          item.effectElapsed = 0;
        }
        const stats = (p as Pet & { stats?: { smallness: number } }).stats;
        const petScale =
          (p.baby ? 0.8 : 1.25) * (stats ? 1.25 - stats.smallness * 0.065 : 1);
        item.object.scale.setScalar(petScale);
        item.object.userData.offset = i;
        item.object.userData.pet = p;
      });
    }
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let hovered: string | undefined;
    const onHover = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      hovered = ray.intersectObjects(targets.filter((t) => t.visible))[0]
        ?.object.userData.location;
      setHoverId(hovered || null);
      renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    };
    const onLeave = () => {
      hovered = undefined;
      setHoverId(null);
    };
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
      const hit = ray.intersectObjects(targets.filter((t) => t.visible))[0];
      if (hit) latest.current.onSelect(hit.object.userData.location);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("pointermove", onHover);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const aspect = w / h;
      const height = Math.max(38, 45 / aspect);
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
    let previousFloor = 0;
    let lastTime = 0,
      frame = 0,
      lastClothActive = false,
      animationTime = 0,
      renderCost = 0,
      motionSignature = "",
      followedFloor: number | null = null;
    const beforePosition = new THREE.Vector3(),
      screenRight = new THREE.Vector3();
    renderer.setAnimationLoop((time) => {
      const dt = Math.min(
        0.05,
        Math.max(0.001, (time - lastTime) / 1000 || 1 / 60),
      );
      lastTime = time;
      frame++;

      if (document.hidden) return;
      const renderStarted = performance.now();
      const step = latest.current.paused ? 0 : dt;
      animationTime += step;
      updatePets();
      const open =
        insideRef.current ||
        latest.current.pets.some(
          (p) =>
            p.location in INTERIORS ||
            (p.position && p.position[2] < 0 && Math.abs(p.position[0]) < 44),
        ) ||
        [...petObjects.values()].some(
          (p) => p.journey && p.from in INTERIORS,
        ) ||
        !!(latest.current.todd && latest.current.todd in INTERIORS);
      const targetOpen = open ? 1 : 0;
      openness = media.matches
        ? targetOpen
        : THREE.MathUtils.lerp(openness, targetOpen, 1 - Math.exp(-5 * dt));
      if (Math.abs(openness - targetOpen) < 0.002) openness = targetOpen;
      upperCastle.position.y = openness * 7;
      upperCastle.visible = openness < 0.995;
      upperMaterials.forEach((m) => {
        m.opacity = 1 - openness;
        m.depthWrite = openness < 0.1;
      });
      const visibleFloor = floorRef.current;
      if (previousFloor !== visibleFloor) {
        const current = storeys.get(visibleFloor);
        if (current) current.position.y = media.matches ? 0 : 0.5;
        previousFloor = visibleFloor;
      }
      for (const group of storeys.values())
        group.position.y = THREE.MathUtils.lerp(
          group.position.y,
          0,
          media.matches ? 1 : 1 - Math.exp(-8 * dt),
        );
      interiors.visible = openness > 0.05 && visibleFloor === 0;
      for (const [level, group] of storeys)
        group.visible = openness > 0.05 && visibleFloor === level;
      renderer.domElement.dataset.floor = String(visibleFloor);
      renderer.domElement.dataset.cutaway = open ? "open" : "closed";
      for (const [id, point] of markers) {
        const base = POSITIONS[id],
          inner = INTERIORS[id] || base;
        const x = THREE.MathUtils.lerp(base[0], inner[0], openness),
          y = THREE.MathUtils.lerp(base[1], inner[1], openness),
          z = THREE.MathUtils.lerp(base[2], inner[2], openness);
        const floorVisible =
          !(id in INTERIORS) ||
          (!open
            ? !(id in ROOM_FLOORS)
            : (ROOM_FLOORS[id] || 0) === visibleFloor);
        point.marker.visible = floorVisible;
        halos.get(id)!.visible = floorVisible;

        point.marker.position.set(x, y + 0.35, z);

        halos.get(id)!.position.set(x, y + 0.3, z);
      }
      const t = animationTime;
      for (const actor of petObjects.values())
        if (!actor.journey) actor.effectElapsed += step;
      const activeEffect = (kind: string, location: string) =>
        [...petObjects.values()].some(
          (actor) =>
            !actor.journey &&
            actor.location === location &&
            actor.effectElapsed < 16 &&
            (actor.object.userData.pet as Pet).effect?.kind === kind,
        );
      const matingActors = [...petObjects.values()].filter(
        (actor) =>
          actor.location === "nursery" &&
          (actor.object.userData.pet as Pet).effect?.kind === "breed",
      );
      const breeding =
        matingActors.length === 2 &&
        matingActors.every((actor) => !actor.journey);
      const treating = activeEffect("vet", "vet");
      for (const [id, roofGroup] of serviceRoofs) {
        const occupied = latest.current.pets.some((p) => p.location === id);
        roofGroup.position.y = media.matches
          ? occupied
            ? 4
            : 0
          : THREE.MathUtils.lerp(
              roofGroup.position.y,
              occupied ? 4 : 0,
              1 - Math.exp(-6 * dt),
            );
        roofGroup.visible = roofGroup.position.y < 3.9;
      }
      hearts.forEach((h, i) => {
        h.visible = breeding;
        const phase = ((t * 0.55 + i * 0.4) % 2) / 2;
        h.material.opacity = media.matches ? 1 : Math.sin(phase * Math.PI);
        h.position.set(
          5 + Math.sin(i * 2) * 0.8,
          2.4 + (media.matches ? i * 0.2 : (t * 0.7 + i * 0.32) % 2.8),
          13 + Math.cos(i) * 0.4,
        );
        h.material.rotation = media.matches ? 0 : Math.sin(t + i) * 0.15;
      });
      healCross.visible = treating;
      healCross.position.set(
        10,
        2 + (media.matches ? 0 : Math.sin(t * 2) * 0.3),
        12,
      );
      healCross.lookAt(camera.position);
      // A floating, billowing canopy conceals the pair while hearts rise above it.
      const duvetY = breeding
        ? 2.05 + (media.matches ? 0 : Math.sin(t * 3) * 0.16)
        : 0.92;
      quilt.position.y = THREE.MathUtils.lerp(
        quilt.position.y,
        duvetY,
        media.matches ? 1 : 1 - Math.exp(-8 * dt),
      );
      const cloth = quiltGeo.attributes.position;
      if (breeding || lastClothActive) {
        for (let i = 0; i < cloth.count; i++)
          cloth.setY(
            i,
            quiltBase[i * 3 + 1] +
              (breeding && !media.matches
                ? Math.sin(cloth.getX(i) * 3 + t * 3) *
                  Math.cos(cloth.getZ(i) * 3 + t) *
                  0.34
                : 0),
          );
        cloth.needsUpdate = true;
        if (frame % 3 === 0 || !breeding) quiltGeo.computeVertexNormals();
      }
      lastClothActive = breeding;
      renderer.domElement.dataset.activity = breeding
        ? "breeding"
        : treating
          ? "vet"
          : "seeking";
      const travel: Travel[] = [];
      let realTimeMoving = 0;
      screenRight.setFromMatrixColumn(camera.matrixWorld, 0);
      let followFloor: number | null = null;
      for (const [id, p] of petObjects) {
        const pet = p.object.userData.pet as Pet;
        beforePosition.copy(p.object.position);
        let moving = false;
        if (pet.bannedAt && p.object.userData.bannedAt !== pet.bannedAt) {
          p.object.position.copy(p.target);
          p.object.userData.bannedAt = pet.bannedAt;
        }
        if (p.sprite)
          p.sprite.material.color.set(pet.bannedAt ? "#969b95" : "#ffffff");
        if (pet.position) {
          moving = !!pet.moving && !latest.current.paused;
          if (moving) realTimeMoving++;
          if (step > 0)
            p.object.position.lerp(
              p.target,
              media.matches ? 1 : 1 - Math.exp(-18 * step),
            );
          p.floor = 0;
        } else if (p.journey) {
          p.elapsed = media.matches ? p.journey.duration : p.elapsed + step;
          const sample = sampleJourney(p.journey, p.elapsed);
          p.object.position.fromArray(sample.position);
          p.floor = sample.floor;
          moving = sample.moving;
          if (moving)
            travel.push({
              id,
              name: pet.name,
              from: p.from,
              to: p.location,
              mode: p.journey.mode,
            });
          if (!latest.current.selectedPet || latest.current.selectedPet === id)
            followFloor ??= p.floor;
          if (!moving) p.journey = undefined;
        } else if (step > 0)
          p.object.position.lerp(
            p.target,
            media.matches ? 1 : 1 - Math.exp(-5 * step),
          );
        const direction =
          (p.object.position.x - beforePosition.x) * screenRight.x +
          (p.object.position.z - beforePosition.z) * screenRight.z;
        if (p.sprite && Math.abs(direction) > 0.0001)
          p.sprite.userData.right = direction >= 0;
        p.phase += media.matches ? 0 : step;
        if (p.sprite && pet.spriteRows) {
          const uv = spriteFrame(
            pet.spriteRows,
            moving,
            p.sprite.userData.right !== false,
            p.phase,
          );
          p.sprite.material.map!.offset.set(uv.x, uv.y);
        }
        if (p.sprite)
          p.sprite.position.y =
            media.matches || pet.spriteRows
              ? 0
              : Math.abs(Math.sin(p.phase * (moving ? 12 : 3))) *
                (moving ? 0.1 : 0.025);
        const onVisibleFloor =
          (!(pet.location in INTERIORS) && !p.journey) ||
          p.floor === visibleFloor;
        // Exterior portions of a trip remain visible while inspecting any floor.
        const outside =
          p.object.position.z > 0.8 ||
          Math.abs(p.object.position.x) > 11 ||
          p.object.position.y > 12;
        const age = p.effectElapsed * 1000;
        p.object.visible =
          (onVisibleFloor || outside) &&
          !(
            breeding &&
            !moving &&
            pet.location === "nursery" &&
            (pet.baby || age > 2500)
          );
        p.tag.visible =
          latest.current.selectedPet === id ||
          (latest.current.pets.length <= 40 && moving);
        p.trail.visible =
          moving &&
          p.object.visible &&
          (latest.current.selectedPet === id || !latest.current.selectedPet);
        p.object.rotation.z =
          pet.tipsy && !media.matches
            ? Math.sin(t * 3 + p.object.userData.offset) * 0.23
            : 0;
        if (!p.sprite && moving && !media.matches)
          p.object.rotation.z += Math.sin(p.phase * 13) * 0.04;
        const effect = p.object.getObjectByName("effect")!;
        effect.getObjectByName("bottle")!.visible =
          pet.effect?.kind === "bottle" && age < 16000 && !moving;
        effect.getObjectByName("reset")!.visible =
          pet.effect?.kind === "reset" && age < 16000 && !moving;
        const travelled = p.object.position.distanceTo(beforePosition);
        p.stride += media.matches ? 0 : travelled * 7;
        const velocity = step > 0 ? travelled / step : 0;
        const targetBlend = moving ? Math.min(1, velocity / 2) : 0;
        p.runBlend = media.matches
          ? 0
          : THREE.MathUtils.lerp(
              p.runBlend,
              targetBlend,
              1 - Math.exp(-12 * step),
            );
        if (p.rig) {
          const flying = moving && p.journey?.mode === "fly";
          const swimming =
            moving &&
            p.journey?.mode === "swim" &&
            ["lake", "moat", "cistern", "floodedcellar"].includes(p.location) &&
            p.object.position.distanceTo(p.target) < 3;
          const hop = Math.abs(Math.sin(p.stride));
          p.rig.position.y = media.matches
            ? 0
            : flying
              ? Math.sin(p.phase * 7) * 0.07
              : swimming
                ? Math.sin(p.phase * 5) * 0.035
                : hop *
                  p.runBlend *
                  (pet.species === "bunny" || pet.species === "frog"
                    ? 0.23
                    : 0.1);
          p.rig.rotation.x = swimming ? -0.22 : -0.07 * p.runBlend;
          for (const leg of p.legs)
            leg.rotation.x = media.matches
              ? 0
              : Math.sin(p.stride + leg.userData.phase) * 0.75 * p.runBlend;
          p.wings.forEach((wing, i) => {
            wing.rotation.z =
              wing.userData.rest +
              (media.matches
                ? 0
                : Math.sin(p.phase * (flying ? 10 : 3)) *
                  (flying ? 0.65 : 0.08) *
                  (i % 2 ? 1 : -1));
          });
          if (travelled > 0.0001 && moving) {
            const yaw = Math.atan2(
              p.object.position.x - beforePosition.x,
              p.object.position.z - beforePosition.z,
            );
            const turn = Math.atan2(
              Math.sin(yaw - p.object.rotation.y),
              Math.cos(yaw - p.object.rotation.y),
            );
            p.object.rotation.y +=
              turn * (media.matches ? 1 : 1 - Math.exp(-10 * step));
          }
        }
      }
      if (followFloor !== null && followFloor !== followedFloor) {
        followedFloor = followFloor;
        floorRef.current = followFloor;
      }
      if (!travel.length) followedFloor = null;
      const signature = travel.map((p) => p.id + ":" + p.to).join("|");
      if (signature !== motionSignature) {
        motionSignature = signature;
        latest.current.onTravelChange?.(travel);
      }
      renderer.domElement.dataset.moving = String(
        travel.length + realTimeMoving,
      );
      renderer.domElement.dataset.paused = String(!!latest.current.paused);
      if (frame % 15 === 0)
        renderer.domElement.dataset.actors = JSON.stringify(
          [...petObjects].map(([id, p]) => ({
            id,
            location: p.location,
            x: +p.object.position.x.toFixed(2),
            y: +p.object.position.y.toFixed(2),
            z: +p.object.position.z.toFixed(2),
            floor: p.floor,
            visible: p.object.visible,
            stride: +p.stride.toFixed(2),
          })),
        );
      if (followRef.current) {
        const actor =
          petObjects.get(latest.current.selectedPet || travel[0]?.id || "") ||
          petObjects.values().next().value;
        if (actor) {
          const delta = actor.object.position
            .clone()
            .sub(controls.target)
            .multiplyScalar(media.matches ? 1 : 1 - Math.exp(-4 * dt));
          controls.target.add(delta);
          camera.position.add(delta);
          camera.zoom = THREE.MathUtils.lerp(
            camera.zoom,
            2.2,
            1 - Math.exp(-3 * dt),
          );
          camera.updateProjectionMatrix();
        }
      }
      for (const [id, halo] of halos) {
        halo.visible =
          !(id in INTERIORS) ||
          (!open
            ? !(id in ROOM_FLOORS)
            : (ROOM_FLOORS[id] || 0) === visibleFloor);
        halo.scale.setScalar(
          id === latest.current.selected || id === hovered ? 1.4 : 1,
        );
        (halo.material as THREE.Material).transparent = true;
        (halo.material as THREE.Material).opacity =
          id === latest.current.selected || id === hovered ? 1 : 0.8;
        (halo.material as THREE.MeshStandardMaterial).color.set(
          latest.current.allowed && !latest.current.allowed.includes(id)
            ? "#bb7d7b"
            : "#d8e5cf",
        );
      }
      const reveal = latest.current.todd;
      if (reveal && reveal !== toddLocation) {
        if (toddLocation)
          toddJourney = planJourney(
            toddLocation,
            reveal,
            todd.position.toArray() as Point,
            roomPoint(reveal),
            5,
          );
        else todd.position.fromArray(roomPoint(reveal));
        toddLocation = reveal;
        toddElapsed = 0;
      }
      if (!reveal) {
        toddLocation = null;
        toddJourney = undefined;
      }
      let toddFloor = reveal ? (ROOM_FLOORS[reveal] ?? 0) : 0;
      if (toddJourney) {
        toddElapsed = media.matches ? toddJourney.duration : toddElapsed + step;
        const sample = sampleJourney(toddJourney, toddElapsed);
        todd.position.fromArray(sample.position);
        toddFloor = sample.floor;
        if (!sample.moving) toddJourney = undefined;
      }
      todd.visible =
        !!reveal &&
        (!(reveal in INTERIORS) ||
          toddFloor === visibleFloor ||
          todd.position.z > 0.8 ||
          todd.position.y > 12);
      todd.lookAt(camera.position);
      controls.dampingFactor = 1 - Math.exp(-6 * dt);
      controls.update();
      renderer.render(scene, camera);
      renderCost =
        renderCost * 0.95 + (performance.now() - renderStarted) * 0.05;
      if (frame % 15 === 0)
        renderer.domElement.dataset.renderCpuMs = renderCost.toFixed(2);
      renderer.domElement.dataset.drawCalls = String(
        renderer.info.render.calls,
      );
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onHover);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeObject(scene);
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [simple, failed]);
  return (
    <div className="world-shell">
      <div ref={mount} className="castle-world" hidden={failed || simple} />
      {(failed || simple) && (
        <div className="world-fallback">
          <span>♜</span>
          <h2>The castle is still open.</h2>
          <p>
            {failed
              ? "This device could not start 3D."
              : "Simple view saves battery."}{" "}
            All rooms and actions remain available in the side controls.
          </p>
        </div>
      )}
      <div className="world-caption">
        <span>CASTLE GROUNDS</span>
        <small>
          {failed || simple
            ? "Accessible room view"
            : "Drag to orbit · pinch or scroll to zoom"}
        </small>
      </div>
      {hoverPlace && hoverId && (
        <div
          className={`glass world-hover ${hoverId ? "is-hovering" : ""}`}
          role="status"
        >
          <strong>{hoverPlace.name}</strong>
          <small>
            {hoverGate?.label ||
              (hoverGate
                ? `${STAT_LABELS[hoverGate.stat]} ${hoverGate.min}+`
                : "Open to every pet")}
            {props.allowed && !props.allowed.includes(hoverPlace.id)
              ? " · Your pet cannot enter"
              : ""}
          </small>
          <p>{hoverPlace.subtitle}</p>
        </div>
      )}
      <div className="camera-controls">
        {!(failed || simple) && (
          <>
            <button
              aria-pressed={inside || autoInside}
              disabled={autoInside}
              title={autoInside ? "A pet is inside the castle" : ""}
              onClick={() => setInside(!inside)}
            >
              {autoInside
                ? "Inside · auto"
                : inside
                  ? "Close roof"
                  : "Look inside"}
            </button>
          </>
        )}
        <details className="camera-more glass">
          <summary aria-label="Camera options" title="Camera options">
            ···
          </summary>
          {!(failed || simple) && (
            <div>
              {" "}
              <button onClick={() => zoom.current(1.15)} aria-label="Zoom in">
                +
              </button>
              <button
                onClick={() => zoom.current(1 / 1.15)}
                aria-label="Zoom out"
              >
                −
              </button>
              <button aria-pressed={follow} onClick={() => setFollow(!follow)}>
                {follow ? "Stop following" : "Follow pet"}
              </button>
              <button
                onClick={() => {
                  setFollow(false);
                  reset.current();
                }}
              >
                Reset view
              </button>
            </div>
          )}
          <button
            onClick={() => {
              if (failed || simple) {
                setFailed(false);
                setSimple(false);
              } else setSimple(true);
            }}
          >
            {failed || simple ? "Show 3D" : "Simple view"}
          </button>
        </details>
      </div>
    </div>
  );
}
