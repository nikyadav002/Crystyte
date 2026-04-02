import { useCallback } from 'react'
import { ELEMENTS } from '../lib/elements.js'

export default function InfoPanel({ structure, customColors, onColorChange }) {
  const fmt = (n, d = 4) => (typeof n === 'number' ? n.toFixed(d) : '—')

  const elementCounts = {}
  if (structure?.atoms) {
    for (const a of structure.atoms) {
      elementCounts[a.symbol] = (elementCounts[a.symbol] ?? 0) + 1
    }
  }

  const handleColor = useCallback((sym, color) => {
    onColorChange?.(sym, color)
  }, [onColorChange])

  if (!structure) {
    return (
      <aside className="info-panel info-panel--empty">
        <span className="info-empty-hint">Load a file to see structure info</span>
      </aside>
    )
  }

  const lp = structure.latticeParams

  return (
    <aside className="info-panel">
      <section className="info-section">
        <h3 className="info-heading">Formula</h3>
        <p className="info-formula">{structure.formula || '—'}</p>
        {structure.title && (
          <p className="info-title" title={structure.title}>{structure.title}</p>
        )}
      </section>

      <section className="info-section">
        <h3 className="info-heading">Structure</h3>
        <dl className="info-dl">
          <dt>Space group</dt>
          <dd>{structure.spaceGroup || '—'}</dd>
          <dt>Atoms</dt>
          <dd>{structure.atoms?.length ?? 0}</dd>
        </dl>
      </section>

      {lp && (
        <section className="info-section">
          <h3 className="info-heading">Lattice (Å / °)</h3>
          <dl className="info-dl info-dl--grid">
            <dt>a</dt><dd>{fmt(lp.a, 4)}</dd>
            <dt>b</dt><dd>{fmt(lp.b, 4)}</dd>
            <dt>c</dt><dd>{fmt(lp.c, 4)}</dd>
            <dt>α</dt><dd>{fmt(lp.alpha, 3)}</dd>
            <dt>β</dt><dd>{fmt(lp.beta,  3)}</dd>
            <dt>γ</dt><dd>{fmt(lp.gamma, 3)}</dd>
          </dl>
        </section>
      )}

      {Object.keys(elementCounts).length > 0 && (
        <section className="info-section">
          <h3 className="info-heading">Elements</h3>
          <div className="element-swatches">
            {Object.entries(elementCounts).map(([sym, count]) => {
              const el = ELEMENTS[sym] ?? ELEMENTS.XX
              const color = customColors?.[sym] ?? el.color
              return (
                <div key={sym} className="swatch-row">
                  <label className="swatch-label" title={el.name}>
                    <input
                      type="color"
                      value={color.startsWith('#') ? color : '#909090'}
                      onChange={(e) => handleColor(sym, e.target.value)}
                      className="swatch-input"
                    />
                    <span className="swatch-dot" style={{ background: color }} />
                    <span className="swatch-sym">{sym}</span>
                  </label>
                  <span className="swatch-count">×{count}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </aside>
  )
}
