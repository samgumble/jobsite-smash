import './style.css'
import * as THREE from 'three'
import { initPhysics } from './physics.js'
import { createControls } from './controls.js'
import { Vehicle } from './vehicles.js'
import { CameraRig } from './camera.js'

// --- Renderer ---
const canvas = document.querySelector('#game')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

// --- Scene ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.Fog(0x87ceeb, 60, 200)

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

// --- Ground plane ---
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0xb8a98a, roughness: 1 })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Subtle grid so depth/scale reads clearly
const grid = new THREE.GridHelper(300, 75, 0x8a7d63, 0x8a7d63)
grid.material.opacity = 0.35
grid.material.transparent = true
scene.add(grid)

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// --- Game setup (Phase 3) ---
const boxColors = [0xd94f3d, 0xf2c14e, 0x4f86d9, 0x57a85a, 0xe07a3f, 0x8e6fc4]
const input = createControls()

initPhysics().then((physics) => {
  physics.addGround(300)

  // A pile of crates ahead of the spawn, ready to be smashed.
  for (let i = 0; i < 24; i++) {
    const size = 1.2 + Math.random() * 0.9
    const color = boxColors[i % boxColors.length]
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    const position = {
      x: (Math.random() - 0.5) * 10,
      y: size / 2 + Math.random() * 3,
      z: 22 + (Math.random() - 0.5) * 10,
    }
    physics.addBox(mesh, { hx: size / 2, hy: size / 2, hz: size / 2 }, position)
  }

  // --- Vehicle ---
  const vehicle = new Vehicle(scene, physics, 'bulldozer', { x: 0, y: 1.8, z: 0 })
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

    cameraRig.update(delta, vehicle)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(animate)
})
