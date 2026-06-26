import * as THREE from 'three'

// Data-driven vehicle definitions. Adding a machine = adding a config entry.
// Forward is +Z in chassis-local space. Dimensions are full (not half) extents.
// Shared physics base; each vehicle overrides colors, size, handling, look.
const BASE = {
  bodyScale: 0.94,
  chassis: { w: 2.6, h: 1.0, l: 4.2 },
  mass: 2200,
  linearDamping: 0.18,
  angularDamping: 0.6,
  engineForce: 3400,
  maxSpeed: 28,
  reverseFactor: 0.5,
  brakeForce: 140,
  rollingBrake: 8,
  maxSteer: 0.55,
  steerSpeed: 3.5,
  wheel: { radius: 0.62, width: 0.5, offsetX: 1.05, offsetZ: 1.45, offsetY: -0.45 },
  suspension: { restLength: 0.45, stiffness: 28, compression: 0.85, relaxation: 0.9, maxTravel: 0.35, maxForce: 60000 },
  frictionSlip: 2.2,
  sideFriction: 0.6,
  locomotion: 'tracks', // 'tracks' | 'wheels'
  frontTool: false, // adds a ground-reaching pusher collider (blade/bucket)
}

export const VEHICLE_CONFIGS = {
  bulldozer: { ...BASE, name: 'Bulldozer', bodyColor: 0xfec810, accentColor: 0x23262b, build: 'bulldozer', locomotion: 'tracks', frontTool: true },
  excavator: { ...BASE, name: 'Excavator', bodyColor: 0xf2a01c, accentColor: 0x2a2a2a, build: 'excavator', locomotion: 'tracks', maxSpeed: 18, engineForce: 3000 },
  dumptruck: {
    ...BASE, name: 'Dump Truck', bodyColor: 0xe6a417, accentColor: 0x2a2a2a, build: 'dumptruck',
    locomotion: 'wheels', bodyScale: 1.05, mass: 3000, maxSpeed: 26, engineForce: 4200, maxSteer: 0.5,
    wheel: { radius: 0.78, width: 0.55, offsetX: 1.15, offsetZ: 1.55, offsetY: -0.4 },
  },
  loader: {
    ...BASE, name: 'Wheel Loader', bodyColor: 0xfec810, accentColor: 0x2a2a2a, build: 'loader',
    locomotion: 'wheels', frontTool: true, maxSpeed: 24, engineForce: 3600,
    wheel: { radius: 0.82, width: 0.6, offsetX: 1.1, offsetZ: 1.4, offsetY: -0.38 },
  },
}

// Cycle order for the switch key.
export const VEHICLE_ORDER = ['bulldozer', 'excavator', 'dumptruck', 'loader']

const DOWN = { x: 0, y: -1, z: 0 }
const AXLE = { x: -1, y: 0, z: 0 }

