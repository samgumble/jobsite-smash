import * as THREE from 'three'

// Data-driven vehicle definitions. Adding a machine = adding a config entry.
// Forward is +Z in chassis-local space. Dimensions are full (not half) extents.
export const VEHICLE_CONFIGS = {
  bulldozer: {
    name: 'Bulldozer',
    bodyColor: 0xf2b134,
    accentColor: 0x3a3a42,
    chassis: { w: 2.6, h: 1.0, l: 4.2 },
    mass: 2200,
    linearDamping: 0.4,
    angularDamping: 0.6,
    engineForce: 2600, // drive force per driven wheel
    maxSpeed: 20, // m/s forward cap (~72 km/h); reverse uses reverseFactor
    reverseFactor: 0.5,
    brakeForce: 140,
    rollingBrake: 8, // gentle auto-brake when coasting
    maxSteer: 0.55, // radians
    steerSpeed: 3.5, // how fast steering eases toward target
    wheel: {
      radius: 0.62,
      width: 0.5,
      // connection points relative to chassis center (x: right, y: up, z: fwd)
      offsetX: 1.05,
      offsetZ: 1.45,
      offsetY: -0.45,
    },
    suspension: {
      restLength: 0.45,
      stiffness: 28,
      compression: 0.85,
      relaxation: 0.9,
      maxTravel: 0.35,
      maxForce: 60000,
    },
    frictionSlip: 2.2,
    sideFriction: 0.6,
  },
}

const DOWN = { x: 0, y: -1, z: 0 }
const AXLE = { x: -1, y: 0, z: 0 }

export class Vehicle {
  constructor(scene, physics, configKey, spawn = { x: 0, y: 1.8, z: 0 }) {
    this.physics = physics
    this.config = VEHICLE_CONFIGS[configKey]
    this.steer = 0
    this._fwd = new THREE.Vector3()

    const { RAPIER, world } = physics
    const cfg = this.config
    const c = cfg.chassis

    // --- Chassis rigid body ---
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setCanSleep(false)
      .setLinearDamping(cfg.linearDamping)
      .setAngularDamping(cfg.angularDamping)
    this.body = world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc.cuboid(c.w / 2, c.h / 2, c.l / 2)
      .setMass(cfg.mass)
      .setFriction(0.5)
      .setRestitution(0.05)
    world.createCollider(colliderDesc, this.body)

    // --- Visuals (block-out primitives) ---
    this.root = new THREE.Group()
    scene.add(this.root)
    this._buildVisuals()

    // --- Raycast vehicle controller ---
    this.controller = world.createVehicleController(this.body)
    this.controller.indexUpAxis = 1
    this.controller.setIndexForwardAxis = 2

    const w = cfg.wheel
    // order: FL, FR, RL, RR  (front wheels steer)
    this.wheelInfo = [
      { x: -w.offsetX, z: w.offsetZ, steered: true },
      { x: w.offsetX, z: w.offsetZ, steered: true },
      { x: -w.offsetX, z: -w.offsetZ, steered: false },
      { x: w.offsetX, z: -w.offsetZ, steered: false },
    ]

    this.wheelMeshes = []
    this.wheelInfo.forEach((info) => {
      const connection = { x: info.x, y: w.offsetY, z: info.z }
      this.controller.addWheel(connection, DOWN, AXLE, cfg.suspension.restLength, w.radius)
      const i = this.controller.numWheels() - 1
      const s = cfg.suspension
      this.controller.setWheelSuspensionStiffness(i, s.stiffness)
      this.controller.setWheelSuspensionCompression(i, s.compression)
      this.controller.setWheelSuspensionRelaxation(i, s.relaxation)
      this.controller.setWheelMaxSuspensionTravel(i, s.maxTravel)
      this.controller.setWheelMaxSuspensionForce(i, s.maxForce)
      this.controller.setWheelFrictionSlip(i, cfg.frictionSlip)
      this.controller.setWheelSideFrictionStiffness(i, cfg.sideFriction)
      this._buildWheelMesh(connection)
    })

    // Apply controls + integrate the vehicle every physics step.
    physics.onBeforeStep((dt) => this._update(dt))
  }

  _buildVisuals() {
    const cfg = this.config
    const c = cfg.chassis
    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.6, metalness: 0.2 })
    const accentMat = new THREE.MeshStandardMaterial({ color: cfg.accentColor, roughness: 0.7 })

    // main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.l), bodyMat)
    body.castShadow = true
    body.receiveShadow = true
    this.root.add(body)

    // cab toward the rear
    const cab = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.7, c.h * 0.9, c.l * 0.35), accentMat)
    cab.position.set(0, c.h * 0.85, -c.l * 0.18)
    cab.castShadow = true
    this.root.add(cab)

    // dozer blade at the front
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(c.w * 1.15, c.h * 1.1, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.4, metalness: 0.5 })
    )
    blade.position.set(0, -c.h * 0.1, c.l / 2 + 0.35)
    blade.castShadow = true
    blade.receiveShadow = true
    this.root.add(blade)
  }

  _buildWheelMesh(connection) {
    const w = this.config.wheel
    const geo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 16)
    geo.rotateZ(Math.PI / 2) // align cylinder axis with local X (the axle)
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.8 })
    )
    mesh.castShadow = true

    // pivot handles position + steering; mesh spins about its baked X axis
    const pivot = new THREE.Group()
    pivot.position.set(connection.x, connection.y, connection.z)
    pivot.add(mesh)
    this.root.add(pivot)
    this.wheelMeshes.push({ pivot, mesh })
  }

  _update(dt) {
    const cfg = this.config
    const input = this.input || {}

    // --- Steering: ease toward target for a smoother feel ---
    let targetSteer = 0
    if (input.left) targetSteer -= cfg.maxSteer
    if (input.right) targetSteer += cfg.maxSteer
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

    for (let i = 0; i < this.wheelMeshes.length; i++) {
      const { pivot, mesh } = this.wheelMeshes[i]
      const w = this.config.wheel
      let len = this.controller.wheelSuspensionLength(i)
      if (!Number.isFinite(len)) len = this.config.suspension.restLength
      pivot.position.y = w.offsetY - len
      pivot.rotation.y = this.controller.wheelSteering(i) || 0
      mesh.rotation.x = this.controller.wheelRotation(i) || 0
    }
  }

  setInput(input) {
    this.input = input
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
