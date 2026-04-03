import { useCallback } from 'react'
import { ELEMENTS, getElement, getElementColor } from '../lib/elements.js'
import { getBondRule } from '../lib/bondingLogic.js'
import { BOND_SCALE, MIN_BOND } from '../lib/structure.js'

export default function InfoPanel({
  structure,
  customColors,
  onColorChange,
  bondPair,
  onBondPairChange,
  bondRule,
  bondRuleState,
  onBondRuleChange,
  onBondRuleCreate,
  onBondRuleDelete,
  onBondRuleReset,
}) {
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

  const uniqueSymbols = Object.keys(elementCounts).sort()
  const activePair = bondPair?.length === 2
    ? bondPair
    : [uniqueSymbols[0] ?? 'C', uniqueSymbols[1] ?? uniqueSymbols[0] ?? 'C']
  const baseBondRule = getBondRule(activePair[0], activePair[1]) ?? {
    min: MIN_BOND,
    max: (getElement(activePair[0]).radius + getElement(activePair[1]).radius) * BOND_SCALE,
  }
  const activeBondRule = bondRule ?? baseBondRule
  const bondStateLabel = {
    custom: 'Custom bond',
    disabled: 'Bond hidden',
    default: 'Default bond',
    fallback: 'Radius fallback',
  }[bondRuleState ?? 'default']

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
              const color = customColors?.[sym] ?? getElementColor(sym)
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

      {uniqueSymbols.length > 0 && (
        <section className="info-section">
          <h3 className="info-heading">Bond Criteria</h3>
          <div className="bond-criteria">
            <div className="bond-criteria-status">{bondStateLabel}</div>
            <div className="bond-criteria-row">
              <label className="bond-criteria-field">
                <span>A1</span>
                <select
                  value={activePair[0]}
                  onChange={(e) => onBondPairChange?.([e.target.value, activePair[1]])}
                >
                  {uniqueSymbols.map(sym => <option key={`a1-${sym}`} value={sym}>{sym}</option>)}
                </select>
              </label>
              <label className="bond-criteria-field">
                <span>A2</span>
                <select
                  value={activePair[1]}
                  onChange={(e) => onBondPairChange?.([activePair[0], e.target.value])}
                >
                  {uniqueSymbols.map(sym => <option key={`a2-${sym}`} value={sym}>{sym}</option>)}
                </select>
              </label>
            </div>
            <div className="bond-criteria-row">
              <label className="bond-criteria-field">
                <span>Min (A)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isFinite(activeBondRule.min) ? activeBondRule.min : 0}
                  onChange={(e) => onBondRuleChange?.('min', e.target.value)}
                />
              </label>
              <label className="bond-criteria-field">
                <span>Max (A)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isFinite(activeBondRule.max) ? activeBondRule.max : 0}
                  onChange={(e) => onBondRuleChange?.('max', e.target.value)}
                />
              </label>
            </div>
            <div className="bond-criteria-actions">
              <button className="btn-icon btn-inline" onClick={onBondRuleCreate} type="button">
                Create Bond
              </button>
              <button className="btn-icon btn-inline" onClick={onBondRuleDelete} type="button">
                Delete Bond
              </button>
              <button className="btn-icon btn-inline" onClick={onBondRuleReset} type="button">
                Use Default
              </button>
            </div>
          </div>
        </section>
      )}
    </aside>
  )
}
