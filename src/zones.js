export const ZONES = {
  wilderness: {
    enabled: true,
    label: "Wilderness",
    mood: "open forest, mountains, lakes, paths, caves, cabins",
    priority: 1
  },
  fantasy: {
    enabled: false,
    label: "Fantasy Region",
    mood: "ruins, magic, quests, strange settlements, old roads",
    priority: 2
  },
  city: {
    enabled: false,
    label: "Modern City",
    mood: "roads, vehicles, buildings, alleys, apartments, traffic",
    priority: 3
  },
  outbreak: {
    enabled: false,
    label: "Outbreak Zone",
    mood: "barricades, empty streets, infected crowds, survivors",
    priority: 4
  },
  anomaly: {
    enabled: false,
    label: "Anomaly Zone",
    mood: "warped reality, impossible structures, hidden events",
    priority: 5
  },
  backrooms: {
    enabled: false,
    label: "Backrooms",
    mood: "liminal rooms, hum, maze halls, portals, exits",
    priority: 6
  }
};

export function getEnabledZones() {
  return Object.entries(ZONES)
    .filter(([, zone]) => zone.enabled)
    .map(([id, zone]) => ({ id, ...zone }));
}
