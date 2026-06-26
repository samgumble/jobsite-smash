import * as THREE from 'three'

// Switchable camera rig that follows a vehicle.
// Modes: 'chase' (behind + above) and 'topdown' (overhead). Toggle with C.
export class CameraRig {
  constructor(camera) {
    this.camera = camera
    this.modes = ['chase', 'topdown']
    this.mode = 'chase'

    this._pos = new THREE.Vector3()
    this._target = new THREE.Vector3()
    this.shake = 0

    this.chase = { back: 11, height: 6, lookAhead: 2, lookUp: 1.4, smooth: 6 }
    this.top = { height: 48, smooth: 5 }

    this.onModeChange = null
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') this.toggle()
    })
  }

  toggle() {
    const i = this.modes.indexOf(this.mode)
    this.mode = this.modes[(i + 1) % this.modes.length]
    if (this.onModeChange) this.onModeChange(this.mode)
  }

  // Add a shake impulse (e.g. on impact); decays over time.
  addShake(amount) {
    this.shake = Math.min(this.shake + amount, 0.8)
  }

  // immediate=true snaps with no smoothing (use on spawn / mode switch).
  update(dt, vehicle, immediate = false) {
    const p = vehicle.getPosition()

    if (this.mode === 'chase') {
      const fwd = vehicle.getForwardDirection()
      this._pos.set(
        p.x - fwd.x * this.chase.back,
        p.y + this.chase.height,
        p.z - fwd.z * this.chase.back
      )
      this._target.set(
        p.x + fwd.x * this.chase.lookAhead,
        p.y + this.chase.lookUp,
        p.z + fwd.z * this.chase.lookAhead
      )
      this.camera.up.set(0, 1, 0)
      const a = immediate ? 1 : 1 - Math.exp(-this.chase.smooth * dt)
      this.camera.position.lerp(this._pos, a)
      this.camera.lookAt(this._target)
    } else {
      // Overhead, world-aligned. +Z maps to screen-up.
      this._pos.set(p.x, p.y + this.top.height, p.z)
      this._target.set(p.x, p.y, p.z)
      this.camera.up.set(0, 0, 1)
      const a = immediate ? 1 : 1 - Math.exp(-this.top.smooth * dt)
      this.camera.position.lerp(this._pos, a)
      this.camera.lookAt(this._target)
    }

    // Impact shake: jitter the camera position, decaying over time.
    if (this.shake > 0.0005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.camera.position.z += (Math.random() - 0.5) * this.shake
      this.shake = Math.max(0, this.shake - dt * 2.5)
    }
  }
}
