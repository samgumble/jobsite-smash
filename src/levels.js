const P2 = Math.PI / 2

// Each level = static world `layout` (createWorld) + `spawns(d)` for the
// destructible piles. Three real construction sectors.
export const LEVELS = [
  // ===== 1. HORIZONTAL / CIVIL: roadway & utilities =====
  {
    name: 'Roadway Project',
    layout: {
      groundColor: '#6f5736',
      fenceHalf: 72,
      coneCount: 30, // lane-closure cones everywhere
      roads: [{ x: 0, z: 0, w: 11, l: 140, rot: 0 }],
      grass: [
        { x: -50, z: 0, w: 38, d: 144 },
        { x: 50, z: 0, w: 38, d: 144 },
      ],
      // jersey barriers flanking both edges of the alignment
      barriers: [
        { x: 7.5, z: -30, ry: P2, n: 10 },
        { x: 7.5, z: 30, ry: P2, n: 10 },
        { x: -7.5, z: -30, ry: P2, n: 10 },
        { x: -7.5, z: 30, ry: P2, n: 10 },
      ],
      containers: [
        { x: -42, z: -44, ry: 0, c: 0 },
        { x: -42, z: -38, ry: 0, c: 2 },
        { x: 46, z: 44, ry: P2, c: 1 },
      ],
      sheds: [{ x: 44, z: -46 }],
    },
    // culvert pipe stacks, channelizer drums, material pallets along the sides
    spawns(d) {
      d.spawnPipeStack({ x: -22, z: -20 }, { rows: 3, yaw: P2 })
      d.spawnPipeStack({ x: -22, z: 20 }, { rows: 3, yaw: P2 })
      d.spawnPipeStack({ x: 22, z: 0 }, { rows: 4, yaw: P2 })
      d.spawnPipeStack({ x: 24, z: -40 }, { rows: 3, yaw: P2 })
      d.spawnBarrelCluster({ x: -24, z: -44 }, { count: 8 })
      d.spawnBarrelCluster({ x: 26, z: 40 }, { count: 8 })
      d.spawnBarrelCluster({ x: -28, z: 44 }, { count: 7 })
      d.spawnPalletStack({ x: 20, z: 24 }, { count: 6 })
      d.spawnPalletStack({ x: -20, z: -44 }, { count: 6 })
      d.spawnPlankPile({ x: 18, z: -24 }, { count: 8 })
      d.spawnCrateStack({ x: -40, z: 20 }, { base: 3 })
      d.spawnCrateStack({ x: 40, z: -20 }, { base: 3 })
      d.spawnPortaPotty({ x: 30, z: 8 })
      d.spawnPortaPotty({ x: -30, z: -8, yaw: 0.4 })
    },
  },

  // ===== 2. VERTICAL: standard building jobsite =====
  {
    name: 'Building Jobsite',
    layout: {
      groundColor: '#6f5736',
      fenceHalf: 70,
      coneCount: 14,
      roads: [{ x: 0, z: -8, w: 8, l: 60, rot: 0 }], // site haul road
      grass: [
        { x: -50, z: -45, w: 30, d: 36 },
        { x: 52, z: 45, w: 28, d: 36 },
      ],
      // a mid-rise frame going up, plus a small annex, served by a tower crane
      buildings: [
        { x: 0, z: 40, w: 18, d: 16, floors: 4, color: 0x9a9a93 },
        { x: -40, z: -34, w: 12, d: 12, floors: 2, color: 0xa6a29a },
      ],
      cranes: [{ x: 20, z: 40, h: 26, jib: 20, rot: Math.PI }],
      containers: [
        { x: 44, z: -10, ry: P2, c: 0 },
        { x: 44, z: -4, ry: P2, c: 1 },
        { x: -46, z: 30, ry: 0, c: 2 },
      ],
      barriers: [{ x: 34, z: -6, ry: P2, n: 6 }],
      sheds: [{ x: -44, z: 48 }],
    },
    // material laydown: bricks, block, lumber, pallets around the build
    spawns(d) {
      d.spawnBrickWall({ x: -16, z: 16 }, { cols: 8, rows: 6 })
      d.spawnBrickWall({ x: 16, z: 16 }, { cols: 8, rows: 5 })
      d.spawnCinderWall({ x: -28, z: 0 }, { cols: 6, rows: 5, yaw: P2 })
      d.spawnCinderWall({ x: 30, z: 8 }, { cols: 6, rows: 4, yaw: P2 })
      d.spawnPalletStack({ x: -18, z: -16 }, { count: 7 })
      d.spawnPalletStack({ x: 18, z: -16 }, { count: 7 })
      d.spawnPalletStack({ x: 0, z: -24 }, { count: 6 })
      d.spawnPlankPile({ x: -30, z: -22 }, { count: 9 })
      d.spawnPlankPile({ x: 30, z: -22 }, { count: 9 })
      d.spawnBarrelCluster({ x: -38, z: 14 }, { count: 7 })
      d.spawnBarrelCluster({ x: 38, z: 28 }, { count: 7 })
      d.spawnCrateStack({ x: -10, z: -38 }, { base: 4 })
      d.spawnCrateStack({ x: 12, z: -40 }, { base: 4 })
      d.spawnPortaPotty({ x: 26, z: -34 })
      d.spawnPortaPotty({ x: -26, z: -38, yaw: 0.5 })
    },
  },

  // ===== 3. HOSPITAL CAMPUS: large institutional build =====
  {
    name: 'Hospital Campus',
    layout: {
      groundColor: '#7c6c4a', // lighter, dusty
      fenceHalf: 72,
      coneCount: 18,
      roads: [
        { x: 0, z: 4, w: 10, l: 70, rot: 0 }, // main drive to the tower entrance
        { x: 0, z: -28, w: 9, l: 60, rot: P2 }, // cross drive
      ],
      grass: [
        { x: -46, z: 44, w: 34, d: 34 }, // campus lawns
        { x: 46, z: 44, w: 34, d: 34 },
        { x: -52, z: -10, w: 24, d: 28 },
      ],
      // the new tower + two lower wings
      buildings: [
        { x: 0, z: 44, w: 20, d: 16, floors: 6, color: 0xcfd2d6 }, // New Tower
        { x: 42, z: 6, w: 26, d: 12, floors: 2, rot: P2, color: 0xc4c8cc }, // east wing
        { x: -44, z: 12, w: 22, d: 12, floors: 2, rot: P2, color: 0xc4c8cc }, // west wing
      ],
      cranes: [{ x: 18, z: 46, h: 30, jib: 22, rot: Math.PI }],
      // cluster of site trailers / offices
      containers: [
        { x: -30, z: -42, ry: 0, c: 0 }, { x: -30, z: -36, ry: 0, c: 1 },
        { x: -30, z: -30, ry: 0, c: 2 }, { x: 30, z: -42, ry: 0, c: 3 },
        { x: 30, z: -36, ry: 0, c: 0 }, { x: 0, z: -48, ry: P2, c: 1 },
      ],
      barriers: [
        { x: -14, z: -18, ry: 0, n: 5 },
        { x: 14, z: -18, ry: 0, n: 5 },
      ],
      sheds: [{ x: 50, z: -44 }],
    },
    // MEP pipe, drywall/block, pallets, crates staged across the campus
    spawns(d) {
      d.spawnCinderWall({ x: -16, z: 18 }, { cols: 7, rows: 5 })
      d.spawnCinderWall({ x: 16, z: 18 }, { cols: 7, rows: 5 })
      d.spawnPipeStack({ x: -34, z: -8 }, { rows: 3, yaw: P2 })
      d.spawnPipeStack({ x: 34, z: -8 }, { rows: 3, yaw: P2 })
      d.spawnPipeStack({ x: 0, z: 26 }, { rows: 4, yaw: P2 })
      d.spawnPalletStack({ x: -22, z: 2 }, { count: 7 })
      d.spawnPalletStack({ x: 22, z: 2 }, { count: 7 })
      d.spawnPalletStack({ x: 0, z: 8 }, { count: 6 })
      d.spawnPlankPile({ x: -10, z: -30 }, { count: 8 })
      d.spawnPlankPile({ x: 10, z: -30 }, { count: 8 })
      d.spawnBarrelCluster({ x: -40, z: -16 }, { count: 7 })
      d.spawnBarrelCluster({ x: 40, z: -16 }, { count: 7 })
      d.spawnCrateStack({ x: -18, z: 30 }, { base: 4 })
      d.spawnCrateStack({ x: 18, z: 30 }, { base: 4 })
      d.spawnPortaPotty({ x: 8, z: -14 })
      d.spawnPortaPotty({ x: -8, z: -14, yaw: 0.5 })
    },
  },
]
