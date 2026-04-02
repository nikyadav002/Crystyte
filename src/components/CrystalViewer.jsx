import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getElement } from '../lib/elements.js'
import { expandSupercell, detectBonds, cellBoxLines } from '../lib/structure.js'

// Display-mode appearance parameters
const MODES = {
  'ball-stick': { atomFactor: 0.35, bondRadius: 0.13, showBonds: true,  showAtoms: true  },
  'spacefill':  { atomFactor: 1.0,  bondRadius: 0.13, showBonds: false, showAtoms: true, vdw: true },
  'stick':      { atomFactor: 0.12, bondRadius: 0.18, showBonds: true,  showAtoms: true  },
}

function makeAtomMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 })
}
function makeBondMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0 })
}

// Place a unit cylinder (Y-axis, height=1, radius=1) between start and end
function cylinderMatrix(start, end, radius) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.hypot(dx, dy, dz)
  if (length < 1e-6) return null

  const cx = (start[0] + end[0]) * 0.5
  const cy = (start[1] + end[1]) * 0.5
  const cz = (start[2] + end[2]) * 0.5

  const q = new THREE.Quaternion()
  q.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx / length, dy / length, dz / length),
  )
  const mat = new THREE.Matrix4()
  mat.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(radius, length, radius))
  return mat
}

// ---- frame camera so the bounding sphere fits the viewport ------------------
function frameCamera(camera, controls, center, radius) {
  const c3 = new THREE.Vector3(center[0], center[1], center[2])

  // FOV-based distance: bounding sphere exactly fits the shorter viewport dimension
  const halfFov = (camera.fov * Math.PI) / 360   // vertical half-FOV in radians
  const fitDist = (radius / Math.tan(halfFov)) * 1.35  // 35 % breathing room

  // Nice isometric-ish offset
  const dir = new THREE.Vector3(0.55, 0.45, 1.0).normalize()
  camera.position.copy(c3).addScaledVector(dir, fitDist)
  camera.lookAt(c3)

  camera.near = Math.max(0.01, fitDist * 0.001)
  camera.far  = fitDist * 8 + radius * 8
  camera.updateProjectionMatrix()

  controls.target.copy(c3)
  controls.minDistance = radius * 0.1
  controls.maxDistance = fitDist * 20

  // Flush accumulated damping state so the camera doesn't drift
  const wasDamping = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.enableDamping = wasDamping
}

// ---- Main component ---------------------------------------------------------

