const response = await fetch('./samosbor.js?v=18', { cache: 'no-store' });
if (!response.ok) throw new Error(`Could not load Samosbor engine: ${response.status}`);
let source = await response.text();

const oldCamera = "const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.07, 245);";
const newCamera = "const camera = new THREE.PerspectiveCamera(innerHeight > innerWidth ? 62 : 72, innerWidth / innerHeight, 0.07, 245);";

const oldHub = `function buildHub(group, cx, cz, openings) {
  addSectorShell(group, cx, cz, openings, { noCeiling: true });
  const ceilingY = WALL_HEIGHT + 0.12;
  addBox(group, cx - 17, ceilingY, cz, 14, 0.24, SECTOR, M.ceiling, false);
  addBox(group, cx + 17, ceilingY, cz, 14, 0.24, SECTOR, M.ceiling, false);
  addBox(group, cx, ceilingY, cz - 17, 20, 0.24, 14, M.ceiling, false);
  addBox(group, cx, ceilingY, cz + 17, 20, 0.24, 14, M.ceiling, false);
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) addBox(group, cx + x, 1.8, cz + z, 0.65, 3.6, 0.65, M.metal, true);
  addBox(group, cx, 0.03, cz, 5.5, 0.06, 5.5, M.metal, false);
  addWarning(group, cx, 3.48, cz + 4.0);
  addLightPanel(group, cx, 4.0, cz, 5.5, 1.0, false);
}`;

const newHub = `function buildHub(group, cx, cz, openings) {
  // A simple, readable starting hall: one continuous floor and ceiling,
  // four broad exits, and all decoration kept well away from the spawn.
  addSectorShell(group, cx, cz, openings);

  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    addBox(group, cx + x, 2.05, cz + z, 0.7, 4.1, 0.7, M.metal, true);
  }

  for (const [x, z] of [[-10, -10], [0, -10], [10, -10], [-10, 10], [0, 10], [10, 10]]) {
    addLightPanel(group, cx + x, WALL_HEIGHT - 0.05, cz + z, 2.2, 0.48, false);
  }

  addBox(group, cx - 17.5, 0.38, cz, 4.8, 0.76, 1.2, M.wood, true);
  addBox(group, cx + 17.5, 0.38, cz, 4.8, 0.76, 1.2, M.wood, true);
  addBox(group, cx, 3.1, cz - 18.8, 13, 0.16, 0.16, M.pipe, false);

  const hubLight = new THREE.PointLight(0xffefd0, 0.55, 32, 1.8);
  hubLight.position.set(cx, 3.5, cz);
  group.add(hubLight);
  addWarning(group, cx, 3.48, cz + 7.5);
}`;

const oldPlayer = "pos: new THREE.Vector3(0, 1.68, 0), yaw: Math.PI, pitch: 0,";
const newPlayer = "pos: new THREE.Vector3(0, 1.68, 8), yaw: Math.PI, pitch: 0,";

const replacements = [
  [oldCamera, newCamera, 'portrait camera'],
  [oldHub, newHub, 'start hub'],
  [oldPlayer, newPlayer, 'spawn point']
];

for (const [before, after, label] of replacements) {
  if (!source.includes(before)) throw new Error(`Samosbor v19 patch could not find ${label}`);
  source = source.replace(before, after);
}

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