export class Vehicle {
  constructor(scene, physics, configKey, spawn = { x: 0, y: 1.8, z: 0 }) {
    this.scene = scene
    this.physics = physics
    this.configKey = configKey
    this.config = VEHICLE_CONFIGS[configKey]
    this.steer = 0
    this._fwd = new THREE.Vector3()

    const { RAPIER, world } = physics
    const cfg = this.config
    const c = cfg.chassis
    const scale = cfg.bodyScale ?? 1
    this.scale = scale

    // --- Chassis rigid body ---
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setCanSleep(false)
      .setLinearDamping(cfg.linearDamping)
      .setAngularDamping(cfg.angularDamping)
    this.body = world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc.cuboid((c.w / 2) * scale, (c.h / 2) * scale, (c.l / 2) * scale)
      .setMass(cfg.mass)
      .setFriction(0.5)
      .setRestitution(0.05)
    world.createCollider(colliderDesc, this.body)

    // Front-tool collider (blade/bucket): reaches the ground so it pushes low
    // objects. Zero density => no added mass / unchanged handling; low friction
    // so it skims the ground. Only on machines with a front tool.
    if (cfg.frontTool) {
      const bladeDesc = RAPIER.ColliderDesc.cuboid(1.3 * scale, 0.65 * scale, 0.16 * scale)
        .setTranslation(0, -0.49 * scale, 2.2 * scale)
        .setDensity(0)
        .setFriction(0.1)
        .setRestitution(0)
      world.createCollider(bladeDesc, this.body)
    }

    // --- Visuals (block-out primitives) ---
    this.root = new THREE.Group()
    this.root.scale.setScalar(scale)
    scene.add(this.root)
    this._buildVisuals()

    // --- Raycast vehicle controller ---
    this.controller = world.createVehicleController(this.body)
    this.controller.indexUpAxis = 1
    this.controller.setIndexForwardAxis = 2

    const w = cfg.wheel
    // order: FL, FR, RL, RR  (front wheels steer)
    this.wheelInfo = [
      { x: -w.offsetX * scale, z: w.offsetZ * scale, steered: true },
      { x: w.offsetX * scale, z: w.offsetZ * scale, steered: true },
      { x: -w.offsetX * scale, z: -w.offsetZ * scale, steered: false },
      { x: w.offsetX * scale, z: -w.offsetZ * scale, steered: false },
    ]

    this.wheelMeshes = []
    this.wheelInfo.forEach((info) => {
      const connection = { x: info.x, y: w.offsetY * scale, z: info.z }
      this.controller.addWheel(connection, DOWN, AXLE, cfg.suspension.restLength * scale, w.radius * scale)
      const i = this.controller.numWheels() - 1
      const s = cfg.suspension
      this.controller.setWheelSuspensionStiffness(i, s.stiffness)
      this.controller.setWheelSuspensionCompression(i, s.compression)
      this.controller.setWheelSuspensionRelaxation(i, s.relaxation)
      this.controller.setWheelMaxSuspensionTravel(i, s.maxTravel * scale)
      this.controller.setWheelMaxSuspensionForce(i, s.maxForce)
      this.controller.setWheelFrictionSlip(i, cfg.frictionSlip)
      this.controller.setWheelSideFrictionStiffness(i, cfg.sideFriction)
      // Visual pivot lives in unscaled root space (root is scaled by `scale`).
      this._buildWheelMesh({ x: info.x / scale, y: w.offsetY, z: info.z / scale })
    })

    // Apply controls + integrate the vehicle every physics step.
    this._offStep = physics.onBeforeStep((dt) => this._update(dt))
  }

  // Tear down for vehicle switching: stop updating, remove body + visuals.
  destroy() {
    if (this._offStep) this._offStep()
    try { this.physics.world.removeVehicleController(this.controller) } catch {}
    this.physics.world.removeRigidBody(this.body)
    this.scene.remove(this.root)
  }

  // Shared mesh helpers for all builders.
  _box(w, h, l) {
    return new THREE.BoxGeometry(w, h, l)
  }

