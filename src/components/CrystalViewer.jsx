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

// VESTA-style: Phong with subtle specular so atom color dominates
function makeMaterial() {
  return new THREE.MeshPhongMaterial({
    shininess: 80,
    specular:  new THREE.Color(0.15, 0.15, 0.15),
  })
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

function setPNGdpi(dataURL, dpi) {
  const base64 = dataURL.split(',')[1]
  const raw    = atob(base64)
  const src    = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) src[i] = raw.charCodeAt(i)

  const ppm  = Math.round(dpi / 0.0254)
  const phys = new Uint8Array(21)
  const dv   = new DataView(phys.buffer)
  dv.setUint32(0, 9)
  phys[4] = 0x70; phys[5] = 0x48; phys[6] = 0x59; phys[7] = 0x73
  dv.setUint32(8, ppm); dv.setUint32(12, ppm)
  phys[16] = 1
  dv.setUint32(17, crc32(phys, 4, 17))

  const out = new Uint8Array(src.length + 21)
  out.set(src.slice(0, 33)); out.set(phys, 33); out.set(src.slice(33), 54)
  let bin = ''; out.forEach(b => { bin += String.fromCharCode(b) })
  return 'data:image/png;base64,' + btoa(bin)
}

// ---- Geometry helpers -------------------------------------------------------
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

// ---- Camera framing with depth-cue fog --------------------------------------
// fog fades distant atoms to the background colour, giving VESTA-style depth
const WEB_BG    = new THREE.Color(0x1e2535)
const EXPORT_BG = new THREE.Color(0xffffff)

function frameCamera(camera, controls, center, radius, scene) {
  const c3      = new THREE.Vector3(center[0], center[1], center[2])
  const halfFov = 45 * Math.PI / 360
  const fitDist = (radius / Math.tan(halfFov)) * 1.35
  const dir     = new THREE.Vector3(0.55, 0.45, 1.0).normalize()

  camera.position.copy(c3).addScaledVector(dir, fitDist)
  camera.lookAt(c3)
  controls.target.copy(c3)

  if (camera.isPerspectiveCamera) {
    camera.near = Math.max(0.01, fitDist * 0.001)
    camera.far  = fitDist * 10 + radius * 10
  } else {
    const aspect = (camera.right - camera.left) / (camera.top - camera.bottom) || 1
    const halfH  = radius * 1.35
    camera.top = halfH;  camera.bottom = -halfH
    camera.right = halfH * aspect; camera.left = -halfH * aspect
    camera.near = 0.01;  camera.far = fitDist * 10 + radius * 10
  }
  camera.updateProjectionMatrix()
  controls.minDistance = radius * 0.05
  controls.maxDistance = fitDist * 20

  const was = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.enableDamping = was

  // Depth-cue fog: front atoms clear, back atoms fade to background
  if (scene) {
    scene.fog = new THREE.FogExp2(WEB_BG.getHex(), 0.35 / (fitDist + radius))
  }

  return fitDist
}

