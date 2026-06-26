import './style.css'
import * as THREE from 'three'
import { initPhysics } from './physics.js'
import { createControls } from './controls.js'
import { Vehicle } from './vehicles.js'
import { CameraRig } from './camera.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createDestructibles } from './destructibles.js'
import { createWorld } from './world.js'
import { createScore } from './score.js'
import { createParticles } from './particles.js'
import { createAudio } from './audio.js'

// --- Renderer ---
const canvas = document.querySelector('#game')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

// --- Scene ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x9fd2ec)
scene.fog = new THREE.Fog(0x9fd2ec, 70, 230)

// Image-based lighting for realistic metal/PBR reflections.
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(18, 14, 18)
camera.lookAt(0, 0, 0)

// --- Lights ---
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b5a45, 0.9)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xfff4e0, 1.6)
sun.position.set(30, 50, 20)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 150
sun.shadow.camera.left = -60
sun.shadow.camera.right = 60
sun.shadow.camera.top = 60
sun.shadow.camera.bottom = -60
sun.shadow.bias = -0.0004
scene.add(sun)

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// --- Game setup ---
const input = createControls()

initPhysics().then((physics) => {
  physics.addGround(300)

  // --- Static jobsite world: dirt ground, fence, containers, props ---
  const world = createWorld(scene, physics)

  // --- Destructible piles scattered around the jobsite ---
  const destructibles = createDestructibles(scene, physics)
  if (import.meta.env.DEV) window.__dz = destructibles
  // brick + cinder walls
  destructibles.spawnBrickWall({ x: 0, z: 18 }, { cols: 8, rows: 6 })
  destructibles.spawnBrickWall({ x: -26, z: 14 }, { cols: 6, rows: 5, yaw: Math.PI / 2 })
  destructibles.spawnBrickWall({ x: 44, z: -22 }, { cols: 7, rows: 5, yaw: Math.PI / 2 })
  destructibles.spawnCinderWall({ x: 22, z: 4 }, { cols: 6, rows: 4 })
  destructibles.spawnCinderWall({ x: -44, z: -2 }, { cols: 5, rows: 4, yaw: Math.PI / 2 })
  // pallets + lumber
  destructibles.spawnPalletStack({ x: 16, z: 18 }, { count: 6 })
  destructibles.spawnPalletStack({ x: 22, z: 26 }, { count: 5 })
  destructibles.spawnPalletStack({ x: -38, z: -16 }, { count: 7 })
  destructibles.spawnPalletStack({ x: 52, z: 30 }, { count: 5 })
  destructibles.spawnPlankPile({ x: 6, z: 30 }, { count: 9 })
  destructibles.spawnPlankPile({ x: -18, z: -28 }, { count: 8 })
  destructibles.spawnPlankPile({ x: 40, z: 12 }, { count: 8 })
  // barrels + pipes
  destructibles.spawnBarrelCluster({ x: -16, z: 30 }, { count: 7 })
  destructibles.spawnBarrelCluster({ x: 10, z: 38 }, { count: 6 })
  destructibles.spawnBarrelCluster({ x: -50, z: 22 }, { count: 8 })
  destructibles.spawnBarrelCluster({ x: 36, z: -34 }, { count: 6 })
  destructibles.spawnPipeStack({ x: -32, z: 40 }, { rows: 3 })
  destructibles.spawnPipeStack({ x: 30, z: 44 }, { rows: 4, yaw: Math.PI / 2 })
  destructibles.spawnPipeStack({ x: 54, z: -8 }, { rows: 3 })
  // crates
  destructibles.spawnCrateStack({ x: 28, z: -6 }, { base: 4 })
  destructibles.spawnCrateStack({ x: -22, z: -10 }, { base: 3 })
  destructibles.spawnCrateStack({ x: 8, z: -42 }, { base: 4 })
  destructibles.spawnCrateStack({ x: -10, z: 52 }, { base: 3 })
  destructibles.spawnCrateStack({ x: 48, z: 48 }, { base: 3 })
  // porta-potties
  destructibles.spawnPortaPotty({ x: 12, z: -16 })
  destructibles.spawnPortaPotty({ x: 14, z: -16, yaw: 0.2 })
  destructibles.spawnPortaPotty({ x: -34, z: 28, yaw: 0.5 })
  destructibles.finalize() // build instanced meshes from all spawned pieces

  // --- Scoring: every destructible piece + every cone is scorable ---
  // Capture each piece's spawn transform now (before any physics step) so the
  // reset button can restore the whole site.
  const snapshot = (body, type) => {
    const t = body.translation()
    const r = body.rotation()
    return { body, type, scored: false, settled: false, ip: { x: t.x, y: t.y, z: t.z }, ir: { x: r.x, y: r.y, z: r.z, w: r.w } }
  }
  const scorables = destructibles.items.map((i) => snapshot(i.body, i.type))
  for (const body of world.cones) scorables.push(snapshot(body, 'cone'))

  // --- Juice: particles + procedural audio ---
  const particles = createParticles(scene)
  const audio = createAudio()
  if (import.meta.env.DEV) window.__fx = particles
  const DEBRIS_COLOR = { brick: 0xa8442a, barrel: 0xe0892e, crate: 0xc7a86a, pallet: 0xb07a3e, cone: 0xff6a1a }

  const score = createScore({
    scoreEl: document.querySelector('#score'),
    comboEl: document.querySelector('#combo'),
    onSmash: (type, pos) => {
      particles.burst(pos, DEBRIS_COLOR[type] ?? 0xc7a86a)
      audio.thud(0.45 + Math.random() * 0.4)
      cameraRig.addShake(0.28)
    },
  })
  // Let the piles settle before scoring counts (no points for spawn jitter).
  setTimeout(() => score.arm(), 1500)

  // Start audio on the first user interaction (autoplay policy).
  const startAudio = () => audio.resume()
  window.addEventListener('keydown', startAudio, { once: true })
  window.addEventListener('pointerdown', startAudio, { once: true })

  // --- Vehicle ---
  const vehicle = new Vehicle(scene, physics, 'bulldozer', { x: 0, y: 2.3, z: 0 })
  vehicle.setInput(input)
  if (import.meta.env.DEV) window.__vehicle = vehicle // dev tuning handle

  // --- Camera rig (chase / top-down, toggle with C) ---
  const cameraRig = new CameraRig(camera)
  const camIndicator = document.querySelector('#cam-mode')
  cameraRig.onModeChange = (mode) => {
    if (camIndicator) camIndicator.textContent = `CAM: ${mode === 'chase' ? 'CHASE' : 'TOP-DOWN'}`
  }
  cameraRig.update(0, vehicle, true) // snap into place on spawn

  // --- Reset: restore the whole site, the vehicle, and the score ---
  function resetGame() {
    vehicle.reset({ x: 0, y: 2.3, z: 0 })
    for (const s of scorables) {
      s.body.setTranslation(s.ip, true)
      s.body.setRotation(s.ir, true)
      s.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      s.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      s.scored = false
      s.settled = false
    }
    score.reset()
    setTimeout(() => score.arm(), 1500)
    cameraRig.update(0, vehicle, true)
  }
  const resetBtn = document.querySelector('#reset')
  if (resetBtn) resetBtn.addEventListener('click', resetGame)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') resetGame()
  })

  // --- Render loop ---
  let lastTime = performance.now()
  let accumulator = 0
  const fixedStep = 1 / 60

  function animate(now) {
    requestAnimationFrame(animate)

    const delta = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    // Fixed-timestep physics so the sim is framerate-independent.
    accumulator += delta
    while (accumulator >= fixedStep) {
      physics.step(fixedStep)
      vehicle.syncMeshes()
      accumulator -= fixedStep
    }

    destructibles.sync() // push awake bodies into instance matrices
    score.detect(scorables)
    score.update(delta)

    // Engine sound tracks speed + throttle.
    const speed = vehicle.getSpeed()
    const throttle = input.forward ? 1 : input.backward ? 0.6 : 0
    audio.setEngine(speed, throttle)

    // Kick up dust behind the tracks while moving.
    if (Math.abs(speed) > 2) {
      const p = vehicle.getPosition()
      const f = vehicle.getForwardDirection()
      particles.dust(p.x - f.x * 1.5, p.z - f.z * 1.5)
    }
    particles.update(delta)

    cameraRig.update(delta, vehicle)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(animate)
})
