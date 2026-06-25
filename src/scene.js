import * as THREE from 'three'

const PARTICLE_COUNT = 560
const CONNECTION_DISTANCE = 120
const COLORS = [0x6366f1, 0x8b5cf6, 0x06b6d4, 0x10b981]

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
  camera.position.z = 500

  // Particles
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const velocities = []
  const colors = new Float32Array(PARTICLE_COUNT * 3)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 900
    const y = (Math.random() - 0.5) * 700
    const z = (Math.random() - 0.5) * 300
    positions[i * 3]     = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    velocities.push({
      x: (Math.random() - 0.5) * 0.0000008,
      y: (Math.random() - 0.5) * 0.0000008,
      z: (Math.random() - 0.5) * 0.0000003,
    })

    const c = new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)])
    colors[i * 3]     = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const mat = new THREE.PointsMaterial({
    size: 6,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geo, mat)
  scene.add(points)

  // Lines geometry (dynamic)
  const maxLines = PARTICLE_COUNT * 4
  const linePositions = new Float32Array(maxLines * 6)
  const lineColors    = new Float32Array(maxLines * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineColors,    3))
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
  }))
  scene.add(lines)

  // Pulse state
  let pulseStrength = 0

  function pulse() {
    pulseStrength = 1.0
  }

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  let frame = 0
  function animate() {
    requestAnimationFrame(animate)
    frame++

    const pos = geo.attributes.position.array

    // Move particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3]     += velocities[i].x
      pos[i * 3 + 1] += velocities[i].y
      pos[i * 3 + 2] += velocities[i].z

      // Wrap around
      if (pos[i * 3]     >  500) pos[i * 3]     = -500
      if (pos[i * 3]     < -500) pos[i * 3]     =  500
      if (pos[i * 3 + 1] >  400) pos[i * 3 + 1] = -400
      if (pos[i * 3 + 1] < -400) pos[i * 3 + 1] =  400
    }
    geo.attributes.position.needsUpdate = true

    // Update connections (every 2 frames for perf)
    if (frame % 3 === 0) {
      let lineIdx = 0
      const lp = lineGeo.attributes.position.array
      const lc = lineGeo.attributes.color.array

      for (let i = 0; i < PARTICLE_COUNT && lineIdx < maxLines; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < maxLines; j++) {
          const dx = pos[i * 3]     - pos[j * 3]
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1]
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2]
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

          if (dist < CONNECTION_DISTANCE) {
            const alpha = 1 - dist / CONNECTION_DISTANCE
            lp[lineIdx * 6]     = pos[i * 3]
            lp[lineIdx * 6 + 1] = pos[i * 3 + 1]
            lp[lineIdx * 6 + 2] = pos[i * 3 + 2]
            lp[lineIdx * 6 + 3] = pos[j * 3]
            lp[lineIdx * 6 + 4] = pos[j * 3 + 1]
            lp[lineIdx * 6 + 5] = pos[j * 3 + 2]

            const r = colors[i * 3] * alpha
            const g = colors[i * 3 + 1] * alpha
            const b = colors[i * 3 + 2] * alpha
            lc[lineIdx * 6]     = r; lc[lineIdx * 6 + 1] = g; lc[lineIdx * 6 + 2] = b
            lc[lineIdx * 6 + 3] = r; lc[lineIdx * 6 + 4] = g; lc[lineIdx * 6 + 5] = b
            lineIdx++
          }
        }
      }
      // Zero out unused slots
      for (let k = lineIdx * 6; k < maxLines * 6; k++) {
        lp[k] = 0; lc[k] = 0
      }
      lineGeo.attributes.position.needsUpdate = true
      lineGeo.attributes.color.needsUpdate = true
      lineGeo.setDrawRange(0, lineIdx * 2)
    }

    // Pulse effect
    if (pulseStrength > 0) {
      mat.opacity = 0.7 + pulseStrength * 0.4
      mat.size    = 6 + pulseStrength * 4
      lines.material.opacity = 0.45 + pulseStrength * 0.25
      pulseStrength *= 0.88
      if (pulseStrength < 0.01) {
        pulseStrength = 0
        mat.opacity   = 0.7
        mat.size      = 6
        lines.material.opacity = 0.45
      }
    }

    // Very slow camera drift
    camera.position.x = Math.sin(frame * 0.0001) * 3
    camera.position.y = Math.cos(frame * 0.00008) * 2
    camera.lookAt(scene.position)

    renderer.render(scene, camera)
  }
  animate()

  return { pulse }
}
