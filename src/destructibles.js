import * as THREE from 'three'

// Builds clusters of dynamic bodies that scatter when the vehicle hits them.
// Each spawned piece is tracked in `items` for scoring / despawn.
export function createDestructibles(scene, physics) {
  const items = []

  // Shared geometries/materials so a big pile isn't a pile of allocations.
  const mats = {
    brick: new THREE.MeshStandardMaterial({ color: 0xa8442a, roughness: 0.9 }),
    brickAlt: new THREE.MeshStandardMaterial({ color: 0x8f3a24, roughness: 0.9 }),
    barrelA: new THREE.MeshStandardMaterial({ color: 0xe0892e, map: ringTex(), roughness: 0.5, metalness: 0.4 }),
    barrelB: new THREE.MeshStandardMaterial({ color: 0x3f7fb0, map: ringTex(), roughness: 0.5, metalness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ color: 0xc7a86a, map: crateTex(), roughness: 0.8 }),
    pallet: new THREE.MeshStandardMaterial({ color: 0xb07a3e, map: slatTex(), roughness: 0.85 }),
    palletAlt: new THREE.MeshStandardMaterial({ color: 0x8a5a28, map: slatTex(), roughness: 0.85 }),
    cinder: new THREE.MeshStandardMaterial({ color: 0x9a9a93, map: cinderTex(), roughness: 0.95 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0xcacfd4, roughness: 0.35, metalness: 0.85 }),
    plank: new THREE.MeshStandardMaterial({ color: 0xc08a4a, map: slatTex(), roughness: 0.85 }),
    potty: new THREE.MeshStandardMaterial({ color: 0x2f8f5b, roughness: 0.6 }),
    pottyDoor: new THREE.MeshStandardMaterial({ color: 0x256f48, roughness: 0.6 }),
    pottyRoof: new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.7 }),
  }

  function track(obj, body, type) {
    obj.traverse?.((m) => { m.castShadow = true; m.receiveShadow = true })
    if (!obj.traverse) { obj.castShadow = true; obj.receiveShadow = true }
    scene.add(obj)
    items.push({ mesh: obj, body, type })
    return body
  }

  // --- Brick wall: clean grid of bricks, the showpiece smash ---
  function spawnBrickWall(center, { cols = 7, rows = 6, yaw = 0 } = {}) {
    const bw = 0.7, bh = 0.35, bd = 0.4
    const gap = 0.015
    const geo = new THREE.BoxGeometry(bw - gap, bh - gap, bd)
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const q = meshQuat(yaw)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const localX = (c - (cols - 1) / 2) * bw
        const x = center.x + localX * cosY
        const z = center.z + localX * sinY
        const y = bh / 2 + r * bh
        const mesh = new THREE.Mesh(geo, r % 2 ? mats.brickAlt : mats.brick)
        mesh.rotation.y = yaw
        const body = physics.addBox(mesh, { hx: (bw - gap) / 2, hy: (bh - gap) / 2, hz: bd / 2 }, { x, y, z }, { density: 25, friction: 0.8 })
        body.setRotation(q, false)
        track(mesh, body, 'brick')
      }
    }
  }

  // --- Cinder-block wall: bigger, heavier grey blocks ---
  function spawnCinderWall(center, { cols = 5, rows = 4, yaw = 0 } = {}) {
    const bw = 0.95, bh = 0.45, bd = 0.5
    const gap = 0.02
    const geo = new THREE.BoxGeometry(bw - gap, bh - gap, bd)
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const q = meshQuat(yaw)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const localX = (c - (cols - 1) / 2) * bw
        const x = center.x + localX * cosY
        const z = center.z + localX * sinY
        const mesh = new THREE.Mesh(geo, mats.cinder)
        mesh.rotation.y = yaw
        const body = physics.addBox(mesh, { hx: (bw - gap) / 2, hy: (bh - gap) / 2, hz: bd / 2 }, { x, y: bh / 2 + r * bh, z }, { density: 30, friction: 0.85 })
        body.setRotation(q, false)
        track(mesh, body, 'brick')
      }
    }
  }

  // --- Pallet stack: thin wide slatted boards stacked flat ---
  function spawnPalletStack(center, { count = 5 } = {}) {
    const w = 1.5, h = 0.2, d = 1.5
    const geo = new THREE.BoxGeometry(w, h, d)
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, i % 2 ? mats.palletAlt : mats.pallet)
      const body = physics.addBox(mesh, { hx: w / 2, hy: h / 2, hz: d / 2 }, { x: center.x, y: h / 2 + i * (h + 0.02), z: center.z }, { density: 18, friction: 0.7 })
      track(mesh, body, 'pallet')
    }
  }

  // --- Barrel cluster: ringed upright cylinders ---
  function spawnBarrelCluster(center, { count = 7, spread = 1.6 } = {}) {
    const radius = 0.45, height = 1.2
    const geo = new THREE.CylinderGeometry(radius, radius, height, 16)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const ring = i === 0 ? 0 : spread
      const x = center.x + Math.cos(angle) * ring
      const z = center.z + Math.sin(angle) * ring
      const mesh = new THREE.Mesh(geo, i % 2 ? mats.barrelA : mats.barrelB)
      const body = physics.addCylinder(mesh, { halfHeight: height / 2, radius }, { x, y: height / 2, z }, { density: 14, friction: 0.5 })
      track(mesh, body, 'barrel')
    }
  }

  // --- Crate stack: a small pyramid of wooden boxes ---
  function spawnCrateStack(center, { base = 3 } = {}) {
    const s = 1.2
    const geo = new THREE.BoxGeometry(s, s, s)
    for (let layer = 0; layer < base; layer++) {
      const n = base - layer
      for (let i = 0; i < n; i++) {
        const x = center.x + (i - (n - 1) / 2) * (s + 0.05)
        const mesh = new THREE.Mesh(geo, mats.crate)
        const body = physics.addBox(mesh, { hx: s / 2, hy: s / 2, hz: s / 2 }, { x, y: s / 2 + layer * s, z: center.z }, { density: 8, friction: 0.7 })
        track(mesh, body, 'crate')
      }
    }
  }

  // --- Pipe stack: horizontal metal pipes in a pyramid (they roll!) ---
  function spawnPipeStack(center, { length = 4, rows = 3, yaw = 0 } = {}) {
    const radius = 0.4
    const geo = new THREE.CylinderGeometry(radius, radius, length, 16)
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    // lay each pipe's axis along the row direction (perpendicular to yaw)
    const lie = quatMul(meshQuat(yaw), { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) })
    for (let r = 0; r < rows; r++) {
      const n = rows - r
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (radius * 2)
        const x = center.x + off * cosY
        const z = center.z + off * sinY
        const y = radius + r * (radius * 1.72) // nest in the valleys below
        const mesh = new THREE.Mesh(geo, mats.pipe)
        const body = physics.addCylinder(mesh, { halfHeight: length / 2, radius }, { x, y, z }, { density: 16, friction: 0.4 })
        body.setRotation(lie, false)
        track(mesh, body, 'barrel')
      }
    }
  }

  // --- Lumber pile: long boards in a loose criss-cross stack ---
  function spawnPlankPile(center, { count = 8, length = 3.2 } = {}) {
    const w = 0.35, h = 0.12
    const geo = new THREE.BoxGeometry(w, h, length)
    for (let i = 0; i < count; i++) {
      const yaw = (Math.random() - 0.5) * 0.5 + (i % 2 ? Math.PI / 2 : 0)
      const x = center.x + (Math.random() - 0.5) * 0.8
      const z = center.z + (Math.random() - 0.5) * 0.8
      const mesh = new THREE.Mesh(geo, mats.plank)
      const body = physics.addBox(mesh, { hx: w / 2, hy: h / 2, hz: length / 2 }, { x, y: h / 2 + i * (h + 0.01), z }, { density: 14, friction: 0.7 })
      body.setRotation(meshQuat(yaw), false)
      track(mesh, body, 'pallet')
    }
  }

  // --- Porta-potty: a tall light cabin that topples and rolls ---
  function spawnPortaPotty(center, { yaw = 0 } = {}) {
    const w = 1.2, h = 2.3, d = 1.2
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.potty))
    const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.8, 0.06), mats.pottyDoor)
    door.position.set(0, -h * 0.05, d / 2 + 0.02)
    g.add(door)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), mats.pottyRoof)
    roof.position.y = h / 2 + 0.06
    g.add(roof)
    g.rotation.y = yaw
    const body = physics.addBox(g, { hx: w / 2, hy: h / 2, hz: d / 2 }, { x: center.x, y: h / 2, z: center.z }, { density: 6, friction: 0.6 })
    body.setRotation(meshQuat(yaw), false)
    track(g, body, 'crate')
  }

  return {
    items,
    spawnBrickWall,
    spawnCinderWall,
    spawnPalletStack,
    spawnBarrelCluster,
    spawnCrateStack,
    spawnPipeStack,
    spawnPlankPile,
    spawnPortaPotty,
  }
}

