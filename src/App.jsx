import { useState, useCallback, useRef, useMemo } from 'react'
import CrystalViewer from './components/CrystalViewer.jsx'
import DropZone     from './components/DropZone.jsx'
import InfoPanel    from './components/InfoPanel.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import { getBondRule, getBondRuleKey } from './lib/bondingLogic.js'
import { getElement } from './lib/elements.js'
import { BOND_SCALE, MIN_BOND, expandSupercell, serializeCIF, serializePOSCAR } from './lib/structure.js'

const createWorker = () =>
  new Worker(new URL('./workers/parser.worker.js', import.meta.url), { type: 'module' })

const DISPLAY_MODES = [
  { id: 'ball-stick', label: 'Ball & Stick' },
  { id: 'spacefill',  label: 'Spacefill'    },
  { id: 'stick',      label: 'Stick'        },
]

function getFallbackBondRule(symA, symB) {
  return {
    min: MIN_BOND,
    max: (getElement(symA).radius + getElement(symB).radius) * BOND_SCALE,
  }
}

function getBaseBondRule(symA, symB) {
  return getBondRule(symA, symB) ?? getFallbackBondRule(symA, symB)
}

function getSupercellFilename(filename, supercell) {
  const stem = (filename ?? 'crystyte_crystal').replace(/\.[^.]+$/, '')
  return `${stem}_${supercell.join('x')}`
}

function getDefaultSaveFormat(filename) {
  return /\.cif$/i.test(filename ?? '') ? 'cif' : 'vasp'
}

