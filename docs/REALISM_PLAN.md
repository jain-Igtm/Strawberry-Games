# Forest Explorer realism plan

The target is not more primitive cone/sphere trees. The target is a phone-friendly open-world renderer that can gradually approach Skyrim-style wilderness.

## Current state

The game now has:

- Mobile controls
- Procedural chunk streaming
- Basic terrain
- Distant mountains
- Clouds
- Placeholder procedural trees
- Basic grass and rocks
- Modular files

## What must change for realism

### 1. Real models

Replace procedural tree placeholders with optimized `.glb` assets:

- Pine trees
- Broadleaf trees
- Fallen logs
- Rocks
- Bushes
- Grass clumps

Procedural objects are useful for testing, but they will always look fake.

### 2. Terrain materials

The ground needs texture blending:

- Grass
- Dirt path
- Mud
- Rock
- Leaves / forest floor

### 3. LOD and impostors

Nearby objects can be real models.
Far objects should become cheap versions:

- Lower-poly models
- Billboards
- Fog-hidden silhouettes

### 4. World streaming

Cars and cities will require chunk streaming that loads gradually without frame drops.

### 5. Biomes and regions

The game should become one world with many genres inside it:

- Forest wilderness
- Fantasy quest regions
- Modern cities
- Zombie outbreak zones
- Cosmic horror areas
- Backrooms / other dimensions

## Immediate next milestone

Load one real `.glb` tree model from `assets/models/trees/`, then place it in the forest with fallback procedural trees when the file is missing.