// --- helpers ---
function meshQuat(yaw) {
  const h = yaw / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}

// Hamilton product a*b for {x,y,z,w} quaternions.
function quatMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function canvasTex(draw, w = 64, h = 64) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return new THREE.CanvasTexture(c)
}

// Grayscale textures that MULTIPLY the material color (so tint is preserved).
function crateTex() {
  return canvasTex((x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(90,60,30,0.55)'; x.lineWidth = 4
    x.strokeRect(2, 2, w - 4, h - 4)
    for (let i = 16; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke() }
    x.strokeStyle = 'rgba(90,60,30,0.4)'
    x.beginPath(); x.moveTo(2, 2); x.lineTo(w - 2, h - 2); x.moveTo(w - 2, 2); x.lineTo(2, h - 2); x.stroke()
  })
}

function ringTex() {
  return canvasTex((x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(0,0,0,0.32)'
    for (const v of [0.16, 0.5, 0.84]) x.fillRect(0, v * h - 3, w, 6)
  }, 16, 64)
}

function slatTex() {
  return canvasTex((x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(70,45,20,0.5)'
    for (let i = 0; i < w; i += 12) x.fillRect(i, 0, 3, h)
  })
}

function cinderTex() {
  return canvasTex((x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(0,0,0,0.35)'
    x.fillRect(w * 0.18, h * 0.25, w * 0.24, h * 0.5)
    x.fillRect(w * 0.58, h * 0.25, w * 0.24, h * 0.5)
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4)
  })
}
