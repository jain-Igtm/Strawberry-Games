(() => {
  'use strict';

  const THREE = window.THREE;
  if (!THREE) {
    document.body.innerHTML = '<div style="padding:24px;color:white;background:#111;font-family:monospace">Three.js failed to load. Refresh the page.</div>';
    return;
  }

  const ui = {
    start: document.getElementById('startOverlay'),
    startBtn: document.getElementById('startBtn'),
    status: document.getElementById('status'),
    location: document.getElementById('locationName'),
    joystick: document.getElementById('joystick'),
    stick: document.getElementById('stick'),
    lookPad: document.getElementById('lookPad'),
    sprint: document.getElementById('sprintBtn'),
    crosshair: document.getElementById('crosshair'),
  };

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('touch', isTouch);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030506);
  scene.fog = new THREE.FogExp2(0x050708, 0.019);

  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 180);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.domElement.id = 'world';
  document.body.prepend(renderer.domElement);

  const clock = new THREE.Clock();
  const keys = Object.create(null);
  const colliders = [];
  const porchLights = [];
  const flickerLights = [];
  const animated = [];

  const player = {
    position: new THREE.Vector3(0, 1.72, 31),
    yaw: Math.PI,
    pitch: -0.02,
    radius: 0.48,
    speed: 4.4,
    sprint: 7.2,
    bob: 0,
    moving: false,
  };

  camera.position.copy(player.position);
  camera.rotation.set(player.pitch, player.yaw, 0);

  const palette = {
    timber: 0x4a3424,
    darkTimber: 0x2a211a,
    porch: 0x644831,
    roof: 0x211d19,
    trim: 0x9f8a6b,
    window: 0x9db7ae,
    warm: 0xffc46c,
    grass: 0x1c291b,
    dirt: 0x3a2e23,
    fence: 0x6c5138,
  };

  const mats = {
    grass: new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 1 }),
    dirt: new THREE.MeshStandardMaterial({ color: palette.dirt, roughness: 1 }),
    timber: new THREE.MeshStandardMaterial({ color: palette.timber, roughness: 0.95 }),
    darkTimber: new THREE.MeshStandardMaterial({ color: palette.darkTimber, roughness: 1 }),
    porch: new THREE.MeshStandardMaterial({ color: palette.porch, roughness: 0.98 }),
    roof: new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: palette.window, emissive: 0x243b34, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.05 }),
    litGlass: new THREE.MeshStandardMaterial({ color: 0xffd89a, emissive: 0xff9d3b, emissiveIntensity: 1.25, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x090a09, roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x423b34, roughness: 0.65, metalness: 0.65 }),
    red: new THREE.MeshStandardMaterial({ color: 0x6e3027, roughness: 0.95 }),
    church: new THREE.MeshStandardMaterial({ color: 0x48534e, roughness: 0.95 }),
    barn: new THREE.MeshStandardMaterial({ color: 0x6a482b, roughness: 0.96 }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xffd27d, emissive: 0xffa33e, emissiveIntensity: 2.2 }),
  };

  function box(w, h, d, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  function cylinder(rTop, rBottom, h, segments, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function makeWoodTexture(base = '#5c422e', plank = '#2b1d14') {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 24) {
      g.fillStyle = x % 48 === 0 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.045)';
      g.fillRect(x, 0, 22, 256);
      g.fillStyle = plank;
      g.globalAlpha = 0.45;
      g.fillRect(x + 22, 0, 2, 256);
      g.globalAlpha = 1;
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(20,12,8,${Math.random() * 0.14})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 28 + 3, 1);
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1.5);
    return texture;
  }

  const wallTex = makeWoodTexture();
  const darkWallTex = makeWoodTexture('#352a22', '#16110d');
  const redWallTex = makeWoodTexture('#74382e', '#321512');
  const churchWallTex = makeWoodTexture('#53605b', '#26302c');
  const barnWallTex = makeWoodTexture('#735037', '#342316');
  const wallMaterials = {
    timber: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.98 }),
    dark: new THREE.MeshStandardMaterial({ map: darkWallTex, roughness: 1 }),
    red: new THREE.MeshStandardMaterial({ map: redWallTex, roughness: 0.98 }),
    church: new THREE.MeshStandardMaterial({ map: churchWallTex, roughness: 0.98 }),
    barn: new THREE.MeshStandardMaterial({ map: barnWallTex, roughness: 0.98 }),
  };

  function signMaterial(text, bg = '#372518', fg = '#d7bc82', border = '#8a6744') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = border;
    g.lineWidth = 10;
    g.strokeRect(8, 8, c.width - 16, c.height - 16);
    g.fillStyle = fg;
    g.font = '700 54px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  }

  function addCollider(x, z, w, d, padding = 0) {
    colliders.push({
      minX: x - w / 2 - padding,
      maxX: x + w / 2 + padding,
      minZ: z - d / 2 - padding,
      maxZ: z + d / 2 + padding,
    });
  }

  function makeWindow(lit = false) {
    const group = new THREE.Group();
    const frame = box(1.35, 1.8, 0.12, mats.trim, 0, 0, 0);
    const pane = box(1.05, 1.48, 0.135, lit ? mats.litGlass : mats.glass, 0, 0, 0.01, false, false);
    group.add(frame, pane);
    const mullionV = box(0.08, 1.48, 0.15, mats.darkTimber, 0, 0, 0.02);
    const mullionH = box(1.05, 0.08, 0.15, mats.darkTimber, 0, 0, 0.02);
    group.add(mullionV, mullionH);
    return group;
  }

  function makeDoor(colorMat = mats.darkTimber, width = 1.35, height = 2.45) {
    const group = new THREE.Group();
    group.add(box(width + 0.18, height + 0.18, 0.15, mats.trim, 0, 0, 0));
    group.add(box(width, height, 0.18, colorMat, 0, 0, 0.03));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.metal);
    knob.position.set(width * 0.33, 0, 0.16);
    knob.castShadow = true;
    group.add(knob);
    return group;
  }

  function addLantern(parent, x, y, z, strength = 5.5, distance = 10) {
    const bracket = box(0.08, 0.55, 0.08, mats.metal, x, y + 0.16, z);
    parent.add(bracket);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), mats.lantern);
    bulb.position.set(x, y - 0.08, z + 0.02);
    parent.add(bulb);
    const p = new THREE.PointLight(0xffb65f, strength, distance, 1.75);
    p.position.copy(bulb.position);
    p.castShadow = false;
    parent.add(p);
    porchLights.push(p);
    flickerLights.push({ light: p, base: strength, phase: Math.random() * Math.PI * 2 });
  }

  function addGableRoof(group, width, depth, wallHeight, roofRise = 1.4, material = mats.roof) {
    const half = Math.sqrt((width / 2 + 0.35) ** 2 + roofRise ** 2);
    const angle = Math.atan2(roofRise, width / 2 + 0.35);
    const left = box(half, 0.22, depth + 0.65, material, -width * 0.25, wallHeight + roofRise * 0.5, 0);
    left.rotation.z = angle;
    const right = box(half, 0.22, depth + 0.65, material, width * 0.25, wallHeight + roofRise * 0.5, 0);
    right.rotation.z = -angle;
    group.add(left, right);
  }

  function addPorch(group, width, depth, wallHeight, options = {}) {
    const porchDepth = options.depth || 2.2;
    const floor = box(width + 0.6, 0.22, porchDepth, mats.porch, 0, 0.38, depth / 2 + porchDepth / 2 - 0.15);
    group.add(floor);

    const awning = box(width + 0.5, 0.18, porchDepth + 0.3, mats.roof, 0, wallHeight - 0.15, depth / 2 + porchDepth / 2 - 0.15);
    awning.rotation.x = -0.035;
    group.add(awning);

    const postXs = [-width / 2 + 0.35, width / 2 - 0.35];
    if (width > 7) postXs.splice(1, 0, 0);
    for (const px of postXs) {
      group.add(box(0.18, wallHeight - 0.35, 0.18, mats.trim, px, wallHeight / 2 + 0.2, depth / 2 + porchDepth - 0.35));
    }

    if (options.rail !== false) {
      const z = depth / 2 + porchDepth - 0.3;
      group.add(box(width - 0.9, 0.12, 0.12, mats.trim, 0, 1.15, z));
      for (let x = -width / 2 + 0.75; x <= width / 2 - 0.75; x += 0.72) {
        if (Math.abs(x) < 0.9) continue;
        group.add(box(0.09, 0.8, 0.09, mats.trim, x, 0.78, z));
      }
    }

    return porchDepth;
  }

  function makeWesternBuilding(opts) {
    const {
      x, z, width = 8, depth = 6.5, height = 4.2, facing = 0,
      label = '', wall = 'timber', litWindows = true, falseFront = true,
      porch = true, rail = true, roofRise = 1.25, doorOffset = 0,
    } = opts;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    scene.add(group);

    const wallMat = wallMaterials[wall] || wallMaterials.timber;
    const body = box(width, height, depth, wallMat, 0, height / 2, 0);
    group.add(body);

    addGableRoof(group, width, depth, height, roofRise, mats.roof);

    let facadeHeight = height;
    if (falseFront) {
      facadeHeight = height + 1.25;
      group.add(box(width + 0.18, facadeHeight, 0.36, wallMat, 0, facadeHeight / 2, depth / 2 + 0.05));
      group.add(box(width + 0.55, 0.22, 0.52, mats.trim, 0, facadeHeight + 0.02, depth / 2 + 0.05));
    }

    const porchDepth = porch ? addPorch(group, width, depth, height, { rail }) : 0;

    const door = makeDoor(mats.darkTimber);
    door.position.set(doorOffset, 1.64, depth / 2 + 0.25);
    group.add(door);

    const windowOffsets = width > 8 ? [-width * 0.31, width * 0.31] : [-width * 0.28, width * 0.28];
    for (let i = 0; i < windowOffsets.length; i++) {
      if (Math.abs(windowOffsets[i] - doorOffset) < 1.4) continue;
      const win = makeWindow(litWindows && i % 2 === 0);
      win.position.set(windowOffsets[i], 2.0, depth / 2 + 0.26);
      group.add(win);
    }

    if (label) {
      const sign = box(Math.min(width * 0.78, 7), 0.78, 0.12, signMaterial(label), 0, falseFront ? height + 0.46 : height - 0.45, depth / 2 + 0.31, false, false);
      group.add(sign);
    }

    if (porch) {
      addLantern(group, -width * 0.28, height - 0.75, depth / 2 + porchDepth - 0.38, 4.6, 9);
      addLantern(group, width * 0.28, height - 0.75, depth / 2 + porchDepth - 0.38, 4.6, 9);
    }

    const rotQuarter = Math.abs(Math.sin(facing)) > 0.5;
    addCollider(x, z, rotQuarter ? depth : width, rotQuarter ? width : depth, 0.25);
    return group;
  }

  function makeChurch(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const width = 7.6, depth = 10.2, height = 5.0;
    group.add(box(width, height, depth, wallMaterials.church, 0, height / 2, 0));
    addGableRoof(group, width, depth, height, 2.25, mats.roof);

    const porchDepth = addPorch(group, 5.3, depth, 3.7, { depth: 1.65, rail: true });
    const door = makeDoor(mats.darkTimber, 1.55, 2.65);
    door.position.set(0, 1.72, depth / 2 + 0.25);
    group.add(door);

    const left = makeWindow(true);
    left.position.set(-2.35, 2.35, depth / 2 + 0.25);
    left.scale.set(0.82, 1.15, 0.82);
    const right = left.clone();
    right.position.x = 2.35;
    group.add(left, right);

    const tower = box(2.45, 3.0, 2.45, wallMaterials.church, 0, height + 1.5, 0.7);
    group.add(tower);
    addGableRoof(group, 2.65, 2.8, height + 3.0, 1.15, mats.roof);
    const crossV = box(0.16, 1.85, 0.16, mats.trim, 0, height + 5.05, 0.7);
    const crossH = box(0.95, 0.16, 0.16, mats.trim, 0, height + 5.25, 0.7);
    group.add(crossV, crossH);

    addLantern(group, -1.5, 3.25, depth / 2 + porchDepth - 0.2, 7.5, 13);
    addLantern(group, 1.5, 3.25, depth / 2 + porchDepth - 0.2, 7.5, 13);
    addCollider(x, z, width, depth, 0.35);
    return group;
  }

  function makeBarn(x, z) {
    const barn = makeWesternBuilding({
      x, z, width: 11.8, depth: 9.2, height: 5.4, facing: 0,
      label: 'BARN', wall: 'barn', falseFront: false, porch: true, rail: true, roofRise: 2.0,
    });
    const loft = makeWindow(false);
    loft.scale.set(1.15, 0.75, 1);
    loft.position.set(0, 4.25, 9.2 / 2 + 0.27);
    barn.add(loft);
    return barn;
  }

  function makeRedShed(x, z) {
    return makeWesternBuilding({
      x, z, width: 8.2, depth: 8.4, height: 4.7, facing: 0,
      label: 'SHED', wall: 'red', falseFront: false, porch: true, rail: false, roofRise: 1.55,
    });
  }

  function makeBarrel(x, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5e4028, roughness: 0.92 });
    const body = cylinder(0.42 * scale, 0.48 * scale, 0.95 * scale, 14, wood, 0, 0.48 * scale, 0);
    group.add(body);
    for (const y of [0.18, 0.48, 0.78]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.455 * scale, 0.035 * scale, 7, 18), mats.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y * scale;
      group.add(ring);
    }
    scene.add(group);
    addCollider(x, z, 0.8 * scale, 0.8 * scale, 0.05);
  }

  function makeBench(x, z, rotation = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    group.add(box(2.4, 0.18, 0.45, mats.porch, 0, 0.8, 0));
    group.add(box(2.4, 0.18, 0.3, mats.porch, 0, 1.35, 0.18));
    for (const sx of [-0.85, 0.85]) {
      group.add(box(0.16, 0.82, 0.16, mats.darkTimber, sx, 0.42, 0));
      group.add(box(0.16, 0.72, 0.16, mats.darkTimber, sx, 1.03, 0.2));
    }
    scene.add(group);
  }

  function makeHitchingRail(x, z, length = 7, rotation = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    const count = Math.max(2, Math.round(length / 2.3));
    for (let i = 0; i < count; i++) {
      const px = -length / 2 + (length * i) / (count - 1);
      group.add(box(0.16, 1.2, 0.16, mats.trim, px, 0.6, 0));
    }
    group.add(box(length, 0.16, 0.16, mats.trim, 0, 1.02, 0));
    scene.add(group);
  }

  function makeFirePit(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: 0x574f43, roughness: 1 }));
      stone.position.set(Math.cos(a) * 1.1, 0.22, Math.sin(a) * 1.1);
      stone.scale.set(1.25, 0.75, 0.9);
      stone.castShadow = true;
      group.add(stone);
    }
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.82, 24), new THREE.MeshBasicMaterial({ color: 0x8b2d13, transparent: true, opacity: 0.52 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    group.add(glow);
    const fireLight = new THREE.PointLight(0xff7135, 3.8, 10, 2);
    fireLight.position.y = 1.0;
    group.add(fireLight);
    flickerLights.push({ light: fireLight, base: 3.8, phase: 2.3 });
    animated.push({ type: 'fire', mesh: glow, phase: Math.random() * 6 });
    scene.add(group);
    addCollider(x, z, 1.8, 1.8, 0.05);
  }

  function makeTree(x, z, scale = 1, dark = false) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const trunkMat = new THREE.MeshStandardMaterial({ color: dark ? 0x171411 : 0x30261c, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: dark ? 0x07100a : 0x0c1c10, roughness: 1 });
    group.add(cylinder(0.38 * scale, 0.55 * scale, 4.5 * scale, 9, trunkMat, 0, 2.25 * scale, 0));
    for (let i = 0; i < 5; i++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry((1.8 + Math.random() * 0.8) * scale, 1), leafMat);
      crown.position.set((Math.random() - 0.5) * 2.2 * scale, (4.5 + Math.random() * 1.7) * scale, (Math.random() - 0.5) * 2.2 * scale);
      crown.scale.y = 0.78;
      crown.castShadow = true;
      group.add(crown);
    }
    scene.add(group);
  }

  function makeStringLights(x1, z1, x2, z2, y = 4.6, bulbs = 9) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(
        THREE.MathUtils.lerp(x1, x2, t),
        y - Math.sin(Math.PI * t) * 0.5,
        THREE.MathUtils.lerp(z1, z2, t)
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.018, 5, false), mats.black);
    scene.add(wire);
    for (let i = 0; i < bulbs; i++) {
      const t = (i + 0.5) / bulbs;
      const p = curve.getPoint(t);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mats.lantern);
      bulb.position.copy(p);
      scene.add(bulb);
      if (i % 2 === 0) {
        const light = new THREE.PointLight(0xffc477, 1.25, 5.5, 2);
        light.position.copy(p);
        scene.add(light);
      }
    }
  }

  function makeGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 170, 1, 1), mats.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const oval = new THREE.Mesh(new THREE.CircleGeometry(22, 64), mats.dirt);
    oval.rotation.x = -Math.PI / 2;
    oval.scale.set(1.0, 1.55, 1);
    oval.position.set(0, 0.015, -44);
    oval.receiveShadow = true;
    scene.add(oval);

    const lane = new THREE.Mesh(new THREE.PlaneGeometry(22, 66), new THREE.MeshStandardMaterial({ color: 0x253020, roughness: 1 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.02, -4);
    lane.receiveShadow = true;
    scene.add(lane);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 20), mats.dirt);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.028, -48);
    path.receiveShadow = true;
    scene.add(path);
  }

  function buildVillage() {
    makeGround();

    makeWesternBuilding({ x: -15, z: 18, width: 9.4, depth: 7.0, height: 5.1, facing: Math.PI / 2, label: 'COWBOY TOWN', wall: 'dark', falseFront: true, porch: true });
    makeWesternBuilding({ x: -15, z: 7, width: 9.8, depth: 7.2, height: 4.7, facing: Math.PI / 2, label: 'MERCANTILE', wall: 'timber', falseFront: true, porch: true });
    makeWesternBuilding({ x: -15, z: -4, width: 8.8, depth: 7.0, height: 4.5, facing: Math.PI / 2, label: "FARMER'S MARKET", wall: 'timber', falseFront: true, porch: true });
    makeWesternBuilding({ x: -15, z: -15, width: 8.0, depth: 6.6, height: 4.25, facing: Math.PI / 2, label: 'POST OFFICE', wall: 'dark', falseFront: true, porch: true });
    makeWesternBuilding({ x: -15, z: -25, width: 8.2, depth: 7.0, height: 4.3, facing: Math.PI / 2, label: 'TRADING POST', wall: 'timber', falseFront: true, porch: true });

    makeWesternBuilding({ x: 15, z: 18, width: 8.5, depth: 7.0, height: 4.4, facing: -Math.PI / 2, label: 'CABIN 1', wall: 'dark', falseFront: false, porch: true });
    makeWesternBuilding({ x: 15, z: 7, width: 9.2, depth: 7.2, height: 4.7, facing: -Math.PI / 2, label: 'SALOON', wall: 'timber', falseFront: true, porch: true });
    makeWesternBuilding({ x: 15, z: -4, width: 8.6, depth: 7.0, height: 4.4, facing: -Math.PI / 2, label: 'BLACKSMITH', wall: 'dark', falseFront: true, porch: true });
    makeWesternBuilding({ x: 15, z: -15, width: 8.0, depth: 6.8, height: 4.25, facing: -Math.PI / 2, label: 'CABIN 2', wall: 'timber', falseFront: false, porch: true });
    makeWesternBuilding({ x: 15, z: -25, width: 8.5, depth: 7.2, height: 4.35, facing: -Math.PI / 2, label: 'STABLE', wall: 'dark', falseFront: true, porch: true });

    makeBarn(-13.2, -47.5);
    makeChurch(0, -52.5);
    makeRedShed(13.2, -47.5);

    makeFirePit(0, -29.5);
    makeBench(-5.5, -35.5, 0.12);
    makeBench(6.0, -35.2, -0.2);
    makeBarrel(-7.5, 3.0, 1.05);
    makeBarrel(7.8, -8.0, 0.9);
    makeBarrel(10.0, 21.5, 0.85);
    makeHitchingRail(-8.1, 12.0, 10.5, Math.PI / 2);
    makeHitchingRail(8.1, -3.0, 9.5, Math.PI / 2);
    makeHitchingRail(0, -38.0, 12.0, 0);

    for (let z = 22; z >= -24; z -= 10.5) makeStringLights(-10.2, z, 10.2, z, 4.8, 10);
    makeStringLights(-10, -39, 10, -39, 5.0, 10);

    for (let z = 34; z >= -72; z -= 6.2) {
      makeTree(-29 - Math.random() * 4, z + Math.random() * 3, 1.0 + Math.random() * 0.55, true);
      makeTree(29 + Math.random() * 4, z + Math.random() * 3, 1.0 + Math.random() * 0.55, true);
    }
    for (let x = -28; x <= 28; x += 6) {
      makeTree(x + Math.random() * 2.5, -72 - Math.random() * 4, 1.1 + Math.random() * 0.5, true);
      if (Math.abs(x) > 7) makeTree(x + Math.random() * 2.5, 38 + Math.random() * 4, 1.0 + Math.random() * 0.4, true);
    }

    colliders.push({ minX: -80, maxX: -27.5, minZ: -90, maxZ: 50 });
    colliders.push({ minX: 27.5, maxX: 80, minZ: -90, maxZ: 50 });
    colliders.push({ minX: -80, maxX: 80, minZ: -100, maxZ: -70 });
    colliders.push({ minX: -80, maxX: 80, minZ: 38, maxZ: 100 });
  }

  function setupLighting() {
    const hemi = new THREE.HemisphereLight(0x6a7890, 0x15130f, 0.44);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(0x9eb5d2, 1.55);
    moon.position.set(-28, 42, 16);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1536, 1536);
    moon.shadow.camera.left = -55;
    moon.shadow.camera.right = 55;
    moon.shadow.camera.top = 55;
    moon.shadow.camera.bottom = -55;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 120;
    moon.shadow.bias = -0.00025;
    scene.add(moon);

    const churchGlow = new THREE.PointLight(0xffd28b, 8.5, 21, 1.7);
    churchGlow.position.set(0, 4.4, -45.5);
    scene.add(churchGlow);
  }

  buildVillage();
  setupLighting();

  function intersectsCollider(x, z) {
    const r = player.radius;
    for (const c of colliders) {
      const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  function movePlayer(deltaX, deltaZ) {
    const nx = player.position.x + deltaX;
    if (!intersectsCollider(nx, player.position.z)) player.position.x = nx;
    const nz = player.position.z + deltaZ;
    if (!intersectsCollider(player.position.x, nz)) player.position.z = nz;
  }

  function updateLocationLabel() {
    const x = player.position.x;
    const z = player.position.z;
    let name = 'GRASSY FLAT';
    if (z < -37) name = 'OVAL END';
    if (z < -44 && Math.abs(x) < 5) name = 'CHURCH YARD';
    if (z < -41 && x < -6) name = 'BARN';
    if (z < -41 && x > 6) name = 'RED SHED';
    if (x < -7 && z > -32) name = 'MERCANTILE ROW';
    if (x > 7 && z > -32) name = 'CABIN ROW';
    ui.location.textContent = name;
  }

  function updatePlayer(dt) {
    let forward = 0;
    let strafe = 0;
    if (keys.KeyW || keys.ArrowUp) forward += 1;
    if (keys.KeyS || keys.ArrowDown) forward -= 1;
    if (keys.KeyD) strafe += 1;
    if (keys.KeyA) strafe -= 1;
    forward += -touchMove.y;
    strafe += touchMove.x;

    const length = Math.hypot(forward, strafe);
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }

    const moving = Math.abs(forward) + Math.abs(strafe) > 0.02;
    player.moving = moving;
    const sprinting = keys.ShiftLeft || keys.ShiftRight || sprintHeld;
    const speed = sprinting ? player.sprint : player.speed;

    if (moving) {
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const dx = (sin * forward + cos * strafe) * speed * dt;
      const dz = (cos * forward - sin * strafe) * speed * dt;
      movePlayer(dx, dz);
      player.bob += dt * (sprinting ? 12 : 8.2);
    }

    const bobY = moving ? Math.sin(player.bob) * (sprinting ? 0.045 : 0.028) : 0;
    const bobX = moving ? Math.cos(player.bob * 0.5) * 0.012 : 0;
    camera.position.set(player.position.x + bobX, player.position.y + bobY, player.position.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    updateLocationLabel();
  }

  function updateWorld(t) {
    for (const f of flickerLights) {
      f.light.intensity = f.base * (0.92 + Math.sin(t * 3.7 + f.phase) * 0.045 + Math.sin(t * 9.3 + f.phase) * 0.018);
    }
    for (const a of animated) {
      if (a.type === 'fire') {
        a.mesh.material.opacity = 0.43 + Math.sin(t * 7.4 + a.phase) * 0.08;
        a.mesh.scale.setScalar(0.96 + Math.sin(t * 5.1 + a.phase) * 0.035);
      }
    }
  }

  let started = false;
  function startGame() {
    started = true;
    ui.start.classList.add('hidden');
    if (!isTouch) renderer.domElement.requestPointerLock?.();
    ui.status.textContent = isTouch ? 'LEFT: MOVE  •  RIGHT: LOOK' : 'WASD: MOVE  •  MOUSE: LOOK  •  SHIFT: SPRINT';
  }

  ui.startBtn.addEventListener('click', startGame);
  renderer.domElement.addEventListener('click', () => {
    if (started && !isTouch && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
  });

  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape') document.exitPointerLock?.();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0019;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.28, 1.1);
  });

  const touchMove = { x: 0, y: 0 };
  let joyPointer = null;
  function updateJoystick(e) {
    const rect = ui.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.33;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    touchMove.x = dx / max;
    touchMove.y = dy / max;
    ui.stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  ui.joystick.addEventListener('pointerdown', (e) => {
    joyPointer = e.pointerId;
    ui.joystick.setPointerCapture(e.pointerId);
    updateJoystick(e);
  });
  ui.joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) updateJoystick(e); });
  function endJoystick(e) {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    touchMove.x = touchMove.y = 0;
    ui.stick.style.transform = 'translate(0,0)';
  }
  ui.joystick.addEventListener('pointerup', endJoystick);
  ui.joystick.addEventListener('pointercancel', endJoystick);

  let lookPointer = null;
  let lookX = 0;
  let lookY = 0;
  ui.lookPad.addEventListener('pointerdown', (e) => {
    lookPointer = e.pointerId;
    lookX = e.clientX;
    lookY = e.clientY;
    ui.lookPad.setPointerCapture(e.pointerId);
  });
  ui.lookPad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointer) return;
    const dx = e.clientX - lookX;
    const dy = e.clientY - lookY;
    lookX = e.clientX;
    lookY = e.clientY;
    player.yaw -= dx * 0.0052;
    player.pitch -= dy * 0.0045;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.25, 1.05);
  });
  const endLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
  ui.lookPad.addEventListener('pointerup', endLook);
  ui.lookPad.addEventListener('pointercancel', endLook);

  let sprintHeld = false;
  ui.sprint.addEventListener('pointerdown', (e) => { sprintHeld = true; ui.sprint.setPointerCapture(e.pointerId); });
  ui.sprint.addEventListener('pointerup', () => { sprintHeld = false; });
  ui.sprint.addEventListener('pointercancel', () => { sprintHeld = false; });

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);

  let elapsed = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.04);
    elapsed += dt;
    if (started) updatePlayer(dt);
    updateWorld(elapsed);
    renderer.render(scene, camera);
  }
  animate();
})();
