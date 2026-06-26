import * as THREE from 'three'
import { trackWaypoints } from './track.js'

// Builds the static jobsite from a per-level `layout`. Tracks everything it
// creates so a level can be torn down with dispose(). Textures are generated
// on a canvas (no asset files).
export function createWorld(scene, physics, layout = {}) {
  const HALF = layout.fenceHalf ?? 70
  const meshes = []
  const bodies = []
  const ctx = {
    scene,
    physics,
    addMesh(m) { m.castShadow = true; m.receiveShadow = true; scene.add(m); meshes.push(m); return m },
    addBody(half, pos, rot) { bodies.push(physics.addFixedBox(half, pos, rot)) },
  }

  buildGround(ctx, layout.groundColor ?? '#6f5736')
  for (const g of layout.grass ?? []) buildGrass(ctx, g)
  for (const r of layout.roads ?? []) buildRoad(ctx, r)
  buildFence(ctx, HALF)
  buildContainers(ctx, layout.containers ?? [])
  buildBarriers(ctx, layout.barriers ?? [])
  for (const s of layout.sheds ?? []) buildShed(ctx, s)
  for (const b of layout.buildings ?? []) buildBuilding(ctx, b)
  for (const c of layout.cranes ?? []) buildCrane(ctx, c)
  if (layout.track) buildTrack(ctx, layout.track)
  const cones = buildCones(ctx, layout.coneCount ?? 16, HALF)

  function dispose() {
    for (const m of meshes) scene.remove(m)
    for (const b of bodies) physics.remove(b)
    for (const b of cones) physics.remove(b)
  }

  return { HALF, cones, dispose }
}

// --- Ground: procedural gravel/dirt (color per level) ---
function buildGround(ctx, baseColor) {
  const tex = makeGroundTexture(baseColor)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(40, 40)
  tex.anisotropy = 8
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ctx.scene.add(ground)
  // tracked so it's swapped on level change (color differs per level)
  ctx.addMesh(ground)
}

function makeGroundTexture(baseColor) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  x.fillStyle = baseColor
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 240; i++) {
    const r = 4 + Math.random() * 26
    const shade = 30 + Math.floor(Math.random() * 45)
    x.fillStyle = `rgba(${shade},${shade - 12},${shade - 26},0.12)`
    x.beginPath()
    x.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2)
    x.fill()
  }
  for (let i = 0; i < 5000; i++) {
    // mostly dark grit; sparse, muted highlights so the dirt stays dark
    x.fillStyle = Math.random() > 0.25 ? 'rgba(22,15,8,0.45)' : 'rgba(92,74,48,0.25)'
    const s = Math.random() * 2 + 0.5
    x.fillRect(Math.random() * 256, Math.random() * 256, s, s)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace // interpret authored colors correctly
  return t
}

// --- Perimeter chain-link fence ---
function buildFence(ctx, half) {
  const tex = makeChainLinkTexture()
  const height = 3
  const length = half * 2
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.7 })
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
    ctx.scene.add(panel)
    ctx.addMesh(panel)
    for (let t = -half; t <= half; t += 6) {
      const post = new THREE.Mesh(postGeo, postMat)
      if (s.rotY === 0) post.position.set(t, (height + 0.4) / 2, s.z)
      else post.position.set(s.x, (height + 0.4) / 2, t)
      ctx.addMesh(post)
    }
    if (s.rotY === 0) ctx.addBody({ hx: half, hy: height / 2, hz: 0.3 }, { x: s.x, y: height / 2, z: s.z })
    else ctx.addBody({ hx: 0.3, hy: height / 2, hz: half }, { x: s.x, y: height / 2, z: s.z })
  }
}

function makeChainLinkTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  x.clearRect(0, 0, 64, 64)
  x.strokeStyle = 'rgba(180,185,190,0.9)'
  x.lineWidth = 3
  for (let i = -64; i < 128; i += 16) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke()
    x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke()
  }
  return new THREE.CanvasTexture(c)
}

