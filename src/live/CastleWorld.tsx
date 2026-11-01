import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { renderToStaticMarkup } from "react-dom/server";
import type { Pet } from "../pets";
import PetAvatar from "../PetAvatar";
import { GATES, STAT_LABELS, LIVE_LOCATIONS } from "./shared";
import {
  INTERIORS,
  POSITIONS,
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
const ROOM_FLOORS: Record<string, number> = {
  ballroom: 1,
  dormitory: 1,
  observatory: 1,
  chapel: 2,
  serverloft: 2,
  eyrie: 2,
  coldstorage: -1,
  floodedcellar: -1,
  drain: -1,
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
  const [floor, setFloor] = useState(0);
  const floorRef = useRef(0);
  floorRef.current = floor;
  const previousLocations = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const p of props.pets)
      if (
        previousLocations.current[p.id] !== p.location &&
        p.location in ROOM_FLOORS
      )
        setFloor(ROOM_FLOORS[p.location]);
    previousLocations.current = Object.fromEntries(
      props.pets.map((p) => [p.id, p.location]),
    );
  }, [props.pets]);
  useEffect(() => {
    if (props.selected && props.selected in INTERIORS) {
      setFloor(ROOM_FLOORS[props.selected] || 0);
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
    props.pets.some((p) => p.location in INTERIORS) ||
    !!(props.todd && props.todd in INTERIORS);
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
    scene.fog = new THREE.Fog("#152421", 40, 85);
    const camera = new THREE.OrthographicCamera(-19, 19, 15, -15, 0.1, 100);
    camera.position.set(27, 32, 48);
    camera.zoom = 1.1;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.5, 9);
    controls.enablePan = true;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.2;
    controls.minZoom = 0.65;
    controls.maxZoom = 3.5;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    reset.current = () => {
      camera.position.set(27, 32, 48);
      camera.zoom = 1.1;
      camera.updateProjectionMatrix();
      controls.target.set(0, 2.5, 9);
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
      canvas.width = 512;
      canvas.height = 96;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#e5d9b7";
      c.beginPath();
      c.roundRect(4, 4, 504, 84, 28);
      if (text !== "♥") c.fill();
      c.fillStyle = text === "♥" ? "#efa0b7" : "#26392f";
      c.font = "600 32px monospace";
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
    // Original procedural model inspired by Ardross Castle's exterior, not a
    // survey or a floor plan: a long baronial façade, square tower, and terrace.
    mesh(
      new THREE.PlaneGeometry(160, 160),
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
    upperCastle.scale.y = 1.45;
    activeParent = upperCastle;
    // The west block and main hall share one continuous sandstone frontage.
    box(-1, 3.4, -4.3, 20, 5.2, 6.5, stone);
    roof(-1, 6, -4.3, 20.4, 6.9, 2.3);
    box(7.2, 4, -6.2, 5.5, 6.4, 7.5, stone);
    roof(7.2, 7.2, -6.2, 5.8, 7.9, 2.5);
    // Tall, square entrance tower with a steep hipped cap and corner bartizans.
    box(-4.5, 5.1, -2.9, 3.5, 8.6, 4.2, stone);
    box(-4.5, 9.25, -2.9, 4, 0.4, 4.7, trim);
    roof(-4.5, 9.5, -2.9, 3.5, 4.5, 2.4);
    for (const x of [-6.25, -2.75])
      for (const z of [-5, -0.8]) turret(x, z, 8.4, 1.8, 0.28);
    turret(-10.8, -1.1, 0.8, 6.6, 0.55);
    turret(-1.4, -1.1, 0.8, 6.8, 0.5);
    turret(9.7, -2.2, 1, 6.4, 0.43);
    // Main entrance arch, portico, and tall paired windows.
    box(-4.5, 1.75, -0.7, 1.25, 2, 0.2, "#292922");
    const arch = mesh(
      new THREE.TorusGeometry(0.68, 0.18, 8, 24, Math.PI),
      trim,
      [-4.5, 2.65, -0.53],
    );
    arch.rotation.z = 0;
    for (const x of [-5.4, -3.6]) box(x, 1.65, -0.35, 0.3, 1.8, 0.6, trim);
    box(-4.5, 2.8, -0.1, 2.4, 0.23, 1.6, trim);
    for (const y of [4.1, 6.2, 8]) windowAt(-4.5, y, -0.72, 0.68, 1.2);
    for (const x of [-9.3, -7.7, -0.2, 1.3, 3, 5, 7.9])
      for (const y of [2.15, 3.9, 5.4]) windowAt(x, y, -0.98);
    // Projecting bay windows and crow-stepped gables along the east wing.
    for (const x of [3.5, 8]) {
      mesh(new THREE.CylinderGeometry(1.25, 1.25, 4.8, 5), stone, [
        x,
        3.2,
        -0.7,
      ]).rotation.y = Math.PI / 5;
      windowAt(x, 2.1, 0.42, 0.9, 1.4);
      windowAt(x, 4.15, 0.42, 0.9, 1.4);
      mesh(new THREE.ConeGeometry(1.6, 1.6, 5), roofColor, [
        x,
        6.4,
        -0.7,
      ]).rotation.y = Math.PI / 5;
      for (let i = 0; i < 4; i++)
        for (const sign of [-1, 1])
          box(
            x + sign * (1.5 - i * 0.38),
            5.5 + i * 0.45,
            -0.1,
            0.4,
            0.5,
            0.4,
            trim,
          );
    }
    // Dormers and clustered stone chimney pots break up the slate roofline.
    for (const x of [-8, -0.1, 2.2, 5.8, 8.7]) {
      box(x, 6.6, -2.4, 0.9, 1.3, 0.7, stone);
      roof(x, 7.25, -2.4, 1.1, 1.1, 0.8);
      windowAt(x, 6.55, -1.98, 0.4, 0.7);
    }
    for (const [x, z] of [
      [-9, -5.5],
      [-7, -6],
      [-0.5, -6.3],
      [2, -6.3],
      [5, -8],
      [9, -8],
    ]) {
      box(x, 8.2, z, 0.6, 2.1, 0.8, stone);
      box(x, 9.3, z, 0.8, 0.2, 1, trim);
      for (const dx of [-0.2, 0.2])
        mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 6), "#6c6758", [
          x + dx,
          9.6,
          z,
        ]);
    }
    const interiors = new THREE.Group();
    scene.add(interiors);
    interiors.visible = false;
    activeParent = interiors;
    // Low walls and door gaps keep every interior readable in the cutaway.
    box(-1, 0.88, -4.3, 20, 0.14, 6.5, "#756d57");
    box(-1, 1.6, -7.5, 20, 1.4, 0.25, stone);
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
    box(-8.4, 1.5, -4.1, 1.5, 0.15, 3.1, "#62442e");
    for (const x of [-9.6, -7.2])
      for (const z of [-5.2, -4, -2.8]) {
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
    box(1, 1.5, -3.4, 1.8, 0.15, 0.9, "#63503a");
    box(1, 1.61, -3.4, 0.65, 0.05, 0.4, "#d7caa5");
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
      const [x, py, pz] = portraitWalls[i];
      box(x, py, pz, 1.35, 1.55, 0.15, "#a1844c");
      const isTibo = i === 5; // Right-hand tavern frame, clear of the sideboard.
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
        new THREE.PlaneGeometry(1.15, isTibo ? 1.15 : 1.35),
        new THREE.MeshBasicMaterial({ map: photo }),
      );
      frame.name = isTibo
        ? "Tibo — Keeper of the Reset"
        : `Pet ancestor ${ancestorIndex + 1}`;
      frame.position.set(x, py + (isTibo ? 0.1 : 0), pz + 0.09);
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
          new THREE.PlaneGeometry(1.15, 0.22),
          new THREE.MeshBasicMaterial({ map: plaqueTexture }),
        );
        plaque.position.set(x, py - 0.6, pz + 0.09);
        interiors.add(plaque);
        // Tibo's one-charge reset lives below his portrait. Searching the tavern
        // activates it through the authoritative room server, like other finds.
        box(x, 1.45, pz + 0.25, 0.9, 0.65, 0.3, "#454e48");
        box(x, 1.45, pz + 0.42, 0.72, 0.49, 0.08, "#ae965c");
        const button = mesh(
          new THREE.CylinderGeometry(0.24, 0.28, 0.16, 20),
          "#df493c",
          [x, 1.45, pz + 0.55],
        );
        button.rotation.x = Math.PI / 2;
        button.material.emissive.set("#6b1008");
        button.material.emissiveIntensity = 0.35;
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
          new THREE.PlaneGeometry(0.72, 0.18),
          new THREE.MeshBasicMaterial({ map: resetTexture }),
        );
        resetPlaque.position.set(x, 1, pz + 0.42);
        interiors.add(resetPlaque);
      }
    }
    const storeys = new Map<number, THREE.Group>();
    for (const level of [-1, 1, 2]) {
      const group = new THREE.Group();
      scene.add(group);
      storeys.set(level, group);
      activeParent = group;
      const y = 0.9 + Math.max(0, level) * 3.5;
      box(0, y - 0.15, -4, 21, 0.25, 7, level === -1 ? "#303b42" : "#817465");
      box(0, y + 0.7, -7.5, 21, 1.4, 0.2, stone);
      for (const x of [-10.5, -3.5, 3.5, 10.5])
        box(x, y + 0.6, -4, 0.2, 1.2, 7, stone);
      for (let i = 0; i < 3; i++) {
        const x = -7 + i * 7;
        box(
          x,
          y + 0.02,
          -4,
          4.5,
          0.04,
          4,
          level === -1 ? "#283d42" : level === 1 ? "#775358" : "#666b4f",
        );
        if (level === 1 && i === 1) {
          box(x, y + 0.45, -4, 2.2, 0.6, 3, "#554139");
          box(x, y + 0.8, -4, 2, 0.2, 2.7, "#a29bba");
          for (const dx of [-1, 1])
            for (const dz of [-1.4, 1.4])
              box(x + dx, y + 1.4, -4 + dz, 0.1, 2.8, 0.1, "#554139");
        } else if (level === 2 && i === 1) {
          for (const dx of [-1.5, 0, 1.5]) {
            box(x + dx, y + 1, -5, 1, 2, 0.7, "#35494c");
            for (let k = 0; k < 4; k++)
              box(x + dx, y + 0.3 + k * 0.4, -4.62, 0.7, 0.08, 0.02, "#8ec6ad");
          }
        } else if (level === -1 && i === 1) {
          box(x, y + 0.05, -4, 5, 0.1, 5, "#35545e");
          for (let k = 0; k < 4; k++)
            mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), "#879b9f", [
              x - 2 + k * 1.2,
              y + 0.3,
              -6,
            ]);
        } else {
          box(x, y + 0.5, -4, 1.8, 0.2, 1, "#6e5945");
          mesh(
            new THREE.IcosahedronGeometry(0.35, 1),
            level === -1 ? "#729ea9" : "#c1b08a",
            [x, y + 0.95, -4],
          );
        }
        const lamp = mesh(
          new THREE.SphereGeometry(0.1, 8, 6),
          level === -1 ? "#90b2d7" : "#f6d59a",
          [x, y + 1.6, -6.6],
        );
        lamp.material.emissive.set(level === -1 ? "#5e7cbe" : "#db9848");
        lamp.material.emissiveIntensity = 1;
        const photo = portraitAtlas.clone();
        photo.repeat.set(0.25, 0.25);
        const index = (level + 1) * 3 + i;
        photo.offset.set(
          (index % 4) * 0.25,
          0.75 - Math.floor(index / 4) * 0.25,
        );
        textures.add(photo);
        box(x, y + 2, -7.3, 1.4, 1.5, 0.15, "#a1844c");
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.3),
          new THREE.MeshBasicMaterial({ map: photo }),
        );
        frame.position.set(x, y + 2, -7.2);
        group.add(frame);
      }
      for (let j = 0; j < 10; j++)
        box(-9 + j * 0.25, y + j * 0.1, -1.3, 0.4, 0.12, 1, trim);
      group.visible = false;
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
    const hearts = Array.from({ length: 5 }, (_, i) =>
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
      scene.add(knot);
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
    // Cypress-lined grounds; instancing keeps the woodland inexpensive on phones.
    const treePositions: Array<[number, number, number]> = [];
    for (let i = 0; i < 80; i++) {
      const a = i * 2.399963,
        r = 18 + (i % 6) * 1.7;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r - 4;
      if (z > 10 || (z > 4 && x > 10)) continue;
      treePositions.push([x, 3.5 + (i % 4) * 0.8, z]);
    }
    for (const x of [-17, 17])
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
        -35 - (i % 2) * 10,
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
    label("BASE CAMP", -3, 0.7, 12, 2.5);

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
    type Actor = {
      object: THREE.Group;
      target: THREE.Vector3;
      location: string;
      journey?: Journey;
      elapsed: number;
      from: string;
      sprite: THREE.Sprite;
      trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      tag: THREE.Sprite;
      ring: THREE.Mesh;
      phase: number;
      art?: string;
    };
    const petObjects = new Map<string, Actor>();
    const todd = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.7, 20, 16), "#171b23", [0, 0, 0], todd);
    for (const x of [-0.22, 0.22])
      mesh(
        new THREE.SphereGeometry(0.095, 8, 8),
        "#ffffff",
        [x, 0.1, 0.64],
        todd,
      );
    const toddTag = label("TODD · MISALIGNED", 0, 1.3, 0, 3.6);
    todd.add(toddTag);
    scene.add(todd);
    todd.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        for (const material of Array.isArray(child.material)
          ? child.material
          : [child.material])
          material.depthTest = false;
        child.renderOrder = 14;
      }
    });
    todd.visible = false;
    let toddLocation: string | null = null,
      toddJourney: Journey | undefined,
      toddElapsed = 0;
    let previousPets: Pet[] | null = null;
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
      object.removeFromParent();
    }
    function makeActor(p: Pet, point: Point): Actor {
      const group = new THREE.Group();
      scene.add(group);
      group.position.fromArray(point);
      // Uploaded Codex atlases and ordinary images use the same billboard.
      // The original illustrated avatar is the fallback, so pet identity stays readable.
      const source =
        p.image ||
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(<PetAvatar pet={p} />))}`;
      const tex = new THREE.TextureLoader().load(source, (t) => {
        if (disposed || !group.parent) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        if (!p.spriteRows) {
          const ratio = t.image.width / t.image.height;
          sprite.scale.set(
            2.3 * Math.min(1, ratio),
            2.3 * Math.min(1, 1 / ratio),
            1,
          );
        }
      });
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
          depthTest: false,
        }),
      );
      sprite.scale.set(2.15, 2.33, 1);
      sprite.renderOrder = 15;
      group.add(sprite);
      const tag = label(p.name.toUpperCase(), 0, 1.6, 0, 2.6);
      group.add(tag);
      const ring = mesh(
        new THREE.TorusGeometry(0.65, 0.055, 6, 28),
        "#f1ce83",
        [0, -0.78, 0],
        group,
      );
      ring.rotation.x = Math.PI / 2;
      const trail = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.6,
          depthTest: false,
        }),
      );
      trail.renderOrder = 7;
      scene.add(trail);
      // Preserve existing service/trap effects on the new sprite actor.
      const effect = new THREE.Group();
      effect.name = "effect";
      group.add(effect);
      const bottle = new THREE.Group();
      bottle.name = "bottle";
      effect.add(bottle);
      mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.5, 8),
        "#70915a",
        [0.85, 0.55, 0],
        bottle,
      );
      mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8),
        "#c9ab70",
        [0.85, 0.9, 0],
        bottle,
      );
      const resetButton = new THREE.Group();
      resetButton.name = "reset";
      effect.add(resetButton);
      box(0.85, 0.35, 0, 0.65, 0.16, 0.65, "#555f59", resetButton);
      mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.17, 16),
        "#e4755b",
        [0.85, 0.5, 0],
        resetButton,
      );
      return {
        object: group,
        target: new THREE.Vector3(...point),
        location: p.location,
        from: p.location,
        elapsed: 0,
        sprite,
        tag,
        ring,
        trail,
        phase: 0,
        art: p.image,
      };
    }
    function updatePets() {
      const pets = latest.current.pets;
      if (pets === previousPets) return;
      previousPets = pets;
      for (const [id, actor] of petObjects)
        if (!pets.some((p) => p.id === id)) {
          disposeObject(actor.object);
          disposeObject(actor.trail);
          petObjects.delete(id);
        }
      pets.forEach((p, i) => {
        const peers = pets.filter((q) => q.location === p.location);
        const end = roomPoint(
          p.location,
          peers.findIndex((q) => q.id === p.id),
          peers.length,
        );
        let item = petObjects.get(p.id);
        if (item && item.art !== p.image) {
          disposeObject(item.object);
          disposeObject(item.trail);
          petObjects.delete(p.id);
          item = undefined;
        }
        if (!item) {
          item = makeActor(p, end);
          petObjects.set(p.id, item);
        }
        if (item.location !== p.location) {
          item.from = item.location;
          item.journey = planJourney(
            item.location,
            p.location,
            item.object.position.toArray() as Point,
            end,
            (p as Pet & { stats?: { speed: number } }).stats?.speed ?? 4,
          );
          item.elapsed = 0;
          item.location = p.location;
          item.trail.geometry.dispose();
          item.trail.geometry = new THREE.BufferGeometry().setFromPoints(
            item.journey.points.map((v) => new THREE.Vector3(...v)),
          );
        }
        item.target.fromArray(end);
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
      const height = Math.max(22, 28 / aspect);
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
      lastClothActive = false;
    let motionSignature = "initial",
      animationTime = 0;
    renderer.setAnimationLoop((time) => {
      const dt = Math.min(
        0.05,
        Math.max(0.001, (time - lastTime) / 1000 || 1 / 60),
      );
      lastTime = time;
      frame++;

      if (document.hidden) return;
      const step = latest.current.paused ? 0 : dt;
      animationTime += step;
      updatePets();
      const open =
        insideRef.current ||
        latest.current.pets.some((p) => p.location in INTERIORS) ||
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
      const now = Date.now();
      const breeding = latest.current.pets.some(
        (p) =>
          p.effect?.kind === "breed" &&
          now - p.effect.at < 16000 &&
          p.location === "nursery",
      );
      const treating = latest.current.pets.some(
        (p) =>
          p.effect?.kind === "vet" &&
          now - p.effect.at < 16000 &&
          p.location === "vet",
      );
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
          1.5 + (media.matches ? i * 0.35 : (t * 0.55 + i * 0.4) % 2),
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
      const cloth = quiltGeo.attributes.position;
      if (breeding || lastClothActive) {
        for (let i = 0; i < cloth.count; i++)
          cloth.setY(
            i,
            quiltBase[i * 3 + 1] +
              (breeding && !media.matches
                ? Math.sin(cloth.getX(i) * 3 + t * 3) *
                  Math.cos(cloth.getZ(i) * 3 + t) *
                  0.12
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
      const screenRight = new THREE.Vector3().setFromMatrixColumn(
        camera.matrixWorld,
        0,
      );
      for (const [id, p] of petObjects) {
        const pet = p.object.userData.pet as Pet;
        let moving = false;
        const before = p.object.position.clone();
        if (p.journey) {
          p.elapsed = media.matches ? p.journey.duration : p.elapsed + step;
          const sample = sampleJourney(p.journey, p.elapsed);
          p.object.position.fromArray(sample.position);
          moving = sample.moving;
          if (moving)
            travel.push({
              id,
              name: pet.name,
              from: p.from,
              to: p.location,
              mode: p.journey.mode,
            });
          else p.journey = undefined;
        } else {
          // Peer spacing adjusts locally; it must not restart a completed trip.
          p.object.position.lerp(
            p.target,
            media.matches ? 1 : 1 - Math.exp(-5 * step),
          );
        }
        p.trail.visible = moving;
        const direction = p.object.position
          .clone()
          .sub(before)
          .dot(screenRight);
        if (Math.abs(direction) > 0.0001)
          p.sprite.userData.right = direction >= 0;
        p.phase += media.matches ? 0 : step;
        if (pet.spriteRows) {
          const uv = spriteFrame(
            pet.spriteRows,
            moving,
            p.sprite.userData.right !== false,
            p.phase,
          );
          p.sprite.material.map!.offset.set(uv.x, uv.y);
        }
        const gait = moving
          ? Math.sin(p.phase * (p.journey?.mode === "fly" ? 7 : 15))
          : Math.sin(t * 2 + p.object.userData.offset);
        p.sprite.position.y =
          media.matches || pet.spriteRows
            ? 0
            : Math.abs(gait) * (moving ? 0.16 : 0.035);
        p.sprite.material.rotation =
          pet.tipsy && !media.matches ? Math.sin(t * 3) * 0.2 : 0;
        p.tag.visible = moving || latest.current.selectedPet === id;
        p.ring.visible = moving || latest.current.selectedPet === id;
        const age = now - (pet.effect?.at || 0);
        p.object.visible =
          (moving ||
            !(pet.location in INTERIORS) ||
            (ROOM_FLOORS[pet.location] || 0) === visibleFloor) &&
          !(breeding && pet.location === "nursery" && (pet.baby || age > 2500));
        const effect = p.object.getObjectByName("effect")!;
        effect.getObjectByName("bottle")!.visible =
          pet.effect?.kind === "bottle" && age < 16000;
        effect.getObjectByName("reset")!.visible =
          pet.effect?.kind === "reset" && age < 16000;
        effect.rotation.y = Math.atan2(
          camera.position.x - p.object.position.x,
          camera.position.z - p.object.position.z,
        );
      }
      const signature = travel.map((p) => `${p.id}:${p.to}`).join("|");
      if (signature !== motionSignature) {
        motionSignature = signature;
        latest.current.onTravelChange?.(travel);
      }
      renderer.domElement.dataset.movingPets = String(travel.length);
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
      const reveal = latest.current.todd || null;
      todd.visible =
        !!reveal &&
        (!(reveal in INTERIORS) || (ROOM_FLOORS[reveal] || 0) === visibleFloor);
      if (reveal) {
        const end = roomPoint(reveal);
        if (!toddLocation) todd.position.fromArray(end);
        else if (reveal !== toddLocation) {
          toddJourney = planJourney(
            toddLocation,
            reveal,
            todd.position.toArray() as Point,
            end,
            7,
          );
          toddElapsed = 0;
        }
        toddLocation = reveal;
        if (toddJourney) {
          toddElapsed = media.matches
            ? toddJourney.duration
            : toddElapsed + step;
          const sample = sampleJourney(toddJourney, toddElapsed);
          todd.position.fromArray(sample.position);
          if (!sample.moving) toddJourney = undefined;
        }
        todd.lookAt(
          new THREE.Vector3(
            camera.position.x,
            todd.position.y,
            camera.position.z,
          ),
        );
        renderer.domElement.dataset.toddMoving = String(!!toddJourney);
      } else {
        toddLocation = null;
        toddJourney = undefined;
        renderer.domElement.dataset.toddMoving = "false";
      }
      controls.dampingFactor = 1 - Math.exp(-6 * dt);
      controls.update();
      renderer.render(scene, camera);
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
      {hoverPlace && (
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
          <small>Click the light ring to select · Rooms lists all places</small>
        </div>
      )}
      <div className="floor-controls glass" aria-label="Castle floors">
        <button
          aria-label="Previous floor"
          title="Previous floor"
          onClick={() => {
            setFloor(((floor + 4) % 4) - 1);
            setInside(true);
          }}
        >
          ↓
        </button>
        <select
          aria-label="View floor"
          value={floor}
          onChange={(e) => {
            setFloor(Number(e.target.value));
            setInside(true);
          }}
        >
          <option value={-1}>Cellars</option>
          <option value={0}>Ground floor</option>
          <option value={1}>First floor</option>
          <option value={2}>Second floor</option>
        </select>
        <button
          aria-label="Next floor"
          title="Next floor"
          onClick={() => {
            setFloor(((floor + 2) % 4) - 1);
            setInside(true);
          }}
        >
          ↑
        </button>
      </div>
      <div className="camera-controls">
        {!(failed || simple) && (
          <>
            <button onClick={() => zoom.current(1.15)} aria-label="Zoom in">
              +
            </button>
            <button
              onClick={() => zoom.current(1 / 1.15)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button onClick={() => reset.current()}>Reset view</button>
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
      </div>
    </div>
  );
}
