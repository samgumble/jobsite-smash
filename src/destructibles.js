import * as THREE from 'three'

// Builds clusters of dynamic bodies that scatter when the vehicle hits them.
// Each spawned piece is tracked in `items` for future scoring / despawn.
export function createDestructibles(scene, physics) {
  const items = []

  // Shared geometries/materials so a big pile isn't a pile of allocations.
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0xb07a3e, roughness: 0.85 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x8a5a28, roughness: 0.85 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xa8442a, roughness: 0.9 }),
    brickAlt: new THREE.MeshStandardMaterial({ color: 0x8f3a24, roughness: 0.9 }),
    barrelA: new THREE.MeshStandardMaterial({ color: 0xe0892e, roughness: 0.5, metalness: 0.4 }),
    barrelB: new THREE.MeshStandardMaterial({ color: 0x3f7fb0, roughness: 0.5, metalness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ color: 0xc7a86a, roughness: 0.8 }),
  }

  function track(mesh, body, type) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    items.push({ mesh, body, type })
    return body
  }

  // --- Brick wall: rows/columns of small bricks, the showpiece smash ---
  function spawnBrickWall(center, { cols = 7, rows = 6, yaw = 0 } = {}) {
    const bw = 0.7, bh = 0.35, bd = 0.4
    const gap = 0.015 // hairline gap so bricks rest cleanly without solver jitter
    const geo = new THREE.BoxGeometry(bw - gap, bh - gap, bd)
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const q = meshQuat(yaw)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Clean aligned grid (flush ends) so it reads as a wall, not a heap.
        const localX = (c - (cols - 1) / 2) * bw
        const x = center.x + localX * cosY
        const z = center.z + localX * sinY
        const y = bh / 2 + r * bh
        const mesh = new THREE.Mesh(geo, r % 2 ? mats.brickAlt : mats.brick)
        mesh.rotation.y = yaw
        const body = physics.addBox(
          mesh,
          { hx: (bw - gap) / 2, hy: (bh - gap) / 2, hz: bd / 2 },
          { x, y, z },
          { density: 25, friction: 0.8 }
        )
        body.setRotation(q, false)
        track(mesh, body, 'brick')
      }
    }
  }

  // --- Pallet stack: thin wide boards stacked flat ---
  function spawnPalletStack(center, { count = 5 } = {}) {
    const w = 1.5, h = 0.2, d = 1.5
    const geo = new THREE.BoxGeometry(w, h, d)
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, i % 2 ? mats.woodDark : mats.wood)
      const body = physics.addBox(
        mesh,
        { hx: w / 2, hy: h / 2, hz: d / 2 },
        { x: center.x, y: h / 2 + i * (h + 0.02), z: center.z },
        { density: 18, friction: 0.7 }
      )
      track(mesh, body, 'pallet')
    }
  }

  // --- Barrel cluster: upright cylinders grouped together ---
  function spawnBarrelCluster(center, { count = 7, spread = 1.6 } = {}) {
    const radius = 0.45, height = 1.2
    const geo = new THREE.CylinderGeometry(radius, radius, height, 14)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const ring = i === 0 ? 0 : spread
      const x = center.x + Math.cos(angle) * ring
      const z = center.z + Math.sin(angle) * ring
      const mesh = new THREE.Mesh(geo, i % 2 ? mats.barrelA : mats.barrelB)
      const body = physics.addCylinder(
        mesh,
        { halfHeight: height / 2, radius },
        { x, y: height / 2, z },
        { density: 14, friction: 0.5 }
      )
      track(mesh, body, 'barrel')
    }
  }

  // --- Crate stack: a small pyramid of boxes ---
  function spawnCrateStack(center, { base = 3 } = {}) {
    const s = 1.2
    const geo = new THREE.BoxGeometry(s, s, s)
    for (let layer = 0; layer < base; layer++) {
      const n = base - layer
      for (let i = 0; i < n; i++) {
        const x = center.x + (i - (n - 1) / 2) * (s + 0.05)
        const y = s / 2 + layer * s
        const mesh = new THREE.Mesh(geo, mats.crate)
        const body = physics.addBox(
          mesh,
          { hx: s / 2, hy: s / 2, hz: s / 2 },
          { x, y, z: center.z },
          { density: 8, friction: 0.7 }
        )
        track(mesh, body, 'crate')
      }
    }
  }

  return { items, spawnBrickWall, spawnPalletStack, spawnBarrelCluster, spawnCrateStack }
}

// Small helper: quaternion for a yaw rotation about Y (Rapier {x,y,z,w}).
function meshQuat(yaw) {
  const h = yaw / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}