// --- Shipping containers ---
function buildContainers(ctx, layout) {
  const colors = [0xb23b3b, 0x2f6fb0, 0x3a7d4a, 0xc99a2e]
  const w = 6, h = 2.6, d = 2.6
  const geo = new THREE.BoxGeometry(w, h, d)
  const ridge = makeCorrugationTexture()
  for (const o of layout) {
    const tex = ridge.clone()
    tex.needsUpdate = true
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(14, 1)
    const mat = new THREE.MeshStandardMaterial({ color: colors[o.c % colors.length], map: tex, roughness: 0.55, metalness: 0.45 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(o.x, h / 2, o.z)
    mesh.rotation.y = o.ry
    ctx.addMesh(mesh)
    const doorMat = new THREE.MeshStandardMaterial({ color: colors[o.c % colors.length], roughness: 0.5, metalness: 0.5 })
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.86, d * 0.9), doorMat)
    const dx = Math.cos(o.ry) * (w / 2 + 0.02)
    const dz = -Math.sin(o.ry) * (w / 2 + 0.02)
    door.position.set(o.x + dx, h / 2, o.z + dz)
    door.rotation.y = o.ry
    ctx.addMesh(door)
    ctx.addBody({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x: o.x, y: h / 2, z: o.z }, quatY(o.ry))
  }
}

function makeCorrugationTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 4
  const x = c.getContext('2d')
  for (let i = 0; i < 32; i++) {
    const v = Math.sin((i / 32) * Math.PI * 2)
    const l = Math.round(212 + v * 43)
    x.fillStyle = `rgb(${l},${l},${l})`
    x.fillRect(i, 0, 1, 4)
  }
  return new THREE.CanvasTexture(c)
}

// --- Jersey barriers ---
function buildBarriers(ctx, rows) {
  const w = 3, h = 1.1, d = 0.7
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.9 })
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const off = (i - (row.n - 1) / 2) * (w + 0.1)
      const x = row.x + Math.cos(row.ry) * off
      const z = row.z + Math.sin(row.ry) * off
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, h / 2, z)
      mesh.rotation.y = row.ry
      ctx.addMesh(mesh)
      ctx.addBody({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x, y: h / 2, z }, quatY(row.ry))
    }
  }
}

// --- Site office / shed ---
function buildShed(ctx, { x, z }) {
  const w = 8, h = 3.4, d = 5
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.8 }))
  body.position.set(x, h / 2, z)
  ctx.addMesh(body)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4), new THREE.MeshStandardMaterial({ color: 0x4a6072, roughness: 0.7, metalness: 0.3 }))
  roof.position.set(x, h + 0.15, z)
  ctx.addMesh(roof)
  ctx.addBody({ hx: w / 2, hy: h / 2, hz: d / 2 }, { x, y: h / 2, z })
}

// --- Traffic cones (dynamic, fun to scatter) ---
function buildCones(ctx, count, half) {
  const radius = 0.4, height = 1.0
  const geo = new THREE.ConeGeometry(radius, height, 14)
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 })
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f1f24, roughness: 0.8 })
  const bandGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.78, 0.16, 14)
  const baseGeo = new THREE.BoxGeometry(radius * 1.9, 0.1, radius * 1.9)
  const range = Math.min(half - 8, 60)
  const bodies = []
  for (let i = 0; i < count; i++) {
    let x, z
    do {
      x = (Math.random() - 0.5) * range * 2
      z = (Math.random() - 0.5) * range * 2
    } while (Math.hypot(x, z) < 10)
    const g = new THREE.Group()
    const cone = new THREE.Mesh(geo, mat); cone.castShadow = true; g.add(cone)
    const band = new THREE.Mesh(bandGeo, bandMat); band.position.y = 0.02; g.add(band)
    const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = -height / 2 + 0.05; base.castShadow = true; g.add(base)
    ctx.addMesh(g) // scene + tracked for disposal
    bodies.push(ctx.physics.addCone(g, { halfHeight: height / 2, radius }, { x, y: height / 2, z }, { density: 6, friction: 0.6 }))
  }
  return bodies
}

