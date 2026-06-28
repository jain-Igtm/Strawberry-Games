export const GAME_CONFIG = {
  build: "v13 modular-world-foundation",
  worldName: "Strawberry World",
  mobileFirst: true,
  chunkSize: 86,
  chunkRadius: 2,
  terrainSegments: 14,
  targetFrameRate: 60,
  camera: {
    fov: 72,
    near: 0.08,
    far: 900,
    eyeHeight: 3.15
  },
  movement: {
    walkSpeed: 14.5,
    lookSensitivity: 0.005
  },
  streaming: {
    chunkCheckMs: 240,
    chunksPerFrame: 1
  },
  visuals: {
    fogDensity: 0.0072,
    pixelRatio: 1,
    shadows: false
  }
};
