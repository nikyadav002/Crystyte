const DISPLAY_MODES = [
  { id: 'ball-stick', label: 'Ball & Stick' },
  { id: 'spacefill',  label: 'Spacefill'    },
  { id: 'stick',      label: 'Stick'        },
]

export default function ControlPanel({
  displayMode, onDisplayMode,
  supercell,   onSupercell,
  cameraMode,  onCameraMode,
  onReset, onOpen,
  exportScale, onExportScale,
  onExport,
  hasStructure,
}) {
  return (
    <div className="control-panel">

      {/* File */}
      <div className="ctrl-group">
        <button className="btn-icon" onClick={onOpen} title="Open file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Open</span>
        </button>
        <button className="btn-icon" onClick={onReset} title="Reset view" disabled={!hasStructure}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
          </svg>
          <span>Reset</span>
        </button>
      </div>

      <div className="ctrl-divider" />

      {/* Display mode */}
      <div className="ctrl-group">
        <span className="ctrl-label">Mode</span>
        <div className="btn-group">
          {DISPLAY_MODES.map(m => (
            <button key={m.id}
              className={`btn-mode${displayMode === m.id ? ' active' : ''}`}
              onClick={() => onDisplayMode(m.id)}
              disabled={!hasStructure}
            >{m.label}</button>
          ))}
        </div>
      </div>

      <div className="ctrl-divider" />

      {/* Camera */}
      <div className="ctrl-group">
        <span className="ctrl-label">Camera</span>
        <div className="btn-group">
          {['perspective', 'ortho'].map(m => (
            <button key={m}
              className={`btn-mode${cameraMode === m ? ' active' : ''}`}
              onClick={() => onCameraMode(m)}
              disabled={!hasStructure}
            >{m === 'perspective' ? 'Persp' : 'Ortho'}</button>
          ))}
        </div>
      </div>

      <div className="ctrl-divider" />

      {/* Supercell */}
      <div className="ctrl-group">
        <span className="ctrl-label">Supercell</span>
        <div className="supercell-matrix">
          {['a', 'b', 'c'].map((axis, i) => (
            <>
              {i > 0 && <span key={`sep${i}`} className="supercell-sep">×</span>}
              <input
                key={axis}
                type="number" min="1" max="3"
                value={supercell[i]}
                disabled={!hasStructure}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(3, parseInt(e.target.value) || 1))
                  const next = [...supercell]; next[i] = v; onSupercell(next)
                }}
              />
            </>
          ))}
        </div>
      </div>

      <div className="ctrl-divider" />

      {/* Export */}
      <div className="ctrl-group">
        <span className="ctrl-label">Export PNG</span>
        <div className="export-row">
          <div className="btn-group">
            {[1, 2, 4, 6].map(v => (
              <button key={v}
                className={`btn-scale${exportScale === v ? ' active' : ''}`}
                onClick={() => onExportScale(v)}
              >{v}×</button>
            ))}
          </div>
          <button className="btn-primary btn-export" onClick={onExport} disabled={!hasStructure}>
            Save PNG
          </button>
        </div>
      </div>

    </div>
  )
}
