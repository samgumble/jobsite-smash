import * as THREE from 'three'

// Destructible piles rendered with InstancedMesh — one draw call per "kind"
// instead of one per piece. Bodies are body-only (no per-mesh sync); their
// transforms are written into instance matrices each frame (skipping sleepers).
export function createDestructibles(scene, physics) {
  const items = [] // { body, type } for scoring

  const box = (w, h, l) => new THREE.BoxGeometry(w, h, l)
  const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 16)
  const mat = (opts) => new THREE.MeshStandardMaterial({ color: 0xffffff, ...opts })

  // kind = { geo, mat, dims, pieces: [{ body, color }] }
  const kinds = {
    brick: { geo: box(0.685, 0.335, 0.4), mat: mat({ roughness: 0.9 }), dims: { hx: 0.3425, hy: 0.1675, hz: 0.2 }, pieces: [] },
    cinder: { geo: box(0.93, 0.43, 0.5), mat: mat({ map: cinderTex(), roughness: 0.95 }), dims: { hx: 0.465, hy: 0.215, hz: 0.25 }, pieces: [] },
    barrel: { geo: cyl(0.45, 1.2), mat: mat({ map: ringTex(), roughness: 0.5, metalness: 0.4 }), dims: { halfHeight: 0.6, radius: 0.45 }, pieces: [] },
    pipe: { geo: cyl(0.4, 4.0), mat: mat({ roughness: 0.35, metalness: 0.85 }), dims: { halfHeight: 2.0, radius: 0.4 }, pieces: [] },
    crate: { geo: box(1.2, 1.2, 1.2), mat: mat({ map: crateTex(), roughness: 0.8 }), dims: { hx: 0.6, hy: 0.6, hz: 0.6 }, pieces: [] },
    pallet: { geo: box(1.5, 0.2, 1.5), mat: mat({ map: slatTex(), roughness: 0.85 }), dims: { hx: 0.75, hy: 0.1, hz: 0.75 }, pieces: [] },
    plank: { geo: box(0.35, 0.12, 3.2), mat: mat({ map: slatTex(), roughness: 0.85 }), dims: { hx: 0.175, hy: 0.06, hz: 1.6 }, pieces: [] },
  }

  function addPiece(kindKey, scoreType, position, color, density, rotation, friction) {
    const k = kinds[kindKey]
    const isCyl = 'radius' in k.dims
    const opts = friction !== undefined ? { density, friction } : { density }
    const body = isCyl
      ? physics.addCylinderBody(k.dims, position, opts)
      : physics.addBoxBody(k.dims, position, opts)
    if (rotation) body.setRotation(rotation, false)
    k.pieces.push({ body, color })
    items.push({ body, type: scoreType })
    return body
  }

  // --- Brick wall ---
  function spawnBrickWall(center, { cols = 7, rows = 6, yaw = 0 } = {}) {
    const bw = 0.7, bh = 0.35
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const q = quatY(yaw)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * bw
        addPiece('brick', 'brick', { x: center.x + lx * cosY, y: bh / 2 + r * bh, z: center.z + lx * sinY }, r % 2 ? 0x8f3a24 : 0xa8442a, 25, q)
      }
    }
  }

  // --- Cinder-block wall ---
  function spawnCinderWall(center, { cols = 5, rows = 4, yaw = 0 } = {}) {
    const bw = 0.95, bh = 0.45
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const q = quatY(yaw)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * bw
        addPiece('cinder', 'brick', { x: center.x + lx * cosY, y: bh / 2 + r * bh, z: center.z + lx * sinY }, 0x9a9a93, 30, q)
      }
    }
  }

  // --- Pallet stack ---
  function spawnPalletStack(center, { count = 5 } = {}) {
    const h = 0.2
    for (let i = 0; i < count; i++) {
      addPiece('pallet', 'pallet', { x: center.x, y: h / 2 + i * (h + 0.02), z: center.z }, i % 2 ? 0x8a5a28 : 0xb07a3e, 18)
    }
  }

  // --- Barrel cluster ---
  function spawnBarrelCluster(center, { count = 7, spread = 1.6 } = {}) {
    const h = 1.2
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const ring = i === 0 ? 0 : spread
      addPiece('barrel', 'barrel', { x: center.x + Math.cos(a) * ring, y: h / 2, z: center.z + Math.sin(a) * ring }, i % 2 ? 0xe0892e : 0x3f7fb0, 14)
    }
  }

  // --- Crate stack ---
  function spawnCrateStack(center, { base = 3 } = {}) {
    const s = 1.2
    for (let layer = 0; layer < base; layer++) {
      const n = base - layer
      for (let i = 0; i < n; i++) {
        addPiece('crate', 'crate', { x: center.x + (i - (n - 1) / 2) * (s + 0.05), y: s / 2 + layer * s, z: center.z }, 0xc7a86a, 8)
      }
    }
  }

  // --- Pipe stack (rolls) ---
  function spawnPipeStack(center, { rows = 3, yaw = 0 } = {}) {
    const radius = 0.4
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
    const lie = quatMul(quatY(yaw), { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) })
    for (let r = 0; r < rows; r++) {
      const n = rows - r
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (radius * 2)
        const body = addPiece('pipe', 'barrel', { x: center.x + off * cosY, y: radius + r * (radius * 1.78), z: center.z + off * sinY }, 0xcacfd4, 16, lie, 0.9)
        body.setAngularDamping(1.2) // pipes roll forever otherwise
        body.setLinearDamping(0.3)
      }
    }
  }

  // --- Lumber pile ---
  function spawnPlankPile(center, { count = 8 } = {}) {
    const h = 0.12
    for (let i = 0; i < count; i++) {
      const yaw = (Math.random() - 0.5) * 0.5 + (i % 2 ? Math.PI / 2 : 0)
      addPiece('plank', 'pallet', { x: center.x + (Math.random() - 0.5) * 0.8, y: h / 2 + i * (h + 0.01), z: center.z + (Math.random() - 0.5) * 0.8 }, 0xc08a4a, 14, quatY(yaw))
    }
  }

  // --- Porta-potty: low count, kept as mesh-synced group ---
  function spawnPortaPotty(center, { yaw = 0 } = {}) {
    const w = 1.2, h = 2.3, d = 1.2
    const g = new THREE.Group()
    g.add(mesh(new THREE.BoxGeometry(w, h, d), 0x2f8f5b))
    const door = mesh(new THREE.BoxGeometry(w * 0.7, h * 0.8, 0.06), 0x256f48)
    door.position.set(0, -h * 0.05, d / 2 + 0.02)
    g.add(door)
    const roof = mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), 0xf0f0ea)
    roof.position.y = h / 2 + 0.06
    g.add(roof)
    g.traverse((m) => { m.castShadow = true; m.receiveShadow = true })
    g.rotation.y = yaw
    scene.add(g)
    const body = physics.addBox(g, { hx: w / 2, hy: h / 2, hz: d / 2 }, { x: center.x, y: h / 2, z: center.z }, { density: 6 })
    body.setRotation(quatY(yaw), false)
    items.push({ body, type: 'crate' })
  }

  function mesh(geo, color) {
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }))
  }

  // Build the InstancedMeshes once all pieces are spawned.
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1)
  const _c = new THREE.Color()
  function write(im, idx, body) {
    const t = body.translation(), r = body.rotation()
    _p.set(t.x, t.y, t.z)
    _q.set(r.x, r.y, r.z, r.w)
    _m.compose(_p, _q, _s)
    im.setMatrixAt(idx, _m)
  }

  function finalize() {
    for (const k of Object.values(kinds)) {
      if (k.pieces.length === 0) continue
      const im = new THREE.InstancedMesh(k.geo, k.mat, k.pieces.length)
      im.castShadow = true
      im.receiveShadow = true
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      k.pieces.forEach((pc, i) => {
        write(im, i, pc.body)
        im.setColorAt(i, _c.set(pc.color))
      })
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      scene.add(im)
      k.mesh = im
    }
  }

  // Update instance matrices for awake bodies only.
  function sync() {
    for (const k of Object.values(kinds)) {
      if (!k.mesh) continue
      let any = false
      const pieces = k.pieces
      for (let i = 0; i < pieces.length; i++) {
        if (pieces[i].body.isSleeping()) continue
        write(k.mesh, i, pieces[i].body)
        any = true
      }
      if (any) k.mesh.instanceMatrix.needsUpdate = true
    }
  }

  return {
    items,
    finalize,
    sync,
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
function quatY(yaw) {
  const h = yaw / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}

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