// ---- Component ---------------------------------------------------------------
const CrystalViewer = forwardRef(function CrystalViewer(
  { structure, displayMode, supercell, customColors, cameraMode },
  ref,
) {
  const mountRef  = useRef(null)
  const stateRef  = useRef({})
  const framedKey = useRef(null)

  // ---- Scene setup (once) --------------------------------------------------
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputEncoding = THREE.sRGBEncoding
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // Web viewer: dark background so depth-cue fog is visible
    scene.background = WEB_BG.clone()

    const perspCam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 2000)
    perspCam.position.set(15, 12, 20)

    // VESTA lighting: one key light from top-left-front + moderate ambient
    // No fill light — depth cueing handles depth perception instead
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(-4, 8, 5)   // top-left-front, matching VESTA default
    scene.add(key)

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

  // ---- Camera mode switch --------------------------------------------------
  useEffect(() => {
    const { perspCam, controls, renderer } = stateRef.current
    if (!controls) return

    if (cameraMode === 'ortho') {
      const dpr  = renderer.getPixelRatio()
      const w    = renderer.domElement.width  / dpr
      const h    = renderer.domElement.height / dpr
      const dist = perspCam.position.distanceTo(controls.target)
      const halfH = dist * Math.tan(perspCam.fov * Math.PI / 360)
      const orthoCam = new THREE.OrthographicCamera(
        -halfH * (w / h), halfH * (w / h), halfH, -halfH, 0.01, perspCam.far,
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
    const { scene, controls } = stateRef.current
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
    const mode  = MODES[displayMode] ?? MODES['ball-stick']
    const group = new THREE.Group()
    group.name  = 'structureGroup'

    // ---- Bond detection ----------------------------------------------------
    const bonds = mode.showBonds ? detectBonds(atoms, lattice, Linv) : []

    // ---- Ghost atoms + reverse bonds ---------------------------------------
    const ghostAtoms   = []
    const reverseBonds = []

    if (lattice && bonds.length) {
      const seenGhosts = new Set()
      const addGhost = (sym, pos) => {
        const k = sym + pos.map(x => Math.round(x * 100)).join(',')
        if (seenGhosts.has(k)) return
        seenGhosts.add(k)
        ghostAtoms.push({ symbol: sym, position: [...pos] })
      }
      for (const bond of bonds) {
        const pi = atoms[bond.i].position
        const pj = atoms[bond.j].position
        const dx = bond.end[0] - pi[0], dy = bond.end[1] - pi[1], dz = bond.end[2] - pi[2]
        if (
          Math.abs(dx - (pj[0] - pi[0])) > 0.01 ||
          Math.abs(dy - (pj[1] - pi[1])) > 0.01 ||
          Math.abs(dz - (pj[2] - pi[2])) > 0.01
        ) {
          addGhost(atoms[bond.j].symbol, bond.end)
          const ghostI = [pj[0] - dx, pj[1] - dy, pj[2] - dz]
          addGhost(atoms[bond.i].symbol, ghostI)
          reverseBonds.push({
            symStart: atoms[bond.j].symbol, symEnd: atoms[bond.i].symbol,
            start: pj,
            mid:  [(pj[0] + ghostI[0]) * 0.5, (pj[1] + ghostI[1]) * 0.5, (pj[2] + ghostI[2]) * 0.5],
            end:  ghostI,
          })
        }
      }
    }

    const allAtoms = ghostAtoms.length ? [...atoms, ...ghostAtoms] : atoms

    // ---- Atom InstancedMesh ------------------------------------------------
    const sphereGeo = new THREE.SphereGeometry(1, 36, 18)
    const atomMat   = makeMaterial()
    const atomMesh  = new THREE.InstancedMesh(sphereGeo, atomMat, allAtoms.length)
    atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const c3   = new THREE.Color()
    const mTmp = new THREE.Matrix4()
    const p3   = new THREE.Vector3()

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
    const allBondSegs = [...bonds, ...reverseBonds]
    if (mode.showBonds && allBondSegs.length) {
      const cylGeo   = new THREE.CylinderGeometry(1, 1, 1, 18, 1)
      const bondMat  = makeMaterial()
      const bondMesh = new THREE.InstancedMesh(cylGeo, bondMat, allBondSegs.length * 2)
      bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      let idx = 0
      for (const seg of allBondSegs) {
        const mA = cylinderMatrix(seg.start, seg.mid, mode.bondRadius)
        if (mA) bondMesh.setMatrixAt(idx, mA)
        const symA = seg.symStart ?? atoms[seg.i]?.symbol
        c3.set(customColors?.[symA] ?? getElement(symA).color)
        bondMesh.setColorAt(idx, c3); idx++

        const mB = cylinderMatrix(seg.mid, seg.end, mode.bondRadius)
        if (mB) bondMesh.setMatrixAt(idx, mB)
        const symB = seg.symEnd ?? atoms[seg.j]?.symbol
        c3.set(customColors?.[symB] ?? getElement(symB).color)
        bondMesh.setColorAt(idx, c3); idx++
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
        // Light gray like VESTA's cell box
        group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x888888 })))
      }
    }

    scene.add(group)

    // ---- Auto-frame --------------------------------------------------------
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
      frameCamera(cam, controls, center, maxR, scene)
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

    exportPNG(scale = 1) {
      const { renderer, scene, activeCamera } = stateRef.current
      if (!renderer || !activeCamera) return

      const TARGET_DPI = 600
      const dpr  = renderer.getPixelRatio()
      const cssW = renderer.domElement.width  / dpr
      const cssH = renderer.domElement.height / dpr

      // Ensure minimum ~3600px width → ≥6 in at 600 DPI
      const useScale = Math.max(scale, Math.ceil(3600 / cssW))

      // Switch to white background + white fog for VESTA-style export
      scene.background = EXPORT_BG.clone()
      if (scene.fog) scene.fog.color.copy(EXPORT_BG)

      renderer.setPixelRatio(1)
      renderer.setSize(cssW * useScale, cssH * useScale, false)

      if (activeCamera.isOrthographicCamera) {
        activeCamera.right = activeCamera.top * (cssW / cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }

      renderer.render(scene, activeCamera)
      const rawURL  = renderer.domElement.toDataURL('image/png')
      const dataURL = setPNGdpi(rawURL, TARGET_DPI)

      // Restore web background + dark fog
      scene.background = WEB_BG.clone()
      if (scene.fog) scene.fog.color.copy(WEB_BG)

      if (activeCamera.isOrthographicCamera) {
        activeCamera.right = activeCamera.top * (cssW / cssH)
        activeCamera.left  = -activeCamera.right
        activeCamera.updateProjectionMatrix()
      }
      renderer.setPixelRatio(dpr)
      renderer.setSize(cssW, cssH, false)
      renderer.render(scene, activeCamera)

      const a = document.createElement('a')
      a.href = dataURL
      a.download = `crystyte_${useScale}x_600dpi.png`
      a.click()
    },
  }), [])

  return <div ref={mountRef} className="viewer-canvas" />
})

export default CrystalViewer
