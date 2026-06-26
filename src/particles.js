import * as THREE from 'three'

// Pooled GPU point particles for dust (driving) and debris bursts (smashes).
export function createParticles(scene, max = 600) {
  const positions = new Float32Array(max * 3)
  const colors = new Float32Array(max * 3)
  const sizes = new Float32Array(max)
  const alphas = new Float32Array(max)
  const vel = new Float32Array(max * 3)
  const life = new Float32Array(max)
  const maxLife = new Float32Array(max)
  const grav = new Float32Array(max)
  let cursor = 0

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: roundSprite() } },
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vAlpha = alpha;
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (320.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        if (t.a < 0.02) discard;
        gl_FragColor = vec4(vColor, t.a * vAlpha);
      }
    `,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)

  function spawn(x, y, z, vx, vy, vz, r, g, b, size, ttl, gravity) {
    const i = cursor
    cursor = (cursor + 1) % max
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b
    sizes[i] = size
    life[i] = ttl; maxLife[i] = ttl; grav[i] = gravity
    alphas[i] = 1
  }

  // Soft dust puff kicked up by the tracks (pale tan so it reads on dirt).
  function dust(x, z) {
    const n = 2
    for (let k = 0; k < n; k++) {
      spawn(
        x + (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.4, z + (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.4, 0.9 + Math.random() * 1.0, (Math.random() - 0.5) * 1.4,
        0.78, 0.71, 0.58, 3.0 + Math.random() * 2.2, 0.8 + Math.random() * 0.5, -0.25
      )
    }
  }

  // Burst of colored debris + dust when something is smashed.
  function burst(pos, color, count = 14) {
    const col = new THREE.Color(color)
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 6
      spawn(
        pos.x, pos.y + 0.3, pos.z,
        Math.cos(ang) * sp, 2 + Math.random() * 5, Math.sin(ang) * sp,
        col.r, col.g, col.b, 1.6 + Math.random() * 1.6, 0.6 + Math.random() * 0.5, -9
      )
    }
    for (let k = 0; k < 8; k++) {
      spawn(
        pos.x, pos.y + 0.3, pos.z,
        (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4,
        0.8, 0.73, 0.6, 3.2 + Math.random() * 2.0, 0.7, -0.4
      )
    }
  }

  function update(dt) {
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) { if (alphas[i] !== 0) alphas[i] = 0; continue }
      life[i] -= dt
      vel[i * 3 + 1] += grav[i] * dt
      positions[i * 3] += vel[i * 3] * dt
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt
      if (positions[i * 3 + 1] < 0.05) { positions[i * 3 + 1] = 0.05; vel[i * 3 + 1] = 0 }
      alphas[i] = Math.max(0, life[i] / maxLife[i])
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.alpha.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.attributes.size.needsUpdate = true
  }

  return { dust, burst, update }
}

function roundSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
