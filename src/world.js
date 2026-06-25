import * as THREE from 'three'

// Builds the static jobsite: textured dirt ground, perimeter fence, and props.
// All textures are generated on a canvas so there are no asset files to load.
export function createWorld(scene, physics) {
  const HALF = 70 // playable area half-extent (fence sits here)

  buildGround(scene)
  buildFence(scene, physics, HALF)
  buildContainers(scene, physics)
  buildBarriers(scene, physics)
  buildShed(scene, physics)
  const cones = buildCones(scene, physics)

  return { HALF, cones }
}

// --- Ground: procedural gravel/dirt ---
function buildGround(scene) {
  const tex = makeGroundTexture()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(40, 40)
  tex.anisotropy = 8

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

function makeGroundTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#6f5736'
  ctx.fillRect(0, 0, 256, 256)
  // soft blotches
  for (let i = 0; i < 240; i++) {
    const r = 4 + Math.random() * 26
    const shade = 50 + Math.floor(Math.random() * 70)
    ctx.fillStyle = `rgba(${shade},${shade - 16},${shade - 38},0.14)`
    ctx.beginPath()
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // gravel speckle
  for (let i = 0; i < 5000; i++) {
    const v = Math.random()
    ctx.fillStyle = v > 0.5 ? 'rgba(40,30,18,0.5)' : 'rgba(150,128,92,0.35)'
    const s = Math.random() * 2 + 0.5
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s)
  }
  return new THREE.CanvasTexture(c)
}

// --- Perimeter chain-link fence (visual panels + posts + solid colliders) ---
function buildFence(scene, physics, half) {
  const tex = makeChainLinkTexture()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  const height = 3
  const length = half * 2

  const panelMat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    metalness: 0.3,
    roughness: 0.7,
  })
  const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.5 })
  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, height + 0.4, 8)

  const sides = [
    { x: 0, z: -half, rotY: 0 },
    { x: 0, z: half, rotY: 0 },
    { x: -half, z: 0, rotY: Math.PI / 2 },
    { x: half, z: 0, rotY: Math.PI / 2 },
  ]

  for (const s of sides) {
    const panelTex = tex.clone()
    panelTex.needsUpdate = true
    panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping
    panelTex.repeat.set(length / 2, height / 2)
    const mat = panelMat.clone()
    mat.map = panelTex

    const panel = new THREE.Mesh(new THREE.PlaneGeometry(length, height), mat)
    panel.position.set(s.x, height / 2, s.z)
    panel.rotation.y = s.rotY
    scene.add(panel)

    // posts along the run
    for (let t = -half; t <= half; t += 6) {
      const post = new THREE.Mesh(postGeo, postMat)
      if (s.rotY === 0) post.position.set(t, (height + 0.4) / 2, s.z)
      else post.position.set(s.x, (height + 0.4) / 2, t)
      post.castShadow = true
      scene.add(post)
    }

    // invisible solid wall collider so vehicles stay inside
    if (s.rotY === 0) physics.addFixedBox({ hx: half, hy: height / 2, hz: 0.3 }, { x: s.x, y: height / 2, z: s.z })
    else physics.addFixedBox({ hx: 0.3, hy: height / 2, hz: half }, { x: s.x, y: height / 2, z: s.z })
  }
}

function makeChainLinkTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(180,185,190,0.9)'
  ctx.lineWidth = 3
  // diamond mesh
  for (let i = -64; i < 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 64, 0); ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

