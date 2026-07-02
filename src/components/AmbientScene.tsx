import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { onCelebrate } from '../lib/celebration'

const DRIFT_COUNT = 40
const BURST_COUNT = 26
const ACCENT = 0xe07850
const EMBER = 0x8f8c85

/**
 * Scene v2 — quiet depth, not a node-network. A few slow embers drifting in the dark;
 * the scene only "speaks" on celebration, with a brief copper burst.
 * prefers-reduced-motion disables it entirely.
 */
export function AmbientScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000)
    camera.position.z = 420

    // drifting embers
    const positions = new Float32Array(DRIFT_COUNT * 3)
    const phases: number[] = []
    for (let i = 0; i < DRIFT_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1000
      positions[i * 3 + 1] = (Math.random() - 0.5) * 640
      positions[i * 3 + 2] = (Math.random() - 0.5) * 260
      phases.push(Math.random() * Math.PI * 2)
    }
    const driftGeo = new THREE.BufferGeometry()
    driftGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const driftMat = new THREE.PointsMaterial({
      color: EMBER,
      size: 2.2,
      transparent: true,
      opacity: 0.28,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(driftGeo, driftMat))

    // celebration burst (reused buffers, active only while alive)
    const burstPositions = new Float32Array(BURST_COUNT * 3)
    const burstVelocities = new Float32Array(BURST_COUNT * 3)
    const burstGeo = new THREE.BufferGeometry()
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3))
    const burstMat = new THREE.PointsMaterial({
      color: ACCENT,
      size: 4,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
    })
    const burst = new THREE.Points(burstGeo, burstMat)
    scene.add(burst)
    let burstLife = 0

    const offCelebrate = onCelebrate(() => {
      for (let i = 0; i < BURST_COUNT; i++) {
        burstPositions[i * 3] = 0
        burstPositions[i * 3 + 1] = -80
        burstPositions[i * 3 + 2] = 60
        const angle = (i / BURST_COUNT) * Math.PI * 2
        const speed = 2.2 + Math.random() * 2.6
        burstVelocities[i * 3] = Math.cos(angle) * speed
        burstVelocities[i * 3 + 1] = Math.abs(Math.sin(angle)) * speed + 1.4
        burstVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5
      }
      burstLife = 1
      burstGeo.attributes.position.needsUpdate = true
    })

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
    let raf = 0
    let running = true

    function animate() {
      if (!running) return
      raf = requestAnimationFrame(animate)
      frame++

      const pos = driftGeo.attributes.position.array as Float32Array
      for (let i = 0; i < DRIFT_COUNT; i++) {
        // slow vertical drift + gentle sway; wraps at the top
        pos[i * 3 + 1] += 0.06
        pos[i * 3] += Math.sin(frame * 0.002 + phases[i]) * 0.05
        if (pos[i * 3 + 1] > 340) pos[i * 3 + 1] = -340
      }
      driftGeo.attributes.position.needsUpdate = true

      if (burstLife > 0) {
        const bp = burstGeo.attributes.position.array as Float32Array
        for (let i = 0; i < BURST_COUNT; i++) {
          bp[i * 3] += burstVelocities[i * 3]
          bp[i * 3 + 1] += burstVelocities[i * 3 + 1]
          bp[i * 3 + 2] += burstVelocities[i * 3 + 2]
          burstVelocities[i * 3 + 1] -= 0.06 // gravity
        }
        burstLife = Math.max(0, burstLife - 0.016)
        burstMat.opacity = burstLife * 0.85
        burstGeo.attributes.position.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    animate()

    function onVisibility() {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        animate()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      offCelebrate()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      driftGeo.dispose()
      burstGeo.dispose()
      driftMat.dispose()
      burstMat.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
}
