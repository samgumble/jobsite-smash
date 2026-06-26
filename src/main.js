import './style.css'
import * as THREE from 'three'
import { initPhysics } from './physics.js'
import { createControls } from './controls.js'
import { Vehicle, VEHICLE_CONFIGS, VEHICLE_ORDER } from './vehicles.js'
import { CameraRig } from './camera.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createDestructibles } from './destructibles.js'
import { createWorld } from './world.js'
import { createScore } from './score.js'
import { LEVELS } from './levels.js'
import { createParticles } from './particles.js'
import { createAudio } from './audio.js'
import { createPortaPower } from './portaPower.js'

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

  // --- Level state (built by buildLevel below) ---
  let world = null
  let destructibles = null
  let scorables = []

  // Capture a piece's spawn transform so reset can restore it.
  const snapshot = (body, type) => {
    const t = body.translation()
    const r = body.rotation()
    return { body, type, scored: false, settled: false, ip: { x: t.x, y: t.y, z: t.z }, ir: { x: r.x, y: r.y, z: r.z, w: r.w } }
  }

  // --- Juice: particles + procedural audio ---
  const particles = createParticles(scene)
  const audio = createAudio()
  if (import.meta.env.DEV) window.__fx = particles
  const DEBRIS_COLOR = { brick: 0xa8442a, barrel: 0xe0892e, crate: 0xc7a86a, pallet: 0xb07a3e, cone: 0xff6a1a, porta: 0x2f8f5b }

  const score = createScore({
    scoreEl: document.querySelector('#score'),
    comboEl: document.querySelector('#combo'),
    onSmash: (type, pos) => {
      particles.burst(pos, DEBRIS_COLOR[type] ?? 0xc7a86a)
      audio.thud(0.45 + Math.random() * 0.4)
      cameraRig.addShake(0.28)
      if (type === 'porta') portaPower.activate() // ⚡ Porta Power!
    },
  })

  // Start audio on the first user interaction (autoplay policy).
  const startAudio = () => audio.resume()
  window.addEventListener('keydown', startAudio, { once: true })
  window.addEventListener('pointerdown', startAudio, { once: true })

  // --- Vehicle (switchable roster) ---
  let vehicleIndex = 0
  let vehicle = new Vehicle(scene, physics, VEHICLE_ORDER[0], { x: 0, y: 2.3, z: 0 })
  vehicle.setInput(input)
  if (import.meta.env.DEV) window.__vehicle = vehicle // dev tuning handle

  const vehicleLabel = document.querySelector('#vehicle-name')
  if (vehicleLabel) vehicleLabel.textContent = vehicle.config.name

  function switchVehicle(dir = 1) {
    const pos = vehicle.getPosition()
    const f = vehicle.getForwardDirection()
    const yaw = Math.atan2(f.x, f.z)
    vehicle.destroy()
    vehicleIndex = (vehicleIndex + dir + VEHICLE_ORDER.length) % VEHICLE_ORDER.length
    vehicle = new Vehicle(scene, physics, VEHICLE_ORDER[vehicleIndex], { x: pos.x, y: pos.y + 0.6, z: pos.z })
    vehicle.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true)
    vehicle.setInput(input)
    if (import.meta.env.DEV) window.__vehicle = vehicle
    if (vehicleLabel) vehicleLabel.textContent = vehicle.config.name
    cameraRig.update(0, vehicle, true)
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') switchVehicle(1)
  })

  // --- Camera rig (chase / top-down, toggle with C) ---
  const cameraRig = new CameraRig(camera)
  const camIndicator = document.querySelector('#cam-mode')
  cameraRig.onModeChange = (mode) => {
    if (camIndicator) camIndicator.textContent = `CAM: ${mode === 'chase' ? 'CHASE' : 'TOP-DOWN'}`
  }
  cameraRig.update(0, vehicle, true) // snap into place on spawn

  // --- Porta Power (star-style power-up) ---
  const portaPower = createPortaPower({
    scene,
    getVehicle: () => vehicle,
    bannerEl: document.querySelector('#porta-power'),
    onStart: () => audio.powerup(),
  })
  if (import.meta.env.DEV) window.__pp = portaPower

  // --- Game over (flip a vehicle = turtle on its back) ---
  const gameOverEl = document.querySelector('#game-over')
  let flipTimer = 0
  let gameOver = false
  function checkFlip(dt) {
    if (gameOver) return
    // Upright up.y ~ 1; flipped < 0. Invincible during Porta Power.
    if (!portaPower.active && vehicle.getUpY() < -0.4) {
      flipTimer += dt
      if (flipTimer > 1.6) {
        gameOver = true
        if (gameOverEl) gameOverEl.classList.add('show')
      }
    } else {
      flipTimer = 0
    }
  }
  if (import.meta.env.DEV) window.__flip = () => ({ flipTimer, gameOver, up: +vehicle.getUpY().toFixed(2), ppa: portaPower.active })

  // --- Levels: build / tear down / switch ---
  let levelIndex = 0
  const levelLabel = document.querySelector('#level-name')

  function buildLevel(index) {
    const def = LEVELS[index]
    world = createWorld(scene, physics, def.layout)
    destructibles = createDestructibles(scene, physics)
    def.spawns(destructibles)
    destructibles.finalize()
    scorables = destructibles.items.map((i) => snapshot(i.body, i.type))
    for (const body of world.cones) scorables.push(snapshot(body, 'cone'))
    if (import.meta.env.DEV) window.__dz = destructibles
    if (levelLabel) levelLabel.textContent = `LVL ${index + 1}: ${def.name}`
    score.reset()
    setTimeout(() => score.arm(), 1500)
  }

  function switchLevel(index) {
    if (index === levelIndex || index < 0 || index >= LEVELS.length) return
    world.dispose()
    destructibles.dispose()
    levelIndex = index
    buildLevel(index)
    vehicle.reset({ x: 0, y: 2.3, z: 0 })
    cameraRig.update(0, vehicle, true)
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') switchLevel(0)
    else if (e.code === 'Digit2') switchLevel(1)
    else if (e.code === 'Digit3') switchLevel(2)
    else if (e.code === 'KeyL') switchLevel((levelIndex + 1) % LEVELS.length)
  })

  buildLevel(0) // initial level

  // --- Reset: restore the current site, the vehicle, and the score ---
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
    // clear power-up + game-over state
    portaPower.reset()
    flipTimer = 0
    gameOver = false
    if (gameOverEl) gameOverEl.classList.remove('show')
  }
  const resetBtn = document.querySelector('#reset')
  if (resetBtn) resetBtn.addEventListener('click', resetGame)
  const restartBtn = document.querySelector('#restart')
  if (restartBtn) restartBtn.addEventListener('click', resetGame)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') resetGame()
  })

  // --- Mute toggle (button + M) ---
  const muteBtn = document.querySelector('#mute')
  function toggleMute() {
    audio.resume() // a click/key here counts as the gesture to start audio
    const m = audio.toggleMute()
    if (muteBtn) {
      muteBtn.textContent = m ? '🔇' : '🔊'
      muteBtn.classList.toggle('muted', m)
    }
  }
  if (muteBtn) muteBtn.addEventListener('click', toggleMute)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') toggleMute()
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
    portaPower.update(delta)
    checkFlip(delta)

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
