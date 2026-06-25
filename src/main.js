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
  destructibles.spawnBrickWall({ x: 0, z: 18 }, { cols: 8, rows: 6 })
  destructibles.spawnBrickWall({ x: -26, z: 14 }, { cols: 6, rows: 5, yaw: Math.PI / 2 })
  destructibles.spawnBrickWall({ x: 44, z: -22 }, { cols: 7, rows: 5, yaw: Math.PI / 2 })
  destructibles.spawnPalletStack({ x: 16, z: 18 }, { count: 6 })
  destructibles.spawnPalletStack({ x: 22, z: 26 }, { count: 5 })
  destructibles.spawnPalletStack({ x: -38, z: -16 }, { count: 7 })
  destructibles.spawnPalletStack({ x: 52, z: 30 }, { count: 5 })
  destructibles.spawnBarrelCluster({ x: -16, z: 30 }, { count: 7 })
  destructibles.spawnBarrelCluster({ x: 10, z: 38 }, { count: 6 })
  destructibles.spawnBarrelCluster({ x: -50, z: 22 }, { count: 8 })
  destructibles.spawnBarrelCluster({ x: 36, z: -34 }, { count: 6 })
  destructibles.spawnCrateStack({ x: 28, z: -6 }, { base: 4 })
  destructibles.spawnCrateStack({ x: -22, z: -10 }, { base: 3 })
  destructibles.spawnCrateStack({ x: 8, z: -42 }, { base: 4 })
  destructibles.spawnCrateStack({ x: -10, z: 52 }, { base: 3 })

  // --- Scoring: every destructible piece + every cone is scorable ---
  const scorables = destructibles.items.map((i) => ({ body: i.body, type: i.type, scored: false }))
  for (const body of world.cones) scorables.push({ body, type: 'cone', scored: false })
  const score = createScore({
    scoreEl: document.querySelector('#score'),
    comboEl: document.querySelector('#combo'),
  })

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

    score.detect(scorables)
    score.update(delta)
    cameraRig.update(delta, vehicle)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(animate)
})