  _add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = this._mkMesh(geo, mat, x, y, z, rx, ry, rz)
    this.root.add(m)
    return m
  }

  // Build materials, the locomotion base (tracks or nothing — wheels are
  // created in the constructor's wheel loop), then the per-vehicle body.
  _buildVisuals() {
    const cfg = this.config
    this._mats = {
      yellow: new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.5, metalness: 0.25 }),
      dark: new THREE.MeshStandardMaterial({ color: cfg.accentColor, roughness: 0.7, metalness: 0.4 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 }),
      bladeMat: new THREE.MeshStandardMaterial({ color: 0xf2b400, roughness: 0.45, metalness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x121a22, roughness: 0.15, metalness: 0.5 }),
    }
    if (cfg.locomotion === 'tracks') this._buildTracksBase()

    const builders = { bulldozer: '_buildBulldozer', excavator: '_buildExcavator', dumptruck: '_buildDumpTruck', loader: '_buildLoader' }
    this[builders[cfg.build]]()
  }

  _buildTracksBase() {
    this.tracks = []
    this.trackPhase = 0
    this._trackParams = { cy: -0.62, rEnd: 0.42, L: 4.0, zc: -0.1 }
    this._trackParams.P = 2 * this._trackParams.L + 2 * Math.PI * this._trackParams.rEnd
    this.shoeMats = [
      new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.7, metalness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.8, metalness: 0.4 }),
    ]
    this._buildTrack(-1.18)
    this._buildTrack(1.18)
    this._updateTracks()
    this._add(this._box(2.0, 0.5, 3.6), this._mats.dark, 0, -0.5, -0.1) // belly pan
  }

  // Caterpillar D-series: sloped hood, ROPS cab, U-blade + push arms, ripper.
  _buildBulldozer() {
    const { yellow, dark, steel, bladeMat, glass } = this._mats
    const add = (...a) => this._add(...a)
    const box = (w, h, l) => this._box(w, h, l)

    // === Main body / engine hood (sloped down toward front) ===
    add(box(2.0, 0.85, 1.9), yellow, 0, 0.2, -0.3) // engine block
    add(box(1.8, 0.6, 1.4), yellow, 0, 0.0, 1.05, -0.14) // sloped hood
    add(box(1.86, 0.5, 0.12), dark, 0, 0.02, 1.72, -0.14) // front grille
    // side fenders along the hood
    add(box(0.12, 0.35, 2.6), yellow, 1.0, 0.45, 0.2)
    add(box(0.12, 0.35, 2.6), yellow, -1.0, 0.45, 0.2)

    // === ROPS cab toward the rear ===
    add(box(1.7, 0.12, 1.6), dark, 0, 0.55, -0.9) // cab floor
    // corner ROPS posts
    for (const sx of [-0.78, 0.78]) {
      for (const sz of [-0.62, 0.62]) add(box(0.13, 1.0, 0.13), dark, sx, 1.05, -0.9 + sz)
    }
    add(box(1.74, 0.14, 1.64), dark, 0, 1.6, -0.9) // cab roof
    // glass panels
    add(box(1.5, 0.85, 0.06), glass, 0, 1.08, -0.18) // front windshield
    add(box(0.06, 0.85, 1.4), glass, 0.82, 1.08, -0.9) // right window
    add(box(0.06, 0.85, 1.4), glass, -0.82, 1.08, -0.9) // left window
    add(box(1.5, 0.85, 0.06), glass, 0, 1.08, -1.62) // rear window

    // seat hint
    add(box(0.5, 0.5, 0.5), dark, 0, 0.85, -0.7)

    // === Exhaust stack ===
    add(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 10), dark, 0.62, 0.95, 0.55)
    add(new THREE.CylinderGeometry(0.13, 0.1, 0.18, 10), steel, 0.62, 1.5, 0.55)

    // === U-blade with push arms (reaches down to the ground) ===
    const blade = new THREE.Group()
    blade.add(this._mkMesh(box(2.9, 1.4, 0.18), bladeMat, 0, 0, 0))
    blade.add(this._mkMesh(box(2.9, 0.3, 0.4), bladeMat, 0, 0.65, 0.16, -0.5)) // top spill lip
    blade.add(this._mkMesh(box(2.9, 0.2, 0.34), steel, 0, -0.7, 0.12, 0.4)) // cutting edge
    blade.add(this._mkMesh(box(0.18, 1.35, 0.2), bladeMat, 1.35, 0, 0.12, 0, 0.35)) // right wing
    blade.add(this._mkMesh(box(0.18, 1.35, 0.2), bladeMat, -1.35, 0, 0.12, 0, -0.35)) // left wing
    blade.position.set(0, -0.53, 2.45)
    this.root.add(blade)
    // push arms from hull to blade
    const arm = new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8)
    add(arm, dark, 0.95, -0.4, 1.5, Math.PI / 2 - 0.32, 0, 0)
    add(arm, dark, -0.95, -0.4, 1.5, Math.PI / 2 - 0.32, 0, 0)

    // === Rear ripper ===
    add(box(1.6, 0.25, 0.3), yellow, 0, -0.1, -2.2) // ripper beam
    add(box(0.18, 0.9, 0.18), dark, 0.5, -0.55, -2.35, 0.25, 0, 0) // shank
    add(box(0.18, 0.9, 0.18), dark, -0.5, -0.55, -2.35, 0.25, 0, 0)
    add(new THREE.ConeGeometry(0.12, 0.4, 6), steel, 0.5, -1.05, -2.45, Math.PI, 0, 0) // tip
    add(new THREE.ConeGeometry(0.12, 0.4, 6), steel, -0.5, -1.05, -2.45, Math.PI, 0, 0)
  }

  // Tracked excavator: slewing house, counterweight, cab, and a boom arm.
  _buildExcavator() {
    const { yellow, dark, steel, glass } = this._mats
    const add = (...a) => this._add(...a)
    const box = (w, h, l) => this._box(w, h, l)

    // upper house on top of the tracks
    add(box(2.4, 0.9, 2.8), yellow, 0, 0.35, -0.3)
    add(box(2.5, 1.0, 0.8), dark, 0, 0.4, -1.7) // rear counterweight
    add(box(1.9, 0.5, 1.0), dark, 0, 0.95, -0.9) // engine cowling

    // operator cab (left-front)
    add(box(1.0, 1.15, 1.25), dark, -0.62, 1.05, 0.45)
    add(box(0.9, 0.85, 0.05), glass, -0.62, 1.12, 1.08) // windshield
    add(box(0.05, 0.85, 1.1), glass, -1.08, 1.12, 0.45) // side glass

    // boom + stick + bucket (static rest pose, reaching forward to the ground)
    add(box(0.42, 0.42, 2.8), yellow, 0.45, 1.25, 1.7, -0.6, 0, 0) // boom: rises up-forward
    add(box(0.34, 0.34, 2.2), yellow, 0.45, 1.5, 3.5, 0.85, 0, 0) // stick: angles down-forward
    add(box(0.85, 0.7, 0.8), steel, 0.45, 0.45, 4.2, 0.3, 0, 0) // bucket
    add(box(0.85, 0.18, 0.55), dark, 0.45, 0.12, 4.45) // bucket teeth
  }

  // Wheeled dump truck: low chassis, forward cab, big rear dump bed.
  _buildDumpTruck() {
    const { yellow, dark, steel, glass } = this._mats
    const add = (...a) => this._add(...a)
    const box = (w, h, l) => this._box(w, h, l)

    add(box(2.2, 0.4, 4.6), dark, 0, -0.25, 0) // chassis frame
    // cab + hood at the front
    add(box(2.0, 1.25, 1.2), yellow, 0, 0.5, 1.45)
    add(box(1.85, 0.7, 0.05), glass, 0, 0.7, 2.06) // windshield
    add(box(2.0, 0.55, 0.9), yellow, 0, 0.0, 2.5) // hood
    add(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), dark, 0.85, 0.95, 0.95) // exhaust stack
    // dump bed (open box)
    const bedMat = steel
    add(box(2.3, 0.12, 3.0), bedMat, 0, 0.1, -1.0) // bed floor
    add(box(2.3, 0.9, 0.12), bedMat, 0, 0.55, -2.45) // tailgate
    add(box(0.12, 0.9, 3.0), bedMat, 1.1, 0.55, -1.0) // right wall
    add(box(0.12, 0.9, 3.0), bedMat, -1.1, 0.55, -1.0) // left wall
    add(box(2.3, 0.9, 0.12), yellow, 0, 0.55, 0.45) // headboard
  }

  // Wheeled loader: rear engine + front body, cab, lift arms + bucket.
  _buildLoader() {
    const { yellow, dark, steel, glass } = this._mats
    const add = (...a) => this._add(...a)
    const box = (w, h, l) => this._box(w, h, l)

    add(box(2.0, 1.1, 1.9), yellow, 0, 0.35, -1.2) // rear engine body
    add(box(1.9, 0.95, 1.7), yellow, 0, 0.3, 0.6) // front body
    add(box(0.7, 0.9, 0.4), dark, 0, 0.3, -0.25) // articulation joint
    // cab
    add(box(1.5, 1.0, 1.3), dark, 0, 1.05, -0.7)
    add(box(1.4, 0.7, 0.05), glass, 0, 1.1, -0.05)
    add(box(0.05, 0.7, 1.1), glass, 0.72, 1.1, -0.7)
    add(box(0.05, 0.7, 1.1), glass, -0.72, 1.1, -0.7)
    // lift arms + bucket (front tool)
    add(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), yellow, 0.7, 0.2, 1.5, Math.PI / 2 - 0.2, 0, 0)
    add(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), yellow, -0.7, 0.2, 1.5, Math.PI / 2 - 0.2, 0, 0)
    add(box(2.4, 0.85, 0.25), steel, 0, -0.25, 2.55, 0.35, 0, 0) // bucket back
    add(box(2.4, 0.2, 0.8), steel, 0, -0.6, 2.7) // bucket floor
    add(box(2.4, 0.12, 0.3), dark, 0, -0.62, 3.05) // cutting edge
  }

  _mkMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }

  // One crawler track assembly: inner frame, idler/sprocket, road wheels, and
  // a loop of grouser shoes that travel around the track as it drives.
  _buildTrack(sx) {
    const add = (...a) => this._add(...a)
    const dark = this._mats.dark
    const { cy, L } = this._trackParams
    const w = 0.6
    // inner frame
    add(new THREE.BoxGeometry(w * 0.7, 0.7, L), dark, sx, cy, -0.1)
    // idler (front) + sprocket (rear)
    const endGeo = new THREE.CylinderGeometry(0.42, 0.42, w + 0.02, 16)
    endGeo.rotateZ(Math.PI / 2)
    add(endGeo, dark, sx, cy, L / 2 - 0.1)
    add(endGeo, dark, sx, cy, -L / 2 - 0.1)
    // road wheels
    const rwGeo = new THREE.CylinderGeometry(0.24, 0.24, w + 0.04, 12)
    rwGeo.rotateZ(Math.PI / 2)
    for (let i = 0; i < 4; i++) add(rwGeo, dark, sx, cy - 0.18, -1.35 + i * 0.9)

    // grouser shoes around the loop
    const N = 18
    const shoeGeo = new THREE.BoxGeometry(w + 0.12, 0.14, 0.34)
    const shoes = []
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(shoeGeo, this.shoeMats[i % 2])
      m.castShadow = true
      this.root.add(m)
      shoes.push(m)
    }
    this.tracks.push({ sx, shoes })
  }

  // Position one point along the stadium-shaped track loop (track-local).
  _trackPoint(s, sx) {
    const { cy, rEnd, L, zc, P } = this._trackParams
    s = ((s % P) + P) % P
    if (s < L) return { x: sx, y: cy + rEnd, z: zc - L / 2 + s } // top run
    s -= L
    if (s < Math.PI * rEnd) {
      const a = s / rEnd
      return { x: sx, y: cy + rEnd * Math.cos(a), z: zc + L / 2 + rEnd * Math.sin(a) } // front
    }
    s -= Math.PI * rEnd
    if (s < L) return { x: sx, y: cy - rEnd, z: zc + L / 2 - s } // bottom run
    s -= L
    const a = s / rEnd
    return { x: sx, y: cy - rEnd * Math.cos(a), z: zc - L / 2 - rEnd * Math.sin(a) } // rear
  }

  _updateTracks() {
    const { P } = this._trackParams
    for (const t of this.tracks) {
      const n = t.shoes.length
      for (let i = 0; i < n; i++) {
        const p = this._trackPoint(this.trackPhase + (i * P) / n, t.sx)
        t.shoes[i].position.set(p.x, p.y, p.z)
      }
    }
  }

  _buildWheelMesh(connection) {
    // Wheeled machines show real spinning wheels; tracked machines hide these
    // (the crawler shoes represent the machine instead).
    const w = this.config.wheel
    const visible = this.config.locomotion === 'wheels'
    const geo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, visible ? 18 : 6)
    geo.rotateZ(Math.PI / 2)
    const tire = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.9 }))
    tire.visible = visible
    tire.castShadow = visible

    if (visible) {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(w.radius * 0.45, w.radius * 0.45, w.width + 0.02, 10),
        new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.4 })
      )
      hub.geometry.rotateZ(Math.PI / 2)
      tire.add(hub)
    }

    const pivot = new THREE.Group()
    pivot.position.set(connection.x, connection.y, connection.z)
    pivot.add(tire)
    this.root.add(pivot)
    this.wheelMeshes.push({ pivot, mesh: tire })
  }

  _update(dt) {
    const cfg = this.config
    const input = this.input || {}

    // --- Steering: ease toward target for a smoother feel ---
    // Chase cam looks along +Z, so screen-right maps to world -X.
    let targetSteer = 0
    if (input.left) targetSteer += cfg.maxSteer
    if (input.right) targetSteer -= cfg.maxSteer
    const k = Math.min(1, cfg.steerSpeed * dt)
    this.steer += (targetSteer - this.steer) * k

    // --- Throttle / brake ---
    // currentVehicleSpeed is signed along the forward axis (+ = forward).
    const speed = this.controller.currentVehicleSpeed()
    let engine = 0
    if (input.forward) engine = cfg.engineForce
    else if (input.backward) engine = -cfg.engineForce * cfg.reverseFactor

    // Cap top speed: cut drive once we're at the limit in that direction.
    if (engine > 0 && speed > cfg.maxSpeed) engine = 0
    if (engine < 0 && speed < -cfg.maxSpeed * cfg.reverseFactor) engine = 0

    let brake = cfg.rollingBrake
    if (input.brake) brake = cfg.brakeForce
    if (engine !== 0) brake = 0

    for (let i = 0; i < this.controller.numWheels(); i++) {
      const steered = this.wheelInfo[i].steered
      this.controller.setWheelSteering(i, steered ? this.steer : 0)
      this.controller.setWheelEngineForce(i, engine) // all-wheel drive
      this.controller.setWheelBrake(i, brake)
    }

    this.controller.updateVehicle(dt)
  }

  // Sync visuals after world.step(); called from the render loop.
  syncMeshes() {
    const t = this.body.translation()
    const r = this.body.rotation()
    this.root.position.set(t.x, t.y, t.z)
    this.root.quaternion.set(r.x, r.y, r.z, r.w)

    if (this.config.locomotion === 'wheels') {
      const w = this.config.wheel
      const restLocal = this.config.suspension.restLength
      for (let i = 0; i < this.wheelMeshes.length; i++) {
        const { pivot, mesh } = this.wheelMeshes[i]
        let len = this.controller.wheelSuspensionLength(i) / this.scale
        if (!Number.isFinite(len)) len = restLocal
        pivot.position.y = w.offsetY - len
        pivot.rotation.y = this.controller.wheelSteering(i) || 0
        mesh.rotation.x = this.controller.wheelRotation(i) || 0
      }
    } else {
      // Travel the grouser shoes around the loop at ground speed.
      this.trackPhase += this.controller.currentVehicleSpeed() / 60
      this._updateTracks()
    }
  }

  setInput(input) {
    this.input = input
  }

  // Teleport back to a spawn point, upright and stationary.
  reset(spawn) {
    this.body.setTranslation(spawn, true)
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.steer = 0
  }

  // World-space forward direction (+Z local), for the chase camera.
  getForwardDirection() {
    const r = this.body.rotation()
    this._fwd.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
    return this._fwd
  }

  getPosition() {
    return this.body.translation()
  }

  getSpeed() {
    return this.controller.currentVehicleSpeed()
  }
}

