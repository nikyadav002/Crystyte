import { useState, useCallback, useRef } from 'react'
import CrystalViewer from './components/CrystalViewer.jsx'
import DropZone     from './components/DropZone.jsx'
import InfoPanel    from './components/InfoPanel.jsx'
import ControlPanel from './components/ControlPanel.jsx'

const createWorker = () =>
  new Worker(new URL('./workers/parser.worker.js', import.meta.url), { type: 'module' })

export default function App() {
  const [structure,     setStructure]     = useState(null)
  const [displayMode,   setDisplayMode]   = useState('ball-stick')
  const [supercell,     setSupercell]     = useState([1, 1, 1])
  const [customColors,  setCustomColors]  = useState({})
  const [exportScale,   setExportScale]   = useState(2)
  const [transparentBg, setTransparentBg] = useState(false)
  const [cameraMode,    setCameraMode]    = useState('perspective')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  const viewerRef    = useRef(null)
  const workerRef    = useRef(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((text, filename) => {
    setLoading(true)
    setError(null)
    setCustomColors({})
    setSupercell([1, 1, 1])

    workerRef.current?.terminate()
    const w = createWorker()
    workerRef.current = w

    w.onmessage = ({ data }) => {
      setLoading(false)
      if (data.error) { setError(data.error) } else { setStructure(data.structure) }
      w.terminate()
    }
    w.onerror = (e) => {
      setLoading(false)
      setError(e.message ?? 'Parse error')
      w.terminate()
    }
    w.postMessage({ text, filename })
  }, [])

  const handleColorChange = useCallback((sym, color) => {
    setCustomColors(prev => ({ ...prev, [sym]: color }))
  }, [])

  const handleExport  = useCallback(() => viewerRef.current?.exportPNG(exportScale, transparentBg), [exportScale, transparentBg])
  const handleReset   = useCallback(() => viewerRef.current?.resetView(), [])
  const handleOpen    = useCallback(() => fileInputRef.current?.click(), [])

  const onInputChange = useCallback((e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => handleFile(ev.target.result, f.name)
    reader.readAsText(f)
    e.target.value = ''
  }, [handleFile])

  return (
    <div className="app">
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

        {loading && (
          <div className="status-badge loading-badge"><span className="spinner" /> Parsing…</div>
        )}
        {error && (
          <div className="status-badge error-badge">
            <span>Parse error — {error.slice(0, 80)}</span>
            <button className="badge-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

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
            transparentBg={transparentBg}
            cameraMode={cameraMode}
          />
        </main>

        <InfoPanel structure={structure} customColors={customColors} onColorChange={handleColorChange} />
      </div>

      <ControlPanel
        displayMode={displayMode}       onDisplayMode={setDisplayMode}
        supercell={supercell}           onSupercell={setSupercell}
        exportScale={exportScale}       onExportScale={setExportScale}
        transparentBg={transparentBg}   onTransparentBg={setTransparentBg}
        cameraMode={cameraMode}         onCameraMode={setCameraMode}
        onReset={handleReset}
        onOpen={handleOpen}
        onExport={handleExport}
        hasStructure={Boolean(structure)}
      />
    </div>
  )
}
