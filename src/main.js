import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// --- Renderer ---
const canvas = document.querySelector('#game')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

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
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xb8a98a, roughness: 1 })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Subtle grid so depth/scale reads clearly
const grid = new THREE.GridHelper(200, 50, 0x8a7d63, 0x8a7d63)
grid.material.opacity = 0.35
grid.material.transparent = true
scene.add(grid)

// --- Test boxes (confirm lighting + shadows + depth) ---
const boxColors = [0xd94f3d, 0xf2c14e, 0x4f86d9, 0x57a85a]
boxColors.forEach((color, i) => {
  const size = 2 + i * 0.6
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  )
  box.position.set((i - 1.5) * 5, size / 2, 0)
  box.castShadow = true
  box.receiveShadow = true
  scene.add(box)
})

// --- Controls (temporary, Phase 1 only) ---
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 1, 0)

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// --- Render loop ---
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
