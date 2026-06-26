const P2 = Math.PI / 2

// Each level = static world `layout` (passed to createWorld) + a `spawns(d)`
// that populates destructibles. Three distinct jobsite layouts.
export const LEVELS = [
  {
    name: 'Open Jobsite',
    layout: {
      groundColor: '#6f5736',
      fenceHalf: 70,
      coneCount: 16,
      containers: [
        { x: -40, z: -36, ry: 0, c: 0 },
        { x: -40, z: -30, ry: 0, c: 1 },
        { x: 40, z: 34, ry: P2, c: 2 },
        { x: 34, z: -42, ry: 0.3, c: 3 },
        { x: 48, z: 8, ry: P2, c: 0 },
      ],
      barriers: [
        { x: -8, z: -28, ry: 0, n: 5 },
        { x: 30, z: 20, ry: P2, n: 4 },
      ],
      sheds: [{ x: -48, z: 40 }],
    },
    spawns(d) {
      d.spawnBrickWall({ x: 0, z: 18 }, { cols: 8, rows: 6 })
      d.spawnBrickWall({ x: -26, z: 14 }, { cols: 6, rows: 5, yaw: P2 })
      d.spawnBrickWall({ x: 44, z: -22 }, { cols: 7, rows: 5, yaw: P2 })
      d.spawnCinderWall({ x: 22, z: 4 }, { cols: 6, rows: 4 })
      d.spawnCinderWall({ x: -44, z: -2 }, { cols: 5, rows: 4, yaw: P2 })
      d.spawnPalletStack({ x: 16, z: 18 }, { count: 6 })
      d.spawnPalletStack({ x: 22, z: 26 }, { count: 5 })
      d.spawnPalletStack({ x: -38, z: -16 }, { count: 7 })
      d.spawnPlankPile({ x: 6, z: 30 }, { count: 9 })
      d.spawnPlankPile({ x: -18, z: -28 }, { count: 8 })
      d.spawnBarrelCluster({ x: -16, z: 30 }, { count: 7 })
      d.spawnBarrelCluster({ x: 10, z: 38 }, { count: 6 })
      d.spawnBarrelCluster({ x: -50, z: 22 }, { count: 8 })
      d.spawnPipeStack({ x: -32, z: 40 }, { rows: 3 })
      d.spawnPipeStack({ x: 30, z: 44 }, { rows: 4, yaw: P2 })
      d.spawnCrateStack({ x: 28, z: -6 }, { base: 4 })
      d.spawnCrateStack({ x: -22, z: -10 }, { base: 3 })
      d.spawnCrateStack({ x: 8, z: -42 }, { base: 4 })
      d.spawnPortaPotty({ x: 12, z: -16 })
      d.spawnPortaPotty({ x: -34, z: 28, yaw: 0.5 })
    },
  },

  {
    name: 'Demolition Yard',
    layout: {
      groundColor: '#574027', // darker, rubble-strewn
      fenceHalf: 58,
      coneCount: 10,
      containers: [
        { x: -50, z: -50, ry: 0.4, c: 0 },
        { x: 50, z: 50, ry: 0.2, c: 3 },
      ],
      barriers: [
        { x: 0, z: 46, ry: P2, n: 6 },
        { x: 0, z: -46, ry: P2, n: 6 },
      ],
      sheds: [],
    },
    // A maze of walls everywhere — pure smashing.
    spawns(d) {
      d.spawnBrickWall({ x: 0, z: 30 }, { cols: 10, rows: 6 })
      d.spawnBrickWall({ x: 0, z: -30 }, { cols: 10, rows: 6 })
      d.spawnBrickWall({ x: -28, z: 0 }, { cols: 8, rows: 6, yaw: P2 })
      d.spawnBrickWall({ x: 28, z: 0 }, { cols: 8, rows: 6, yaw: P2 })
      d.spawnCinderWall({ x: -16, z: 14 }, { cols: 6, rows: 5 })
      d.spawnCinderWall({ x: 16, z: -14 }, { cols: 6, rows: 5 })
      d.spawnCinderWall({ x: 15, z: 15 }, { cols: 5, rows: 5, yaw: P2 })
      d.spawnCinderWall({ x: -15, z: -15 }, { cols: 5, rows: 5, yaw: P2 })
      d.spawnBrickWall({ x: -38, z: 30 }, { cols: 5, rows: 5 })
      d.spawnBrickWall({ x: 38, z: -30 }, { cols: 5, rows: 5 })
      d.spawnBarrelCluster({ x: -40, z: -20 }, { count: 7 })
      d.spawnBarrelCluster({ x: 40, z: 20 }, { count: 7 })
      d.spawnCrateStack({ x: 0, z: 16 }, { base: 3 })
      d.spawnPortaPotty({ x: -20, z: 20 })
      d.spawnPortaPotty({ x: 20, z: -20, yaw: 0.6 })
    },
  },

  {
    name: 'Container Yard',
    layout: {
      groundColor: '#7c6c4a', // lighter, dusty gravel
      fenceHalf: 70,
      coneCount: 20,
      // two long lanes of shipping containers
      containers: [
        { x: -16, z: -42, ry: 0, c: 0 }, { x: -16, z: -26, ry: 0, c: 1 }, { x: -16, z: -10, ry: 0, c: 2 },
        { x: -16, z: 14, ry: 0, c: 3 }, { x: -16, z: 30, ry: 0, c: 0 }, { x: -16, z: 46, ry: 0, c: 1 },
        { x: 16, z: -42, ry: 0, c: 2 }, { x: 16, z: -26, ry: 0, c: 3 }, { x: 16, z: -10, ry: 0, c: 0 },
        { x: 16, z: 14, ry: 0, c: 1 }, { x: 16, z: 30, ry: 0, c: 2 }, { x: 16, z: 46, ry: 0, c: 3 },
        { x: 52, z: -20, ry: P2, c: 0 }, { x: -52, z: 20, ry: P2, c: 2 },
      ],
      barriers: [{ x: 0, z: -52, ry: P2, n: 5 }],
      sheds: [{ x: 54, z: 48 }],
    },
    // pallets, crates and barrels packed into the lanes
    spawns(d) {
      for (const z of [-44, -28, -12, 12, 28, 44]) d.spawnPalletStack({ x: 0, z }, { count: 5 })
      d.spawnCrateStack({ x: -40, z: -30 }, { base: 4 })
      d.spawnCrateStack({ x: 40, z: 30 }, { base: 4 })
      d.spawnCrateStack({ x: -40, z: 40 }, { base: 3 })
      d.spawnCrateStack({ x: 40, z: -40 }, { base: 3 })
      d.spawnBarrelCluster({ x: -34, z: 0 }, { count: 8 })
      d.spawnBarrelCluster({ x: 34, z: 0 }, { count: 8 })
      d.spawnBarrelCluster({ x: 0, z: 58 }, { count: 7 })
      d.spawnPlankPile({ x: -40, z: 10 }, { count: 9 })
      d.spawnPlankPile({ x: 40, z: -10 }, { count: 9 })
      d.spawnPipeStack({ x: -44, z: 0 }, { rows: 3, yaw: P2 })
      d.spawnPipeStack({ x: 44, z: 0 }, { rows: 3, yaw: P2 })
      d.spawnPortaPotty({ x: 44, z: 8 })
      d.spawnPortaPotty({ x: -44, z: -8, yaw: 0.4 })
    },
  },
]
