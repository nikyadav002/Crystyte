import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getElement, getElementColor } from '../lib/elements.js'
import { expandSupercell, detectBonds, cellBoxLines } from '../lib/structure.js'

const MODES = {
  'ball-stick': { atomFactor: 0.35, bondRadius: 0.10, showBonds: true,  showAtoms: true  },
  'spacefill':  { atomFactor: 1.0,  bondRadius: 0.10, showBonds: false, showAtoms: true, vdw: true },
  'stick':      { atomFactor: 0.12, bondRadius: 0.15, showBonds: true,  showAtoms: true  },
}

const BG      = new THREE.Color(0x0f1117)   // dark background (matches reference)
const EXPORT_BG = new THREE.Color(0xffffff) // white for publication exports

const LIGHT_PROFILES = {
  view:   { ambient: 0.82, hemi: 0.36, key: 0.42, fill: 0.24 },
  export: { ambient: 0.9, hemi: 0.28, key: 0.32, fill: 0.18 },
}

function makeAtomMaterial()  {
  return new THREE.MeshLambertMaterial()
}
function makeBondMaterial()  {
  return new THREE.MeshLambertMaterial()
}

function applyLightProfile(rig, profileName = 'view') {
  if (!rig) return
  const profile = LIGHT_PROFILES[profileName] ?? LIGHT_PROFILES.view
  rig.ambient.intensity = profile.ambient
  rig.hemi.intensity = profile.hemi
  rig.key.intensity = profile.key
  rig.fill.intensity = profile.fill
}

