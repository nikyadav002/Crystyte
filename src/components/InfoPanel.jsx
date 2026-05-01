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
  showPolyhedra,
  polyhedraSettings,
  effectivePolyhedraCenters,
  availableSymbols,
  onPolyhedraSettingChange,
  onPolyhedraCenterModeChange,
  onPolyhedraCenterToggle,
  onPolyhedraSelectAllCenters,
  onPolyhedraClearCenters,
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
  const activePolyhedraCenters = polyhedraSettings?.centerMode === 'custom'
    ? (polyhedraSettings.centerSymbols ?? [])
    : (effectivePolyhedraCenters ?? [])

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
          <h3 className="info-heading">Polyhedra</h3>
          <div className="bond-criteria">
            <div className="bond-criteria-status">
              {showPolyhedra ? 'Polyhedra visible' : 'Polyhedra hidden'}
            </div>
            <div className="bond-criteria-row">
              <label className="bond-criteria-field">
                <span>Centers</span>
                <div className="btn-group">
                  <button
                    className={`btn-mode${polyhedraSettings?.centerMode !== 'custom' ? ' active' : ''}`}
                    onClick={() => onPolyhedraCenterModeChange?.('auto')}
                    type="button"
                  >
                    Auto
                  </button>
                  <button
                    className={`btn-mode${polyhedraSettings?.centerMode === 'custom' ? ' active' : ''}`}
                    onClick={() => onPolyhedraCenterModeChange?.('custom')}
                    type="button"
                  >
                    Custom
                  </button>
                </div>
              </label>
              <label className="bond-criteria-field">
                <span>Ligands</span>
                <select
                  value={polyhedraSettings?.ligandMode === 'symbol' ? polyhedraSettings.ligandSymbol : ''}
                  onChange={(e) => {
                    const value = e.target.value
                    onPolyhedraSettingChange?.('ligandMode', value ? 'symbol' : 'any')
                    onPolyhedraSettingChange?.('ligandSymbol', value)
                  }}
                >
                  <option value="">Any bonded</option>
                  {availableSymbols?.map(sym => <option key={`poly-ligand-${sym}`} value={sym}>{sym}</option>)}
                </select>
              </label>
            </div>
            <div className="polyhedra-chip-actions">
              <button className="btn-icon btn-inline" onClick={onPolyhedraSelectAllCenters} type="button">
                All
              </button>
              <button className="btn-icon btn-inline" onClick={onPolyhedraClearCenters} type="button">
                None
              </button>
            </div>
            <div className="polyhedra-chip-grid">
              {availableSymbols?.map(sym => {
                const active = activePolyhedraCenters.includes(sym)
                return (
                  <button
                    key={`poly-center-${sym}`}
                    className={`polyhedra-chip${active ? ' active' : ''}`}
                    onClick={() => onPolyhedraCenterToggle?.(sym)}
                    type="button"
                  >
                    {sym}
                  </button>
                )
              })}
            </div>
            <div className="bond-criteria-row">
              <label className="bond-criteria-field">
                <span>Opacity</span>
                <div className="polyhedra-range-row">
                  <input
                    type="range"
                    min="0.05"
                    max="0.85"
                    step="0.01"
                    value={polyhedraSettings?.opacity ?? 0.28}
                    onChange={(e) => onPolyhedraSettingChange?.('opacity', Number.parseFloat(e.target.value))}
                  />
                  <span>{fmt(polyhedraSettings?.opacity ?? 0.28, 2)}</span>
                </div>
              </label>
              <label className="bond-criteria-field">
                <span>Edge thickness</span>
                <div className="polyhedra-range-row">
                  <input
                    type="range"
                    min="0.4"
                    max="3"
                    step="0.1"
                    value={polyhedraSettings?.edgeThickness ?? 1.1}
                    onChange={(e) => onPolyhedraSettingChange?.('edgeThickness', Number.parseFloat(e.target.value))}
                  />
                  <span>{fmt(polyhedraSettings?.edgeThickness ?? 1.1, 1)}×</span>
                </div>
              </label>
            </div>
            <div className="bond-criteria-row">
              <label className="bond-criteria-field">
                <span>Color</span>
                <select
                  value={polyhedraSettings?.colorMode ?? 'center'}
                  onChange={(e) => onPolyhedraSettingChange?.('colorMode', e.target.value)}
                >
                  <option value="center">Center atom</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="bond-criteria-field">
                <span>Custom color</span>
                <input
                  type="color"
                  value={polyhedraSettings?.color ?? '#7b2f82'}
                  disabled={polyhedraSettings?.colorMode !== 'custom'}
                  onChange={(e) => onPolyhedraSettingChange?.('color', e.target.value)}
                />
              </label>
            </div>
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
