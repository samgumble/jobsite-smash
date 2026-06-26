// Shared oval-track geometry. Used by world.js (to render the circuit) and
// race.js (waypoints for AI navigation + lap checkpoints).
export function trackWaypoints(spec, n = 40) {
  const { cx = 0, cz = 0, rx, rz } = spec
  const pts = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2
    pts.push({ x: cx + rx * Math.cos(th), z: cz + rz * Math.sin(th) })
  }
  return pts
}

// Starting grid placed ALONG the oval just behind the start line (theta=0),
// each racer offset across the track and facing the travel direction.
export function gridSlots(spec, count) {
  const { cx = 0, cz = 0, rx, rz } = spec
  const slots = []
  for (let i = 0; i < count; i++) {
    const ang = -0.12 - i * 0.13 // behind the start line, staggered
    const px = cx + rx * Math.cos(ang)
    const pz = cz + rz * Math.sin(ang)
    // tangent (travel direction) and its perpendicular for lane offset
    const tx = -rx * Math.sin(ang)
    const tz = rz * Math.cos(ang)
    const tl = Math.hypot(tx, tz) || 1
    const nx = tz / tl, nz = -tx / tl
    const lane = i % 2 === 0 ? -3.5 : 3.5
    slots.push({ x: px + nx * lane, z: pz + nz * lane, yaw: Math.atan2(tx, tz) })
  }
  return slots
}