// ---- PNG DPI injection -------------------------------------------------------
function crc32(buf, start, end) {
  let crc = 0xFFFFFFFF
  for (let i = start; i < end; i++) {
    let b = buf[i]
    for (let k = 0; k < 8; k++) {
      if ((crc ^ b) & 1) crc = (crc >>> 1) ^ 0xEDB88320
      else crc >>>= 1
      b >>>= 1
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function injectDPI(dataURL, dpi) {
  const bin  = atob(dataURL.split(',')[1])
  const src  = Uint8Array.from(bin, c => c.charCodeAt(0))
  const ppm  = Math.round(dpi / 0.0254)      // pixels per metre
  const phys = new Uint8Array(21)
  const dv   = new DataView(phys.buffer)
  dv.setUint32(0, 9)                          // chunk data length
  phys.set([0x70,0x48,0x59,0x73], 4)          // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm) // X, Y ppm
  phys[16] = 1                                // unit = metre
  dv.setUint32(17, crc32(phys, 4, 17))
  // insert after PNG sig (8) + IHDR (25) = offset 33
  const out = new Uint8Array(src.length + 21)
  out.set(src.slice(0, 33)); out.set(phys, 33); out.set(src.slice(33), 54)
  // Chunked to avoid stack overflow on large (multi-MB) PNG arrays
  let b64 = ''
  for (let i = 0; i < out.length; i += 8192)
    b64 += String.fromCharCode.apply(null, out.subarray(i, i + 8192))
  return 'data:image/png;base64,' + btoa(b64)
}

// ---- Geometry ---------------------------------------------------------------
function cylinderMatrix(start, end, radius) {
  const dx = end[0]-start[0], dy = end[1]-start[1], dz = end[2]-start[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-6) return null
  const q = new THREE.Quaternion()
  q.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(dx/len, dy/len, dz/len))
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3((start[0]+end[0])*.5, (start[1]+end[1])*.5, (start[2]+end[2])*.5),
    q, new THREE.Vector3(radius, len, radius),
  )
  return m
}

// ---- Camera + depth-cue fog -------------------------------------------------
function frameCamera(camera, controls, center, radius) {
  const c3      = new THREE.Vector3(...center)
  const halfFov = 45 * Math.PI / 360
  const fitDist = (radius / Math.tan(halfFov)) * 1.35
  const dir     = new THREE.Vector3(0.55, 0.45, 1.0).normalize()

  camera.position.copy(c3).addScaledVector(dir, fitDist)
  camera.lookAt(c3)
  controls.target.copy(c3)

  const far = fitDist * 10 + radius * 10
  if (camera.isPerspectiveCamera) {
    camera.near = Math.max(0.01, fitDist * 0.001)
    camera.far  = far
  } else {
    const aspect = (camera.right - camera.left) / (camera.top - camera.bottom) || 1
    const halfH  = radius * 1.35
    camera.top = halfH;  camera.bottom = -halfH
    camera.right = halfH * aspect;  camera.left = -halfH * aspect
    camera.near = 0.01;  camera.far = far
  }
  camera.updateProjectionMatrix()
  controls.minDistance = radius * 0.05
  controls.maxDistance = fitDist * 20

  const was = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.enableDamping = was

  return fitDist
}

// =============================================================================
const CrystalViewer = forwardRef(function CrystalViewer(
  { structure, displayMode, supercell, customColors, cameraMode },
  ref,
) {
  const mountRef  = useRef(null)
  const stateRef  = useRef({})
  const framedKey = useRef(null)

  // ---- Scene setup (runs once) --------------------------------------------
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.NoToneMapping
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = BG.clone()

    const perspCam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 2000)
    perspCam.position.set(15, 12, 20)

    const ambient = new THREE.AmbientLight(0xffffff, 1)
    scene.add(ambient)

    // Keep lighting aligned with the camera so atoms do not split into a bright
    // and dark side when the model rotates relative to world-space lights.
    const lightRigRoot = new THREE.Group()
    scene.add(lightRigRoot)

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1)
    hemi.position.set(0, 2.5, 1.5)
    lightRigRoot.add(hemi)

    const keyTarget = new THREE.Object3D()
    keyTarget.position.set(0, 0, -8)
    lightRigRoot.add(keyTarget)
    const key = new THREE.DirectionalLight(0xffffff, 1)
    key.position.set(2.4, 2.8, 5.5)
    key.target = keyTarget
    lightRigRoot.add(key)

    const fillTarget = new THREE.Object3D()
    fillTarget.position.set(0, 0, -8)
    lightRigRoot.add(fillTarget)
    const fill = new THREE.DirectionalLight(0xf6f7ff, 1)
    fill.position.set(-2.6, 0.9, 4.4)
    fill.target = fillTarget
    lightRigRoot.add(fill)

    const lightRig = { ambient, hemi, key, fill, root: lightRigRoot }
    applyLightProfile(lightRig, 'view')

    const controls = new OrbitControls(perspCam, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.08
    controls.screenSpacePanning = true

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      const activeCamera = stateRef.current.activeCamera ?? perspCam
      lightRigRoot.position.copy(activeCamera.position)
      lightRigRoot.quaternion.copy(activeCamera.quaternion)
      renderer.render(scene, activeCamera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      perspCam.aspect = w / h
      perspCam.updateProjectionMatrix()
      const active = stateRef.current.activeCamera
      if (active?.isOrthographicCamera) {
        const hH = active.top
        active.right = hH*(w/h); active.left = -hH*(w/h)
        active.updateProjectionMatrix()
      }
      renderer.setSize(w, h)
    })
    ro.observe(el)

    stateRef.current = {
      renderer,
      scene,
      perspCam,
      activeCamera: perspCam,
      controls,
      animId,
      ro,
      lightRig,
    }

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ---- Perspective ↔ Ortho ------------------------------------------------
  useEffect(() => {
    const { perspCam, controls, renderer } = stateRef.current
    if (!controls) return

    if (cameraMode === 'ortho') {
      const dpr  = renderer.getPixelRatio()
      const w    = renderer.domElement.width  / dpr
      const h    = renderer.domElement.height / dpr
      const dist = perspCam.position.distanceTo(controls.target)
      const halfH = dist * Math.tan(perspCam.fov * Math.PI / 360)
      const oCam  = new THREE.OrthographicCamera(
        -halfH*(w/h), halfH*(w/h), halfH, -halfH, 0.01, perspCam.far,
      )
      oCam.position.copy(perspCam.position)
      oCam.quaternion.copy(perspCam.quaternion)
      oCam.updateProjectionMatrix()
      controls.object = oCam
      stateRef.current.activeCamera = oCam
    } else {
      controls.object = perspCam
      stateRef.current.activeCamera = perspCam
    }
    const was = controls.enableDamping
    controls.enableDamping = false; controls.update(); controls.enableDamping = was
  }, [cameraMode])

  // ---- Rebuild geometry ---------------------------------------------------
  useEffect(() => {
    const { scene, controls } = stateRef.current
    if (!scene) return

    const old = scene.getObjectByName('structureGroup')
    if (old) { old.traverse(o => { o.geometry?.dispose(); o.material?.dispose() }); scene.remove(old) }

    if (!structure?.atoms?.length) return
    const expanded = expandSupercell(structure, supercell)
    if (!expanded) return

    const { atoms, lattice, Linv } = expanded
    const mode  = MODES[displayMode] ?? MODES['ball-stick']
    const group = new THREE.Group()
    group.name  = 'structureGroup'

    const bonds = mode.showBonds ? detectBonds(atoms, lattice, Linv) : []

    // Ghost atoms & reverse bonds for cross-boundary bonds
    const ghostAtoms   = []
    const reverseBonds = []
    if (lattice && bonds.length) {
      const seen = new Set()
      const addGhost = (sym, pos) => {
        const k = sym + pos.map(x => Math.round(x*100)).join(',')
        if (seen.has(k)) return; seen.add(k)
        ghostAtoms.push({ symbol: sym, position: [...pos] })
      }
      for (const bond of bonds) {
        const pi = atoms[bond.i].position, pj = atoms[bond.j].position
        const dx = bond.end[0]-pi[0], dy = bond.end[1]-pi[1], dz = bond.end[2]-pi[2]
        if (Math.abs(dx-(pj[0]-pi[0]))>0.01 || Math.abs(dy-(pj[1]-pi[1]))>0.01 || Math.abs(dz-(pj[2]-pi[2]))>0.01) {
          addGhost(atoms[bond.j].symbol, bond.end)
          const gI = [pj[0]-dx, pj[1]-dy, pj[2]-dz]
          addGhost(atoms[bond.i].symbol, gI)
          reverseBonds.push({
            symStart: atoms[bond.j].symbol, symEnd: atoms[bond.i].symbol,
            start: pj, mid: [(pj[0]+gI[0])*.5,(pj[1]+gI[1])*.5,(pj[2]+gI[2])*.5], end: gI,
          })
        }
      }
    }

    const allAtoms = ghostAtoms.length ? [...atoms, ...ghostAtoms] : atoms

    // Atoms
    const sphereGeo = new THREE.SphereGeometry(1, 36, 18)
    const atomMat   = makeAtomMaterial()
    const atomMesh  = new THREE.InstancedMesh(sphereGeo, atomMat, allAtoms.length)
    atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const col  = new THREE.Color()
    const mat4 = new THREE.Matrix4()
    const pos  = new THREE.Vector3()
    for (let i = 0; i < allAtoms.length; i++) {
      const { symbol, position } = allAtoms[i]
      const el = getElement(symbol)
      const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor
      pos.set(...position)
      mat4.makeScale(r, r, r)
      mat4.setPosition(pos)
      atomMesh.setMatrixAt(i, mat4)
      col.set(customColors?.[symbol] ?? getElementColor(symbol))
      atomMesh.setColorAt(i, col)
    }
    atomMesh.instanceMatrix.needsUpdate = true
    if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true
    atomMesh.visible = mode.showAtoms
    group.add(atomMesh)

    // Bonds
    const allSegs = [...bonds, ...reverseBonds]
    if (mode.showBonds && allSegs.length) {
      const cylGeo  = new THREE.CylinderGeometry(1, 1, 1, 18, 1)
      const bondMat = makeBondMaterial()
      const mesh    = new THREE.InstancedMesh(cylGeo, bondMat, allSegs.length * 2)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      let idx = 0
      for (const seg of allSegs) {
        const mA = cylinderMatrix(seg.start, seg.mid, mode.bondRadius)
        if (mA) mesh.setMatrixAt(idx, mA)
        col.set(customColors?.[seg.symStart ?? atoms[seg.i]?.symbol] ?? getElementColor(seg.symStart ?? atoms[seg.i]?.symbol))
        mesh.setColorAt(idx, col); idx++

        const mB = cylinderMatrix(seg.mid, seg.end, mode.bondRadius)
        if (mB) mesh.setMatrixAt(idx, mB)
        col.set(customColors?.[seg.symEnd ?? atoms[seg.j]?.symbol] ?? getElementColor(seg.symEnd ?? atoms[seg.j]?.symbol))
        mesh.setColorAt(idx, col); idx++
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      group.add(mesh)
    }

    // Cell box
    if (lattice) {
      const pts = cellBoxLines(lattice)
      if (pts) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
        group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x444444 })))
      }
    }

    scene.add(group)

    // Auto-frame only when structure/supercell changes
    const fKey = `${structure.title}|${structure.atoms.length}|${supercell.join(',')}`
    if (fKey !== framedKey.current) {
      framedKey.current = fKey
      const center = expanded.center ?? [0,0,0]
      let maxR = 1
      for (const a of allAtoms) {
        const el = getElement(a.symbol)
        const r  = mode.vdw ? el.vdw : el.radius * mode.atomFactor
        const d  = Math.hypot(...a.position.map((v,i) => v - center[i])) + r
        if (d > maxR) maxR = d
      }
      const cam = stateRef.current.activeCamera ?? stateRef.current.perspCam
      frameCamera(cam, controls, center, maxR)
      stateRef.current.resetPos    = cam.position.clone()
      stateRef.current.resetTarget = controls.target.clone()
    }
  }, [structure, displayMode, supercell, customColors])

  // ---- Imperative handle --------------------------------------------------
  useImperativeHandle(ref, () => ({
    resetView() {
      const { activeCamera, controls, resetPos, resetTarget } = stateRef.current
      if (!activeCamera || !resetPos) return
      activeCamera.position.copy(resetPos)
      controls.target.copy(resetTarget)
      const was = controls.enableDamping
      controls.enableDamping = false; controls.update(); controls.enableDamping = was
    },

    exportPNG(scale = 1) {
      const { renderer, scene, activeCamera, lightRig } = stateRef.current
      if (!renderer || !activeCamera) return

      const dpr  = renderer.getPixelRatio()
      const cssW = renderer.domElement.width  / dpr
      const cssH = renderer.domElement.height / dpr
      const s    = Math.max(scale, Math.ceil(3600 / cssW))

      // White background for publication export
      scene.background = EXPORT_BG.clone()
      applyLightProfile(lightRig, 'export')
      lightRig.root.position.copy(activeCamera.position)
      lightRig.root.quaternion.copy(activeCamera.quaternion)
      renderer.setPixelRatio(1)
      renderer.setSize(cssW * s, cssH * s, false)
      if (activeCamera.isOrthographicCamera) {
        activeCamera.right = activeCamera.top * (cssW/cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }
      renderer.render(scene, activeCamera)
      const url = injectDPI(renderer.domElement.toDataURL('image/png'), 600)

      // Restore dark background
      scene.background = BG.clone()
      applyLightProfile(lightRig, 'view')
      lightRig.root.position.copy(activeCamera.position)
      lightRig.root.quaternion.copy(activeCamera.quaternion)
      renderer.setPixelRatio(dpr)
      renderer.setSize(cssW, cssH, false)
      if (activeCamera.isOrthographicCamera) {
        activeCamera.right = activeCamera.top * (cssW/cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }
      renderer.render(scene, activeCamera)

      const a = document.createElement('a')
      a.href = url; a.download = `crystyte_${s}x_600dpi.png`; a.click()
    },
  }), [])

  return <div ref={mountRef} className="viewer-canvas" />
})

export default CrystalViewer