// --- Multi-story building under construction (solid base + framed floors) ---
function buildBuilding(ctx, b) {
  const { x, z, w = 10, d = 10, floors = 3, rot = 0 } = b
  const fh = 3.2
  const conc = new THREE.MeshStandardMaterial({ color: b.color ?? 0x9a9a93, roughness: 0.92 })
  const q = quatY(rot)
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const place = (lx, lz) => ({ x: x + lx * cos - lz * sin, z: z + lx * sin + lz * cos })

  // solid ground story (this is what the vehicle collides with)
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), conc)
  base.position.set(x, fh / 2, z)
  base.rotation.y = rot
  ctx.addMesh(base)
  ctx.addBody({ hx: w / 2, hy: fh / 2, hz: d / 2 }, { x, y: fh / 2, z }, q)

  // framed upper floors: perimeter columns + a slab
  const colGeo = new THREE.BoxGeometry(0.5, fh, 0.5)
  const colsX = [-w / 2 + 0.5, 0, w / 2 - 0.5]
  const colsZ = [-d / 2 + 0.5, 0, d / 2 - 0.5]
  for (let f = 1; f < floors; f++) {
    const y0 = f * fh
    for (const lx of colsX) {
      for (const lz of colsZ) {
        if (lx === 0 && lz === 0) continue // skip center
        const p = place(lx, lz)
        const col = new THREE.Mesh(colGeo, conc)
        col.position.set(p.x, y0 + fh / 2, p.z)
        col.rotation.y = rot
        ctx.addMesh(col)
      }
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), conc)
    slab.position.set(x, y0 + fh, z)
    slab.rotation.y = rot
    ctx.addMesh(slab)
  }
}

// --- Tower crane (decorative; collider on the mast base) ---
function buildCrane(ctx, c) {
  const { x, z, h = 22, jib = 18, rot = 0 } = c
  const yellow = new THREE.MeshStandardMaterial({ color: 0xfec810, roughness: 0.5, metalness: 0.3 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 })
  const cos = Math.cos(rot), sin = Math.sin(rot)

  const basePad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4), dark)
  basePad.position.set(x, 0.5, z)
  ctx.addMesh(basePad)
  ctx.addBody({ hx: 1.2, hy: 1.5, hz: 1.2 }, { x, y: 1.5, z })

  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), yellow)
  mast.position.set(x, h / 2 + 1, z)
  ctx.addMesh(mast)

  const topY = h + 1
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), yellow)
  cab.position.set(x, topY, z)
  ctx.addMesh(cab)

  // jib (long) + counter-jib (short with counterweight), rotated about Y
  const jibMesh = new THREE.Mesh(new THREE.BoxGeometry(jib, 0.5, 0.6), yellow)
  jibMesh.position.set(x + cos * (jib / 2 - 0.5), topY + 0.6, z + sin * (jib / 2 - 0.5))
  jibMesh.rotation.y = rot
  ctx.addMesh(jibMesh)
  const cj = 6
  const counter = new THREE.Mesh(new THREE.BoxGeometry(cj, 0.5, 0.6), yellow)
  counter.position.set(x - cos * (cj / 2), topY + 0.6, z - sin * (cj / 2))
  counter.rotation.y = rot
  ctx.addMesh(counter)
  const cw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), dark)
  cw.position.set(x - cos * cj, topY + 0.4, z - sin * cj)
  ctx.addMesh(cw)
  // hook hanging from near the jib end
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), dark)
  hook.position.set(x + cos * (jib - 3), topY - 0.5, z + sin * (jib - 3))
  ctx.addMesh(hook)
}

