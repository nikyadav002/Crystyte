import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getElement } from '../lib/elements.js'
import { expandSupercell, detectBonds, cellBoxLines } from '../lib/structure.js'

const MODES = {
  'ball-stick': { atomFactor: 0.35, bondRadius: 0.13, showBonds: true,  showAtoms: true  },
  'spacefill':  { atomFactor: 1.0,  bondRadius: 0.13, showBonds: false, showAtoms: true, vdw: true },
  'stick':      { atomFactor: 0.12, bondRadius: 0.18, showBonds: true,  showAtoms: true  },
}

// Fully matte — no specular highlight
function makeMaterial(opts = {}) {
  return new THREE.MeshLambertMaterial(opts)
}

function cylinderMatrix(start, end, radius) {
  const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-6) return null
  const q = new THREE.Quaternion()
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len))
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3((start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5, (start[2] + end[2]) * 0.5),
    q,
    new THREE.Vector3(radius, len, radius),
  )
  return m
}

// Frame camera so the bounding sphere fits the viewport.
// Works for both PerspectiveCamera and OrthographicCamera.
function frameCamera(camera, controls, center, radius) {
  const c3 = new THREE.Vector3(center[0], center[1], center[2])
  const halfFov  = 45 * Math.PI / 360          // use 45° regardless of current camera
  const fitDist  = (radius / Math.tan(halfFov)) * 1.35
  const dir      = new THREE.Vector3(0.55, 0.45, 1.0).normalize()

  camera.position.copy(c3).addScaledVector(dir, fitDist)
  camera.lookAt(c3)
  controls.target.copy(c3)

  if (camera.isPerspectiveCamera) {
    camera.near = Math.max(0.01, fitDist * 0.001)
    camera.far  = fitDist * 8 + radius * 8
  } else {
    // OrthographicCamera: set frustum to match bounding sphere
    const aspect = (camera.right - camera.left) / (camera.top - camera.bottom) || 1
    const halfH  = radius * 1.35
    camera.top = halfH;  camera.bottom = -halfH
    camera.right = halfH * aspect; camera.left = -halfH * aspect
    camera.near = 0.01;  camera.far = fitDist * 8 + radius * 8
  }
  camera.updateProjectionMatrix()
  controls.minDistance = radius * 0.05
  controls.maxDistance = fitDist * 20

  const was = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.enableDamping = was
}

// ---- Component ---------------------------------------------------------------

