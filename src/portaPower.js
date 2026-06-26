import * as THREE from 'three'

// Mario-Kart-star-style power-up: smashing a porta-potty grants "Porta Power" —
// a temporary speed boost, invincibility (no flip game-over), a hue-cycling glow
// on the machine, and a flashing HUD banner.
export function createPortaPower({ scene, getVehicle, bannerEl, onStart }) {
  const DURATION = 7
  const BOOST = 1.7
  let timer = 0
  let hue = 0

  const light = new THREE.PointLight(0xffffff, 0, 30, 2)
  light.visible = false
  scene.add(light)

  function activate() {
    const fresh = timer <= 0
    timer = DURATION
    light.visible = true
    if (bannerEl) bannerEl.classList.add('show')
    if (fresh && onStart) onStart()
  }

  function update(dt) {
    if (timer <= 0) return
    timer -= dt
    const v = getVehicle()
    if (v) {
      v.boost = BOOST
      const p = v.getPosition()
      light.position.set(p.x, p.y + 3, p.z)
    }
    hue = (hue + dt * 2) % 1
    light.color.setHSL(hue, 1, 0.6)
    light.intensity = 6 + Math.sin(performance.now() / 60) * 2

    if (timer <= 0) {
      if (v) v.boost = 1
      light.visible = false
      light.intensity = 0
      if (bannerEl) bannerEl.classList.remove('show')
    }
  }

  function reset() {
    timer = 0
    light.visible = false
    light.intensity = 0
    const v = getVehicle()
    if (v) v.boost = 1
    if (bannerEl) bannerEl.classList.remove('show')
  }

  return { activate, update, reset, get active() { return timer > 0 } }
}