export default function App() {
  const [structure,     setStructure]     = useState(null)
  const [displayMode,   setDisplayMode]   = useState('ball-stick')
  const [supercell,     setSupercell]     = useState([1, 1, 1])
  const [customColors,  setCustomColors]  = useState({})
  const [bondOverrides, setBondOverrides] = useState({})
  const [bondPair,      setBondPair]      = useState(['C', 'C'])
  const [showPolyhedra, setShowPolyhedra] = useState(false)
  const [saveFormat,    setSaveFormat]    = useState('vasp')
  const [exportScale,   setExportScale]   = useState(4)
  const [cameraMode,    setCameraMode]    = useState('ortho')
  const [theme,         setTheme]         = useState('light')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  const viewerRef    = useRef(null)
  const workerRef    = useRef(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((text, filename) => {
    setLoading(true)
    setError(null)
    setCustomColors({})
    setBondOverrides({})
    setSaveFormat(getDefaultSaveFormat(filename))
    setSupercell([1, 1, 1])
    workerRef.current?.terminate()
    const w = createWorker()
    workerRef.current = w
    w.onmessage = ({ data }) => {
      setLoading(false)
      if (data.error) {
        setError(data.error)
      } else {
        setStructure({
          ...data.structure,
          sourceFilename: filename,
        })
      }
      w.terminate()
    }
    w.onerror = (e) => { setLoading(false); setError(e.message ?? 'Parse error'); w.terminate() }
    w.postMessage({ text, filename })
  }, [])

  const handleColorChange = useCallback((sym, color) => {
    setCustomColors(prev => ({ ...prev, [sym]: color }))
  }, [])

  const handleBondPairChange = useCallback((pair) => {
    setBondPair(pair)
  }, [])

  const elementSymbols = useMemo(() => (
    structure?.atoms
      ? [...new Set(structure.atoms.map(a => a.symbol))].sort()
      : []
  ), [structure])

  const effectiveBondPair = useMemo(() => {
    if (!elementSymbols.length) return bondPair
    if (
      bondPair[0] &&
      bondPair[1] &&
      elementSymbols.includes(bondPair[0]) &&
      elementSymbols.includes(bondPair[1])
    ) return bondPair
    return [elementSymbols[0], elementSymbols[1] ?? elementSymbols[0]]
  }, [bondPair, elementSymbols])

  const handleBondRuleChange = useCallback((field, value) => {
    const parsed = Number.parseFloat(value)
    const nextValue = Number.isFinite(parsed) ? parsed : 0
    const key = getBondRuleKey(effectiveBondPair[0], effectiveBondPair[1])
    setBondOverrides(prev => {
      const base = prev[key] ?? getBaseBondRule(effectiveBondPair[0], effectiveBondPair[1])
      return {
        ...prev,
        [key]: {
          enabled: true,
          min: field === 'min' ? nextValue : base.min,
          max: field === 'max' ? nextValue : base.max,
        },
      }
    })
  }, [effectiveBondPair])

  const handleBondRuleCreate = useCallback(() => {
    const key = getBondRuleKey(effectiveBondPair[0], effectiveBondPair[1])
    setBondOverrides(prev => {
      const base = prev[key] ?? getBaseBondRule(effectiveBondPair[0], effectiveBondPair[1])
      return {
        ...prev,
        [key]: {
          min: base.min,
          max: base.max,
          enabled: true,
        },
      }
    })
  }, [effectiveBondPair])

  const handleBondRuleDelete = useCallback(() => {
    const key = getBondRuleKey(effectiveBondPair[0], effectiveBondPair[1])
    setBondOverrides(prev => {
      const base = prev[key] ?? getBaseBondRule(effectiveBondPair[0], effectiveBondPair[1])
      return {
        ...prev,
        [key]: {
          min: base.min,
          max: base.max,
          enabled: false,
        },
      }
    })
  }, [effectiveBondPair])

  const handleBondRuleReset = useCallback(() => {
    const key = getBondRuleKey(effectiveBondPair[0], effectiveBondPair[1])
    setBondOverrides(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [effectiveBondPair])

  const handleExport = useCallback(() => viewerRef.current?.exportPNG(exportScale), [exportScale])
  const handleSaveSupercell = useCallback(() => {
    if (!structure) return

    const expanded = expandSupercell(structure, supercell) ?? structure
    if (!expanded.lattice) {
      setError('Saving as VASP or CIF requires lattice information')
      return
    }

    const title = [expanded.title || structure.title || 'crystyte supercell', `supercell ${supercell.join('x')}`]
      .filter(Boolean)
      .join(' | ')
    const text = saveFormat === 'cif'
      ? serializeCIF(expanded, title)
      : serializePOSCAR(expanded, title)
    const extension = saveFormat === 'cif' ? '.cif' : '.vasp'
    const mimeType = saveFormat === 'cif' ? 'chemical/x-cif' : 'chemical/x-vasp'
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${getSupercellFilename(structure.sourceFilename, supercell)}${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }, [saveFormat, structure, supercell])
  const handleReset  = useCallback(() => viewerRef.current?.resetView(), [])
  const handleOpen   = useCallback(() => fileInputRef.current?.click(), [])
  const handleViewAxis = useCallback((axis) => viewerRef.current?.viewAxis(axis), [])

  const activeBondKey = getBondRuleKey(effectiveBondPair[0], effectiveBondPair[1])
  const activeBondOverride = activeBondKey ? bondOverrides[activeBondKey] : null
  const activeBondRule = effectiveBondPair[0] && effectiveBondPair[1]
    ? activeBondOverride ?? getBondRule(effectiveBondPair[0], effectiveBondPair[1]) ?? getFallbackBondRule(effectiveBondPair[0], effectiveBondPair[1])
    : null
  const activeBondState = activeBondOverride
    ? (activeBondOverride.enabled === false ? 'disabled' : 'custom')
    : (getBondRule(effectiveBondPair[0], effectiveBondPair[1]) ? 'default' : 'fallback')

  const onInputChange = useCallback((e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => handleFile(ev.target.result, f.name)
    reader.readAsText(f)
    e.target.value = ''
  }, [handleFile])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            <line x1="12" y1="2"  x2="12" y2="22"/>
            <line x1="2"  y1="8.5" x2="22" y2="8.5"/>
            <line x1="2"  y1="15.5" x2="22" y2="15.5"/>
          </svg>
          <span className="logo-text">crystyte</span>
        </div>

        {loading && <div className="status-badge loading-badge"><span className="spinner" /> Parsing…</div>}
        {error && (
          <div className="status-badge error-badge">
            <span>Parse error — {error.slice(0, 80)}</span>
            <button className="badge-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="header-right">
          <label className="header-select-wrap">
            <span className="header-select-label">Mode</span>
            <select
              className="header-select"
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value)}
              disabled={!structure}
            >
              {DISPLAY_MODES.map(mode => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
          </label>
          <button className="btn-theme" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? (
              /* moon icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              /* sun icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1"  x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1"  y1="12" x2="3"  y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
        </div>

        <input ref={fileInputRef} type="file"
          accept=".cif,.xyz,.poscar,.contcar,.vasp,POSCAR,CONTCAR"
          style={{ display: 'none' }} onChange={onInputChange} />
      </header>

      <div className="app-body">
        <main className="viewer-area">
          {!structure && !loading && <DropZone onFile={handleFile} />}
          <CrystalViewer
            ref={viewerRef}
            structure={structure}
            displayMode={displayMode}
            supercell={supercell}
            customColors={customColors}
            cameraMode={cameraMode}
            bondOverrides={bondOverrides}
            showPolyhedra={showPolyhedra}
          />
        </main>
        <InfoPanel
          structure={structure}
          customColors={customColors}
          onColorChange={handleColorChange}
          bondPair={effectiveBondPair}
          onBondPairChange={handleBondPairChange}
          bondRule={activeBondRule}
          bondRuleState={activeBondState}
          onBondRuleChange={handleBondRuleChange}
          onBondRuleCreate={handleBondRuleCreate}
          onBondRuleDelete={handleBondRuleDelete}
          onBondRuleReset={handleBondRuleReset}
        />
      </div>

      <ControlPanel
        supercell={supercell}           onSupercell={setSupercell}
        exportScale={exportScale}       onExportScale={setExportScale}
        cameraMode={cameraMode}         onCameraMode={setCameraMode}
        showPolyhedra={showPolyhedra}   onShowPolyhedra={setShowPolyhedra}
        saveFormat={saveFormat}         onSaveFormat={setSaveFormat}
        onViewAxis={handleViewAxis}
        onReset={handleReset}
        onOpen={handleOpen}
        onSaveSupercell={handleSaveSupercell}
        onExport={handleExport}
        hasStructure={Boolean(structure)}
      />
    </div>
  )
}