// --- Oval race circuit: asphalt segments + jersey-barrier guardrails ---
function buildTrack(ctx, spec) {
  const n = spec.segments ?? 40
  const width = spec.width ?? 14
  const pts = trackWaypoints(spec, n)
  const cx = spec.cx ?? 0, cz = spec.cz ?? 0
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.95 })
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.9 })
  const off = width / 2 + 0.7

  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const yaw = Math.atan2(dx, dz)
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2

    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, len + 0.6), asphalt)
    seg.rotation.x = -Math.PI / 2
    seg.rotation.z = yaw
    seg.position.set(mx, 0.02, mz)
    seg.receiveShadow = true
    ctx.addMesh(seg)

    // guardrails offset to inner & outer edges, following the curve
    const nx = mx - cx, nz = mz - cz
    const nl = Math.hypot(nx, nz) || 1
    const ux = nx / nl, uz = nz / nl
    for (const s of [-1, 1]) {
      const bx = mx + ux * off * s
      const bz = mz + uz * off * s
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, len + 0.4), barrierMat)
      bar.position.set(bx, 0.55, bz)
      bar.rotation.y = yaw
      ctx.addMesh(bar)
      ctx.addBody({ hx: 0.3, hy: 0.55, hz: (len + 0.4) / 2 }, { x: bx, y: 0.55, z: bz }, quatY(yaw))
    }
  }

  // start/finish line: checkered stripe across the track at waypoint 0
  const startYaw = Math.atan2(pts[1].x - pts[0].x, pts[1].z - pts[0].z)
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 2.2),
    new THREE.MeshStandardMaterial({ map: makeCheckerTexture(), roughness: 0.8 })
  )
  stripe.rotation.x = -Math.PI / 2
  stripe.rotation.z = startYaw
  stripe.position.set(pts[0].x, 0.04, pts[0].z)
  ctx.addMesh(stripe)
}

function makeCheckerTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      x.fillStyle = (i + j) % 2 ? '#fff' : '#111'
      x.fillRect(i * 8, j * 8, 8, 8)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(8, 1)
  return t
}

// --- Grass area (visual only, sits just above the dirt) ---
function buildGrass(ctx, g) {
  const { x = 0, z = 0, w = 20, d = 20, rot = 0 } = g
  const tex = makeGrassTexture()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(Math.max(2, w / 6), Math.max(2, d / 6))
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  )
  grass.rotation.x = -Math.PI / 2
  grass.rotation.z = rot
  grass.position.set(x, 0.015, z)
  grass.receiveShadow = true
  ctx.addMesh(grass)
}

function makeGrassTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  x.fillStyle = '#2f7d1f'
  x.fillRect(0, 0, 128, 128)
  // mottled patches
  for (let i = 0; i < 120; i++) {
    const g = 110 + Math.floor(Math.random() * 80)
    x.fillStyle = `rgba(${g - 60},${g},${g - 70},0.2)`
    x.beginPath()
    x.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 12, 0, Math.PI * 2)
    x.fill()
  }
  // blade speckle
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = Math.random() > 0.5 ? 'rgba(24,72,18,0.5)' : 'rgba(120,195,70,0.5)'
    x.fillRect(Math.random() * 128, Math.random() * 128, 1, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// --- Asphalt roadway with dashed center line (visual only) ---
function buildRoad(ctx, r) {
  const { x = 0, z = 0, w = 10, l = 120, rot = 0 } = r
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.95 })
  )
  road.rotation.x = -Math.PI / 2
  road.rotation.z = rot
  road.position.set(x, 0.02, z)
  road.receiveShadow = true
  ctx.addMesh(road)
  // dashed center line
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2c43a, roughness: 0.8 })
  const cos = Math.cos(rot), sin = Math.sin(rot)
  for (let t = -l / 2 + 3; t < l / 2; t += 7) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), dashMat)
    dash.rotation.x = -Math.PI / 2
    dash.rotation.z = rot
    dash.position.set(x + -sin * t, 0.03, z + cos * t)
    ctx.addMesh(dash)
  }
}

function quatY(yaw) {
  const h = yaw / 2
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}
