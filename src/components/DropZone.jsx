import { useRef, useState, useCallback } from 'react'

export default function DropZone({ onFile }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback((files) => {
    const f = files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (e) => onFile(e.target.result, f.name)
    reader.readAsText(f)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".cif,.xyz,.poscar,.contcar,.vasp,POSCAR,CONTCAR"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="dropzone-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="dropzone-title">Drop a crystal structure file</p>
        <p className="dropzone-sub">POSCAR · CONTCAR · VASP · CIF · XYZ</p>
        <button className="btn-primary" onClick={(e) => { e.stopPropagation(); inputRef.current.click() }}>
          Browse file
        </button>
      </div>
    </div>
  )
}
