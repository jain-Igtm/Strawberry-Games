extends RefCounted

const WEAPONS := {
	"carbine": {
		"name": "RUSTLINE CARBINE", "magazine": 30, "reserve": 180, "fire_delay": 0.105,
		"reload": 1.65, "damage": 36.0, "headshot": 1.9, "pellets": 1, "spread": 0.0025,
		"automatic": true, "accent": Color("#a85a2a"), "scope_fov": 0.0,
		"scale": Vector3(1.0,1.0,1.0), "view": Vector3(0.34,-0.29,-0.61)
	},
	"smg": {
		"name": "CINDER-9 SMG", "magazine": 42, "reserve": 252, "fire_delay": 0.072,
		"reload": 1.42, "damage": 23.0, "headshot": 1.65, "pellets": 1, "spread": 0.0075,
		"automatic": true, "accent": Color("#d17b2c"), "scope_fov": 0.0,
		"scale": Vector3(0.86,0.92,0.80), "view": Vector3(0.36,-0.30,-0.50)
	},
	"shotgun": {
		"name": "BREAKWATER 12", "magazine": 8, "reserve": 56, "fire_delay": 0.68,
		"reload": 2.05, "damage": 19.0, "headshot": 1.45, "pellets": 7, "spread": 0.052,
		"automatic": false, "accent": Color("#7e3926"), "scope_fov": 0.0,
		"scale": Vector3(1.06,0.95,1.22), "view": Vector3(0.33,-0.31,-0.73)
	},
	"marksman": {
		"name": "WIDOWMAKER RIFLE", "magazine": 12, "reserve": 72, "fire_delay": 0.29,
		"reload": 1.90, "damage": 78.0, "headshot": 2.20, "pellets": 1, "spread": 0.0012,
		"automatic": false, "accent": Color("#4e6870"), "scope_fov": 28.0,
		"scale": Vector3(1.02,0.96,1.33), "view": Vector3(0.31,-0.30,-0.76)
	},
	"lmg": {
		"name": "FOUNDRY 76 LMG", "magazine": 76, "reserve": 304, "fire_delay": 0.092,
		"reload": 2.75, "damage": 31.0, "headshot": 1.72, "pellets": 1, "spread": 0.006,
		"automatic": true, "accent": Color("#b18b35"), "scope_fov": 0.0,
		"scale": Vector3(1.12,1.02,1.20), "view": Vector3(0.30,-0.33,-0.72)
	},
	"harpoon": {
		"name": "LEVIATHAN HARPOON", "magazine": 5, "reserve": 35, "fire_delay": 0.82,
		"reload": 2.20, "damage": 168.0, "headshot": 2.55, "pellets": 1, "spread": 0.0007,
		"automatic": false, "accent": Color("#4b8a8f"), "scope_fov": 31.0,
		"scale": Vector3(1.04,1.04,1.58), "view": Vector3(0.29,-0.31,-0.84)
	},
	"arc": {
		"name": "ARC-FURNACE PROTOTYPE", "magazine": 18, "reserve": 90, "fire_delay": 0.24,
		"reload": 2.10, "damage": 94.0, "headshot": 2.05, "pellets": 1, "spread": 0.0018,
		"automatic": false, "accent": Color("#4cc9d8"), "scope_fov": 0.0,
		"scale": Vector3(0.98,1.05,1.24), "view": Vector3(0.32,-0.29,-0.70)
	},
}

const PICKUP_COSTS := {
	"smg": 850,
	"shotgun": 1200,
	"marksman": 1650,
	"lmg": 2200,
	"harpoon": 3200,
	"arc": 3900,
}

const OPTIC_FOV := [52.0, 39.0, 26.0, 34.0]

static func definition(id: String) -> Dictionary:
	return WEAPONS.get(id, WEAPONS["carbine"])

static func magazine_size(id: String, level: int) -> int:
	var base := int(definition(id)["magazine"])
	return maxi(1, roundi(float(base) * (1.0 + maxi(0,level) * 0.20)))

static func damage_multiplier(level: int) -> float:
	return 1.0 + maxi(0,level) * 0.48

static func upgrade_cost(level: int) -> int:
	return 2200 + maxi(0,level) * 1800

static func optic_fov(id: String, level: int) -> float:
	var factory := float(definition(id)["scope_fov"])
	if level <= 0:
		return factory
	return OPTIC_FOV[(level - 1) % OPTIC_FOV.size()]