// --- Shipping containers (static, corrugated-metal look + doors) ---
function buildContainers(scene, physics) {
  const colors = [0xb23b3b, 0x2f6fb0, 0x3a7d4a, 0xc99a2e]
  const layout = [
    { x: -40, z: -36, ry: 0, c: 0 },
    { x: -40, z: -30, ry: 0, c: 1 },
    { x: 40, z: 34, ry: Math.PI / 2, c: 2 },
    { x: 34, z: -42, ry: 0.3, c: 3 },
    { x: 48, z: 8, ry: Math.PI / 2, c: 0 },
  ]
  const w = 6, h = 2.6, d = 2.6
  const geo = new THREE.BoxGeometry(w, h, d)
  const ridge = makeCorrugationTexture()
  for (const o of layout) {
    const tex = ridge.clone()
    tex.needsUpdate = true
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(14, 1)
    const mat = new THREE.MeshStandardMaterial({
      color: colors[o.c],
      map: tex,
      roughness: 0.55,
      metalness: 0.45,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(o.x, h / 2, o.z)
    mesh.rotation.y = o.ry
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // door panel detail on one end
    const doorMat = new THREE.MeshStandardMaterial({ color: colors[o.c], roughness: 0.5, metalness: 0.5 })
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.86, d * 0.9), doorMat)
    const dx = Math.cos(o.ry) * (w / 2 + 0.02)
    const dz = -Math.sin(o.ry) * (w / 2 + 0.02)
    door.position.set(o.x + dx, h / 2, o.z + dz)
    door.rotation.y = o.ry
    scene.add(door)
    for (const off of [-0.45, 0.45]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.78, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 }))
      bar.position.set(o.x + dx + Math.cos(o.ry) * 0.04, h / 2, o.z + dz + off * Math.cos(o.ry))
      bar.rotation.y = o.ry
      scene.add(bar)
    }

    physics.addFixedBox({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x: o.x, y: h / 2, z: o.z }, quatY(o.ry))
  }
}

function makeCorrugationTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 4
  const ctx = c.getContext('2d')
  for (let i = 0; i < 32; i++) {
    const v = Math.sin((i / 32) * Math.PI * 2)
    const l = Math.round(212 + v * 43) // 169..255: bright with ridge shading
    ctx.fillStyle = `rgb(${l},${l},${l})`
    ctx.fillRect(i, 0, 1, 4)
  }
  return new THREE.CanvasTexture(c)
}

// --- Jersey barriers in a row (static) ---
function buildBarriers(scene, physics) {
  const w = 3, h = 1.1, d = 0.7
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.9 })
  const rows = [
    { x: -8, z: -28, ry: 0, n: 5 },
    { x: 30, z: 20, ry: Math.PI / 2, n: 4 },
  ]
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const off = (i - (row.n - 1) / 2) * (w + 0.1)
      const x = row.x + Math.cos(row.ry) * off
      const z = row.z + Math.sin(row.ry) * off
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, h / 2, z)
      mesh.rotation.y = row.ry
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      physics.addFixedBox({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x, y: h / 2, z }, quatY(row.ry))
    }
  }
}

// --- Site office / shed (static) ---
function buildShed(scene, physics) {
  const x = -48, z = 40
  const w = 8, h = 3.4, d = 5
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.8 })
  )
  body.position.set(x, h / 2, z)
  body.castShadow = true
  body.receiveShadow = true
  scene.add(body)

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x4a6072, roughness: 0.7, metalness: 0.3 })
  )
  roof.position.set(x, h + 0.15, z)
  roof.castShadow = true
  scene.add(roof)

  physics.addFixedBox({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x, y: h / 2, z })
}

// --- Traffic cones (dynamic & light, fun to scatter) ---
function buildCones(scene, physics) {
  const radius = 0.4, height = 1.0
  const geo = new THREE.ConeGeometry(radius, height, 14)
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 })
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f1f24, roughness: 0.8 })
  // reflective band (a short truncated cone hugging the body) + square base
  const bandGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.78, 0.16, 14)
  const baseGeo = new THREE.BoxGeometry(radius * 1.9, 0.1, radius * 1.9)

  const makeCone = () => {
    const g = new THREE.Group()
    const cone = new THREE.Mesh(geo, mat)
    cone.castShadow = true
    g.add(cone)
    const band = new THREE.Mesh(bandGeo, bandMat)
    band.position.y = 0.02
    g.add(band)
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -height / 2 + 0.05
    base.castShadow = true
    g.add(base)
    return g
  }
  const bodies = []
  // a loose scatter plus a tidy line; keep clear of the spawn area (origin)
  const spots = []
  for (let i = 0; i < 10; i++) {
    let x, z
    do {
      x = (Math.random() - 0.5) * 60
      z = (Math.random() - 0.5) * 60
    } while (Math.hypot(x, z) < 10)
    spots.push({ x, z })
  }
  for (let i = 0; i < 6; i++) spots.push({ x: -12 + i * 3, z: 10 })
  for (const s of spots) {
    const group = makeCone()
    scene.add(group)
    const body = physics.addCone(group, { halfHeight: height / 2, radius }, { x: s.x, y: height / 2, z: s.z }, { density: 6, friction: 0.6 })
    bodies.push(body)
  }
  return bodies
}

// quaternion for a yaw rotation about Y (Rapier {x,y,z,w})
function quatY(yaw) {
  const h = yaw / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}
