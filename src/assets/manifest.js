export const ASSETS = {
  models: {
    trees: {
      pineTall: "assets/models/trees/pine_tall.gltf",
      pineYoung: null,
      broadleafTall: null,
      broadleafYoung: null,
      deadTree: null,
      fallenLog: null,
      stump: null
    },
    rocks: {
      smallRock: null,
      largeRock: null,
      cliff: null,
      boulder: null
    },
    plants: {
      grassClump: null,
      fern: null,
      bush: null,
      wildflower: null
    },
    buildings: {
      cabin: null,
      ruin: null,
      cityBlock: null
    },
    vehicles: {
      basicCar: null,
      truck: null
    },
    characters: {
      deer: null,
      wolf: null,
      infected: null
    },
    dimensions: {
      backroomsWallSet: null,
      backroomsLight: null,
      portalFrame: null
    }
  },
  textures: {
    ground: {
      grass: null,
      forestFloor: null,
      dirt: null,
      mud: null,
      rock: null,
      gravel: null
    },
    trees: {
      pineBark: null,
      oakBark: null,
      pineNeedles: null,
      broadleafLeaves: null
    },
    structures: {
      concrete: null,
      brick: null,
      asphalt: null,
      wallpaper: null
    },
    sky: {
      clouds: null,
      stars: null
    }
  },
  audio: {
    ambience: {},
    footsteps: {},
    vehicles: {},
    characters: {},
    music: {}
  }
};

export const REALISM_TARGETS = {
  useExternalModelsWhenAvailable: true,
  useProceduralFallbacks: true,
  mobileTriangleBudgetNearChunk: 45000,
  mobileMaxLoadedChunks: 25,
  farForestUsesBillboards: true,
  terrainUsesTextureBlending: true,
  preferGLB: true,
  preferInstancing: true,
  streamChunksGradually: true
};

export const WORLD_REGIONS = {
  wilderness: {
    enabled: true,
    description: "Forests, mountains, lakes, rivers, caves, cabins, trails, and ruins."
  },
  fantasy: {
    enabled: false,
    description: "Magic, ruins, quests, spells, artifacts, dungeons, and non-modern settlements."
  },
  modernCity: {
    enabled: false,
    description: "Cars, roads, traffic, apartments, police, gangs, businesses, and city stories."
  },
  outbreakZone: {
    enabled: false,
    description: "Quarantined cities, empty streets, barricades, and survivors."
  },
  cosmicHorror: {
    enabled: false,
    description: "Reality anomalies, cults, impossible structures, and hidden events."
  },
  backrooms: {
    enabled: false,
    description: "Liminal procedural interior dimension connected by portals and rare world events."
  }
};
