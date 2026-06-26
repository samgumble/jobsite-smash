import { Vehicle } from './vehicles.js'
import { trackWaypoints, gridSlots } from './track.js'

// Mario-Kart-style race against AI machines around the jobsite circuit.
export function createRace({ scene, physics, spec, getPlayerVehicle, hud, onFinish }) {
  const TOTAL_LAPS = 3
  const CP_RADIUS = 8
  const OPPONENTS = ['dumptruck', 'loader', 'bulldozer']
  const waypoints = trackWaypoints(spec)
  const N = waypoints.length

  let state = 'idle' // idle | countdown | racing | finished
  let countdown = 0
  const opponents = []
  const player = { wp: 0, lap: 0, finished: false, isPlayer: true, name: 'You' }
  const finishOrder = []

  function quatY(yaw) {
    return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
  }

  function placeOnGrid(v, s) {
    v.reset({ x: s.x, y: 2, z: s.z })
    v.body.setRotation(quatY(s.yaw), true)
    v.boost = 0
  }

  function start() {
    const slots = gridSlots(spec, 1 + OPPONENTS.length)
    placeOnGrid(getPlayerVehicle(), slots[0])
    Object.assign(player, { wp: 0, lap: 0, finished: false })

    OPPONENTS.forEach((cfg, i) => {
      const s = slots[i + 1]
      if (!opponents[i]) {
        const v = new Vehicle(scene, physics, cfg, { x: s.x, y: 2, z: s.z })
        const input = { forward: false, backward: false, left: false, right: false, brake: false }
        v.setInput(input)
        opponents.push({ vehicle: v, input, wp: 0, lap: 0, finished: false, name: `CPU ${i + 1}` })
      }
      const o = opponents[i]
      placeOnGrid(o.vehicle, s)
      o.wp = 0; o.lap = 0; o.finished = false
    })

    finishOrder.length = 0
    countdown = 3.99
    state = 'countdown'
    if (hud.results) hud.results.classList.remove('show')
  }

  function setAllBoost(b) {
    const pv = getPlayerVehicle()
    if (pv) pv.boost = b
    for (const o of opponents) o.vehicle.boost = b
  }

  function driveAI(o, dt) {
    const v = o.vehicle

    // Stuck recovery: if pinned against a wall, reverse + turn out, then resume.
    if (state === 'racing') {
      if (Math.abs(v.getSpeed()) < 1.5) o.stuckT = (o.stuckT || 0) + dt
      else o.stuckT = 0
      if (o.recoverT > 0) {
        o.recoverT -= dt
        o.input.forward = false
        o.input.backward = true
        o.input.left = o._recLeft
        o.input.right = !o._recLeft
        return
      }
      if (o.stuckT > 1.2) {
        o.recoverT = 0.8
        o.stuckT = 0
        o._recLeft = Math.random() < 0.5
        return
      }
    }

    const pos = v.getPosition()
    // steer toward a look-ahead waypoint for smooth racing lines
    const t = waypoints[(o.wp + 1) % N]
    const dx = t.x - pos.x, dz = t.z - pos.z
    const desired = Math.atan2(dx, dz)
    const f = v.getForwardDirection()
    const cur = Math.atan2(f.x, f.z)
    let err = desired - cur
    while (err > Math.PI) err -= 2 * Math.PI
    while (err < -Math.PI) err += 2 * Math.PI

    // input.left increases yaw, input.right decreases it (chase-cam convention)
    const dead = 0.06
    o.input.left = err > dead
    o.input.right = err < -dead
    o.input.forward = true // keep momentum through turns
    o.input.backward = false
    o.input.brake = false
  }

  function advance(racer) {
    if (racer.finished) return
    const pos = racer.isPlayer ? getPlayerVehicle().getPosition() : racer.vehicle.getPosition()
    const t = waypoints[racer.wp]
    if (Math.hypot(t.x - pos.x, t.z - pos.z) < CP_RADIUS) {
      racer.wp++
      if (racer.wp >= N) {
        racer.wp = 0
        racer.lap++
        if (racer.lap >= TOTAL_LAPS) {
          racer.finished = true
          finishOrder.push(racer)
        }
      }
    }
  }

  function progressScore(r) {
    const pos = r.isPlayer ? getPlayerVehicle().getPosition() : r.vehicle.getPosition()
    const t = waypoints[r.wp]
    const d = Math.hypot(t.x - pos.x, t.z - pos.z)
    if (r.finished) return 1e6 - finishOrder.indexOf(r)
    return r.lap * 1000 + r.wp * 10 - d * 0.1
  }

  function ordinal(n) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
  }

  let updateCalls = 0
  function update(dt) {
    updateCalls++
    if (state === 'idle') return

    if (state === 'countdown') {
      countdown -= dt
      const n = Math.ceil(countdown)
      if (hud.countdown) {
        hud.countdown.textContent = n > 0 ? String(n) : 'GO!'
        hud.countdown.classList.add('show')
      }
      if (countdown <= 0) {
        state = 'racing'
        setAllBoost(1)
        setTimeout(() => hud.countdown && hud.countdown.classList.remove('show'), 600)
      }
    }

    // AI always navigates (frozen by boost=0 until GO)
    for (const o of opponents) driveAI(o, dt)

    if (state === 'racing' || state === 'finished') {
      advance(player)
      for (const o of opponents) advance(o)
    }

    // standings
    const all = [player, ...opponents].sort((a, b) => progressScore(b) - progressScore(a))
    const rank = all.indexOf(player) + 1
    if (hud.lap) hud.lap.textContent = `LAP ${Math.min(player.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`
    if (hud.pos) hud.pos.textContent = `${ordinal(rank)} / ${all.length}`

    // Rubberbanding: opponents behind the player speed up, those ahead ease off,
    // keeping the pack competitive. progressScore: +10 per waypoint, +1000 per lap.
    if (state === 'racing') {
      const ps = progressScore(player)
      for (const o of opponents) {
        if (o.finished) { o.vehicle.boost = 0; continue }
        const diff = ps - progressScore(o) // > 0 => opponent is behind you
        o.vehicle.boost = Math.max(0.85, Math.min(1.7, 1.2 + diff / 450))
      }
    } else {
      for (const o of opponents) if (o.finished) o.vehicle.boost = 0
    }

    if (state === 'racing' && player.finished) {
      state = 'finished'
      getPlayerVehicle().boost = 0
      const place = finishOrder.indexOf(player) + 1
      if (onFinish) onFinish(place, all.length)
    }
  }

  // Sync opponent visuals (called inside the fixed-step loop).
  function syncMeshes() {
    for (const o of opponents) o.vehicle.syncMeshes()
  }

  function destroy() {
    for (const o of opponents) o.vehicle.destroy()
    opponents.length = 0
    state = 'idle'
    if (hud.countdown) hud.countdown.classList.remove('show')
    if (hud.results) hud.results.classList.remove('show')
  }

  return {
    start, update, syncMeshes, destroy,
    get state() { return state },
    get debug() {
      return {
        state,
        updateCalls,
        player: { wp: player.wp, lap: player.lap },
        opp: opponents.map((o) => {
          const p = o.vehicle.getPosition()
          return { wp: o.wp, lap: o.lap, x: +p.x.toFixed(0), z: +p.z.toFixed(0), spd: +o.vehicle.getSpeed().toFixed(1), boost: o.vehicle.boost, fwd: o.input.forward, L: o.input.left, R: o.input.right }
        }),
      }
    },
  }
}