const CrystalViewer = forwardRef(function CrystalViewer(
  { structure, displayMode, supercell, customColors, transparentBg },
  ref,
) {
  const mountRef  = useRef(null)
  const stateRef  = useRef({})
  // Track which (structure, supercell) we last framed so that changing
  // display-mode or colors doesn't reset the camera.
  const framedKey = useRef(null)

  // ---- Create renderer / scene / camera / controls (once) ------------------
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputEncoding = THREE.sRGBEncoding
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f1117)

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 2000)
    camera.position.set(15, 12, 20)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.90)
    key.position.set(5, 8, 6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xaaccff, 0.30)
    fill.position.set(-5, -3, -4)
    scene.add(fill)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping   = true
    controls.dampingFactor   = 0.08
    controls.screenSpacePanning = true

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(el)

    stateRef.current = { renderer, scene, camera, controls, animId, ro }

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ---- Background toggle ---------------------------------------------------
  useEffect(() => {
    const { scene } = stateRef.current
    if (!scene) return
    scene.background = transparentBg ? null : new THREE.Color(0x0f1117)
  }, [transparentBg])

  // ---- Rebuild geometry + conditionally re-frame camera --------------------
  useEffect(() => {
    const { scene, camera, controls } = stateRef.current
    if (!scene) return

    // Dispose old geometry
    const old = scene.getObjectByName('structureGroup')
    if (old) {
      old.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
      scene.remove(old)
    }

    if (!structure?.atoms?.length) return

    const expanded = expandSupercell(structure, supercell)
    if (!expanded) return

    const { atoms, lattice, Linv } = expanded
    const mode = MODES[displayMode] ?? MODES['ball-stick']

    const group = new THREE.Group()
    group.name = 'structureGroup'

    // ---- Atoms ---------------------------------------------------------------
    const sphereGeo = new THREE.SphereGeometry(1, 28, 14)
    const atomMat   = makeAtomMaterial()
    const atomMesh  = new THREE.InstancedMesh(sphereGeo, atomMat, atoms.length)
    atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const color3  = new THREE.Color()
    const matTmp  = new THREE.Matrix4()
    const pos3    = new THREE.Vector3()

    for (let i = 0; i < atoms.length; i++) {
      const { symbol, position } = atoms[i]
      const el = getElement(symbol)
      const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor

      pos3.set(position[0], position[1], position[2])
      matTmp.makeScale(r, r, r)
      matTmp.setPosition(pos3)
      atomMesh.setMatrixAt(i, matTmp)
      color3.set(customColors?.[symbol] ?? el.color)
      atomMesh.setColorAt(i, color3)
    }
    atomMesh.instanceMatrix.needsUpdate = true
    if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true
    atomMesh.visible = mode.showAtoms
    group.add(atomMesh)

    // ---- Bonds ---------------------------------------------------------------
    if (mode.showBonds) {
      const bonds = detectBonds(atoms, lattice, Linv)
      if (bonds.length > 0) {
        const cylGeo   = new THREE.CylinderGeometry(1, 1, 1, 10, 1)
        const bondMat  = makeBondMaterial()
        const bondMesh = new THREE.InstancedMesh(cylGeo, bondMat, bonds.length * 2)
        bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        let idx = 0
        for (const bond of bonds) {
          const mI = cylinderMatrix(bond.start, bond.mid, mode.bondRadius)
          if (mI) bondMesh.setMatrixAt(idx, mI)
          color3.set(customColors?.[atoms[bond.i].symbol] ?? getElement(atoms[bond.i].symbol).color)
          bondMesh.setColorAt(idx, color3)
          idx++

          const mJ = cylinderMatrix(bond.mid, bond.end, mode.bondRadius)
          if (mJ) bondMesh.setMatrixAt(idx, mJ)
          color3.set(customColors?.[atoms[bond.j].symbol] ?? getElement(atoms[bond.j].symbol).color)
          bondMesh.setColorAt(idx, color3)
          idx++
        }
        bondMesh.instanceMatrix.needsUpdate = true
        if (bondMesh.instanceColor) bondMesh.instanceColor.needsUpdate = true
        group.add(bondMesh)
      }
    }

    // ---- Unit cell box -------------------------------------------------------
    if (lattice) {
      const pts = cellBoxLines(lattice)
      if (pts) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
        group.add(new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ color: 0x4488ff }),
        ))
      }
    }

    scene.add(group)

    // ---- Auto-frame camera (only when structure or supercell change) ----------
    const key = `${structure.title}|${structure.atoms.length}|${supercell.join(',')}`
    if (key !== framedKey.current) {
      framedKey.current = key

      const center = expanded.center ?? [0, 0, 0]

      // Bounding radius: farthest atom + its visual radius
      let maxR = 1
      for (const a of atoms) {
        const el = getElement(a.symbol)
        const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor
        const d  = Math.hypot(
          a.position[0] - center[0],
          a.position[1] - center[1],
          a.position[2] - center[2],
        ) + r
        if (d > maxR) maxR = d
      }

      frameCamera(camera, controls, center, maxR)

      stateRef.current.resetPos    = camera.position.clone()
      stateRef.current.resetTarget = controls.target.clone()
    }
  }, [structure, displayMode, supercell, customColors])

  // ---- Imperative API ------------------------------------------------------
  useImperativeHandle(ref, () => ({
    resetView() {
      const { camera, controls, resetPos, resetTarget } = stateRef.current
      if (!camera || !resetPos) return
      camera.position.copy(resetPos)
      controls.target.copy(resetTarget)
      const wasDamping = controls.enableDamping
      controls.enableDamping = false
      controls.update()
      controls.enableDamping = wasDamping
    },

    exportPNG(scale = 1, transparent = false) {
      const { renderer, scene, camera } = stateRef.current
      if (!renderer) return

      const origW = renderer.domElement.width
      const origH = renderer.domElement.height
      const origBg = scene.background

      scene.background = transparent ? null : new THREE.Color(0x0f1117)
      renderer.setSize(origW * scale, origH * scale, false)
      renderer.render(scene, camera)
      const dataURL = renderer.domElement.toDataURL('image/png')

      scene.background = origBg
      renderer.setSize(origW, origH, false)
      renderer.render(scene, camera)

      const a = document.createElement('a')
      a.href = dataURL
      a.download = `crystyte_${scale}x.png`
      a.click()
    },
  }), [])

  return <div ref={mountRef} className="viewer-canvas" />
})

export default CrystalViewer
