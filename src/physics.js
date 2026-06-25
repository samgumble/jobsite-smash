import RAPIER from '@dimforge/rapier3d-compat'

// Rapier ships as WASM and must be initialized before use.
export async function initPhysics(gravity = { x: 0, y: -9.81 * 2.2, z: 0 }) {
  await RAPIER.init()
  const world = new RAPIER.World(gravity)

  // Pairs of { mesh, body } whose transforms we sync every frame.
  const dynamic = []

  // Callbacks run just before world.step() — e.g. the vehicle controller,
  // which must apply forces to its chassis before the sim integrates.
  const beforeStep = []
  function onBeforeStep(fn) {
    beforeStep.push(fn)
  }

  function addGround(size = 200) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const collider = RAPIER.ColliderDesc.cuboid(size / 2, 0.5, size / 2)
      .setTranslation(0, -0.5, 0)
      .setFriction(0.9)
    world.createCollider(collider, body)
    return body
  }

  // Spawn a dynamic cuboid that drives a Three mesh.
  // half = { hx, hy, hz } half-extents matching the mesh geometry.
  function addBox(mesh, { hx, hy, hz }, position, options = {}) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCanSleep(true)
    const body = world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setDensity(options.density ?? 1)
      .setFriction(options.friction ?? 0.6)
      .setRestitution(options.restitution ?? 0.1)
    world.createCollider(colliderDesc, body)

    dynamic.push({ mesh, body })
    return body
  }

  // Dynamic cylinder (barrels). Cylinder axis is Y, matching CylinderGeometry.
  function addCylinder(mesh, { halfHeight, radius }, position, options = {}) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCanSleep(true)
    const body = world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
      .setDensity(options.density ?? 1)
      .setFriction(options.friction ?? 0.5)
      .setRestitution(options.restitution ?? 0.1)
    world.createCollider(colliderDesc, body)

    dynamic.push({ mesh, body })
    return body
  }

  // Remove a dynamic body + its mesh link (for debris despawn later).
  function remove(body) {
    const i = dynamic.findIndex((d) => d.body === body)
    if (i !== -1) dynamic.splice(i, 1)
    world.removeRigidBody(body)
  }

  // Step the simulation and push transforms onto the linked meshes.
  function step(dt = world.timestep) {
    for (const cb of beforeStep) cb(dt)
    world.step()
    for (const { mesh, body } of dynamic) {
      const t = body.translation()
      const r = body.rotation()
      mesh.position.set(t.x, t.y, t.z)
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
  }

  return { RAPIER, world, addGround, addBox, addCylinder, remove, step, onBeforeStep, dynamic }
}