const CrystalViewer = forwardRef(function CrystalViewer(
  { structure, displayMode, supercell, customColors, transparentBg, cameraMode },
  ref,
) {
  const mountRef  = useRef(null)
  const stateRef  = useRef({})
  const framedKey = useRef(null)

  // ---- Scene setup (once) --------------------------------------------------
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputEncoding = THREE.sRGBEncoding
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f1117)

    // Perspective camera (default)
    const perspCam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 2000)
    perspCam.position.set(15, 12, 20)

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 0.8)
    key.position.set(5, 8, 6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xccddff, 0.3)
    fill.position.set(-5, -3, -4)
    scene.add(fill)

    const controls = new OrbitControls(perspCam, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = true

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, stateRef.current.activeCamera ?? perspCam)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      perspCam.aspect = w / h
      perspCam.updateProjectionMatrix()
      const active = stateRef.current.activeCamera
      if (active?.isOrthographicCamera) {
        const halfH = active.top
        active.right = halfH * (w / h); active.left = -halfH * (w / h)
        active.updateProjectionMatrix()
      }
      renderer.setSize(w, h)
    })
    ro.observe(el)

    stateRef.current = { renderer, scene, perspCam, activeCamera: perspCam, controls, animId, ro }

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ---- Background ----------------------------------------------------------
  useEffect(() => {
    const { scene } = stateRef.current
    if (!scene) return
    scene.background = transparentBg ? null : new THREE.Color(0x0f1117)
  }, [transparentBg])

  // ---- Camera mode switch --------------------------------------------------
  useEffect(() => {
    const { perspCam, controls, renderer } = stateRef.current
    if (!controls) return

    if (cameraMode === 'ortho') {
      const dpr    = renderer.getPixelRatio()
      const w      = renderer.domElement.width  / dpr
      const h      = renderer.domElement.height / dpr
      const aspect = w / h

      // Match the current perspective view
      const dist   = perspCam.position.distanceTo(controls.target)
      const halfH  = dist * Math.tan(perspCam.fov * Math.PI / 360)
      const orthoCam = new THREE.OrthographicCamera(
        -halfH * aspect, halfH * aspect, halfH, -halfH, 0.01, perspCam.far,
      )
      orthoCam.position.copy(perspCam.position)
      orthoCam.quaternion.copy(perspCam.quaternion)
      orthoCam.updateProjectionMatrix()

      controls.object = orthoCam
      stateRef.current.activeCamera = orthoCam
    } else {
      controls.object = perspCam
      stateRef.current.activeCamera = perspCam
    }

    const was = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = was
  }, [cameraMode])

  // ---- Rebuild geometry ----------------------------------------------------
  useEffect(() => {
    const { scene, activeCamera, controls } = stateRef.current
    if (!scene) return

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

    // ---- Bonds (before atoms, so we can collect ghost atoms) ---------------
    let bonds = []
    if (mode.showBonds) bonds = detectBonds(atoms, lattice, Linv)

    // ---- Ghost atoms: images outside the cell for boundary-crossing bonds --
    // For each bond that crosses a cell boundary, the MIC-corrected end-point
    // is different from the atom's actual stored position.  We render a sphere
    // at that image location so the bond doesn't appear to float in space.
    const ghostAtoms = []
    if (lattice && bonds.length) {
      const seen = new Set()
      for (const bond of bonds) {
        const ap = atoms[bond.j].position
        if (
          Math.abs(bond.end[0] - ap[0]) > 0.01 ||
          Math.abs(bond.end[1] - ap[1]) > 0.01 ||
          Math.abs(bond.end[2] - ap[2]) > 0.01
        ) {
          const key = atoms[bond.j].symbol + bond.end.map(x => Math.round(x * 100)).join(',')
          if (!seen.has(key)) {
            seen.add(key)
            ghostAtoms.push({ symbol: atoms[bond.j].symbol, position: bond.end })
          }
        }
      }
    }

    // Also collect ghost atoms needed for the other end (atom i bonding to j
    // outside the cell — symmetric case)
    if (lattice && bonds.length) {
      const seen = new Set(ghostAtoms.map(g => g.symbol + g.position.map(x => Math.round(x * 100)).join(',')))
      for (const bond of bonds) {
        // bond.start is always atoms[bond.i].position (no MIC shift on start)
        // Check if atom j's actual position is "inside" but atom i is actually the
        // image needing to be shown.  We handle both directions by also checking
        // a reverse bond: from j toward i image.
        const ap = atoms[bond.i].position
        // The reverse direction: from j toward i with MIC
        const rdx = ap[0] - atoms[bond.j].position[0]
        const rdy = ap[1] - atoms[bond.j].position[1]
        const rdz = ap[2] - atoms[bond.j].position[2]
        // We already handle this via bond.start === atoms[bond.i].position,
        // so no extra ghost needed for i.
        void rdx; void rdy; void rdz
      }
    }

    const allAtoms = ghostAtoms.length ? [...atoms, ...ghostAtoms] : atoms

    // ---- Atom InstancedMesh ------------------------------------------------
    const sphereGeo = new THREE.SphereGeometry(1, 28, 14)
    const atomMat   = makeMaterial()
    const atomMesh  = new THREE.InstancedMesh(sphereGeo, atomMat, allAtoms.length)
    atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const c3    = new THREE.Color()
    const mTmp  = new THREE.Matrix4()
    const p3    = new THREE.Vector3()

    for (let i = 0; i < allAtoms.length; i++) {
      const { symbol, position } = allAtoms[i]
      const el = getElement(symbol)
      const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor
      p3.set(position[0], position[1], position[2])
      mTmp.makeScale(r, r, r)
      mTmp.setPosition(p3)
      atomMesh.setMatrixAt(i, mTmp)
      c3.set(customColors?.[symbol] ?? el.color)
      atomMesh.setColorAt(i, c3)
    }
    atomMesh.instanceMatrix.needsUpdate = true
    if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true
    atomMesh.visible = mode.showAtoms
    group.add(atomMesh)

    // ---- Bond InstancedMesh ------------------------------------------------
    if (mode.showBonds && bonds.length) {
      const cylGeo   = new THREE.CylinderGeometry(1, 1, 1, 10, 1)
      const bondMat  = makeMaterial()
      const bondMesh = new THREE.InstancedMesh(cylGeo, bondMat, bonds.length * 2)
      bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      let idx = 0
      for (const bond of bonds) {
        const mI = cylinderMatrix(bond.start, bond.mid, mode.bondRadius)
        if (mI) bondMesh.setMatrixAt(idx, mI)
        c3.set(customColors?.[atoms[bond.i].symbol] ?? getElement(atoms[bond.i].symbol).color)
        bondMesh.setColorAt(idx, c3)
        idx++

        const mJ = cylinderMatrix(bond.mid, bond.end, mode.bondRadius)
        if (mJ) bondMesh.setMatrixAt(idx, mJ)
        c3.set(customColors?.[atoms[bond.j].symbol] ?? getElement(atoms[bond.j].symbol).color)
        bondMesh.setColorAt(idx, c3)
        idx++
      }
      bondMesh.instanceMatrix.needsUpdate = true
      if (bondMesh.instanceColor) bondMesh.instanceColor.needsUpdate = true
      group.add(bondMesh)
    }

    // ---- Unit cell box -----------------------------------------------------
    if (lattice) {
      const pts = cellBoxLines(lattice)
      if (pts) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
        group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x4488ff })))
      }
    }

    scene.add(group)

    // ---- Auto-frame (only on structure / supercell change) -----------------
    const key = `${structure.title}|${structure.atoms.length}|${supercell.join(',')}`
    if (key !== framedKey.current) {
      framedKey.current = key
      const center = expanded.center ?? [0, 0, 0]
      let maxR = 1
      for (const a of allAtoms) {
        const el = getElement(a.symbol)
        const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor
        const d  = Math.hypot(
          a.position[0] - center[0],
          a.position[1] - center[1],
          a.position[2] - center[2],
        ) + r
        if (d > maxR) maxR = d
      }

      const cam = stateRef.current.activeCamera ?? stateRef.current.perspCam
      frameCamera(cam, controls, center, maxR)
      stateRef.current.resetPos    = cam.position.clone()
      stateRef.current.resetTarget = controls.target.clone()
    }
  }, [structure, displayMode, supercell, customColors])

  // ---- Imperative API ------------------------------------------------------
  useImperativeHandle(ref, () => ({
    resetView() {
      const { activeCamera, controls, resetPos, resetTarget } = stateRef.current
      if (!activeCamera || !resetPos) return
      activeCamera.position.copy(resetPos)
      controls.target.copy(resetTarget)
      const was = controls.enableDamping
      controls.enableDamping = false
      controls.update()
      controls.enableDamping = was
    },

    exportPNG(scale = 1, transparent = false) {
      const { renderer, scene, activeCamera } = stateRef.current
      if (!renderer || !activeCamera) return

      const origBg = scene.background
      const dpr    = renderer.getPixelRatio()
      const cssW   = renderer.domElement.width  / dpr
      const cssH   = renderer.domElement.height / dpr

      scene.background = transparent ? null : new THREE.Color(0x0f1117)
      renderer.setPixelRatio(1)
      renderer.setSize(cssW * scale, cssH * scale, false)

      // For orthographic camera, scale the frustum to match export aspect ratio
      if (activeCamera.isOrthographicCamera) {
        const halfH = activeCamera.top
        activeCamera.right = halfH * (cssW / cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }

      renderer.render(scene, activeCamera)
      const dataURL = renderer.domElement.toDataURL('image/png')

      // Restore
      if (activeCamera.isOrthographicCamera) {
        activeCamera.right = activeCamera.top * (cssW / cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }
      renderer.setPixelRatio(dpr)
      renderer.setSize(cssW, cssH, false)
      scene.background = origBg
      renderer.render(scene, activeCamera)

      const a = document.createElement('a')
      a.href = dataURL
      a.download = `crystyte_${scale}x.png`
      a.click()
    },
  }), [])

  return <div ref={mountRef} className="viewer-canvas" />
})

export default CrystalViewer
