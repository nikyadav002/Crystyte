export default function ControlPanel({
  supercell,   onSupercell,
  cameraMode,  onCameraMode,
  showPolyhedra, onShowPolyhedra,
  saveFormat, onSaveFormat,
  onViewAxis,
  onReset, onOpen,
  onSaveSupercell,
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

      <div className="ctrl-group">
        <span className="ctrl-label">Axes</span>
        <div className="btn-group">
          {['a', 'b', 'c'].map(axis => (
            <button key={axis}
              className="btn-mode"
              onClick={() => onViewAxis(axis)}
              disabled={!hasStructure}
            >{axis}</button>
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

      <div className="ctrl-group">
        <span className="ctrl-label">Polyhedra</span>
        <div className="btn-group">
          <button
            className={`btn-mode${!showPolyhedra ? ' active' : ''}`}
            onClick={() => onShowPolyhedra(false)}
            disabled={!hasStructure}
          >
            Off
          </button>
          <button
            className={`btn-mode${showPolyhedra ? ' active' : ''}`}
            onClick={() => onShowPolyhedra(true)}
            disabled={!hasStructure}
          >
            On
          </button>
        </div>
      </div>

      <div className="ctrl-divider" />

      <div className="ctrl-group">
        <span className="ctrl-label">Save</span>
        <div className="btn-group">
          {['vasp', 'cif'].map(format => (
            <button
              key={format}
              className={`btn-mode${saveFormat === format ? ' active' : ''}`}
              onClick={() => onSaveFormat(format)}
              disabled={!hasStructure}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="btn-icon" onClick={onSaveSupercell} disabled={!hasStructure}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>Save Supercell</span>
        </button>
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
