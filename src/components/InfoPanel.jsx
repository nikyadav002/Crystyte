import { useCallback, useMemo, useState } from 'react'
import { ELEMENTS, getElement, getElementColor } from '../lib/elements.js'
import { getBondRule, getBondRuleKey } from '../lib/bondingLogic.js'
import { BOND_SCALE, MIN_BOND } from '../lib/structure.js'

function getFallbackBondRule(symA, symB) {
  return {
    min: MIN_BOND,
    max: (getElement(symA).radius + getElement(symB).radius) * BOND_SCALE,
  }
}

function stateLabel(state) {
  return {
    custom: 'Custom',
    disabled: 'Hidden',
    default: 'Default',
    fallback: 'Fallback',
  }[state] ?? 'Default'
}

export default function InfoPanel({
  structure,
  customColors,
  onColorChange,
  bondPair,
  onBondPairChange,
  onBondRuleSelect,
  bondOverrides,
  bondRule,
  bondRuleState,
  onBondRuleChange,
  onBondRuleCreate,
  onBondRuleDelete,
  onBondRuleReset,
  onBondRuleResetAll,
  bondPresets,
  onBondPresetSave,
  onBondPresetLoad,
  onBondPresetDelete,
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
  const [bondSearch, setBondSearch] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')
  const fmt = (n, d = 4) => (typeof n === 'number' ? n.toFixed(d) : '—')

  const elementCounts = {}
  if (structure?.atoms) {
    for (const atom of structure.atoms) {
      elementCounts[atom.symbol] = (elementCounts[atom.symbol] ?? 0) + 1
    }
  }

  const handleColor = useCallback((sym, color) => {
    onColorChange?.(sym, color)
  }, [onColorChange])

  const uniqueSymbols = Object.keys(elementCounts).sort()
  const activePair = useMemo(() => (
    bondPair?.length === 2
      ? bondPair
      : [uniqueSymbols[0] ?? 'C', uniqueSymbols[1] ?? uniqueSymbols[0] ?? 'C']
  ), [bondPair, uniqueSymbols])
  const baseBondRule = getBondRule(activePair[0], activePair[1]) ?? getFallbackBondRule(activePair[0], activePair[1])
  const activeBondRule = bondRule ?? baseBondRule
  const activePolyhedraCenters = polyhedraSettings?.centerMode === 'custom'
    ? (polyhedraSettings.centerSymbols ?? [])
    : (effectivePolyhedraCenters ?? [])

  const bondRows = useMemo(() => {
    const rows = []
    const query = bondSearch.trim().toLowerCase()

    for (let i = 0; i < uniqueSymbols.length; i++) {
      for (let j = i; j < uniqueSymbols.length; j++) {
        const symA = uniqueSymbols[i]
        const symB = uniqueSymbols[j]
        const key = getBondRuleKey(symA, symB)
        const override = bondOverrides?.[key]
        const baseRuleForRow = getBondRule(symA, symB) ?? getFallbackBondRule(symA, symB)
        const state = override
          ? (override.enabled === false ? 'disabled' : 'custom')
          : (getBondRule(symA, symB) ? 'default' : 'fallback')
        const rule = override ?? baseRuleForRow
        const pairLabel = `${symA}-${symB}`

        if (query && !pairLabel.toLowerCase().includes(query) && !`${symB}-${symA}`.toLowerCase().includes(query)) continue

        rows.push({
          key,
          symA,
          symB,
          state,
          rule,
          selected: symA === activePair[0] && symB === activePair[1],
        })
      }
    }

    return rows
  }, [activePair, bondOverrides, bondSearch, uniqueSymbols])

  const bondStats = useMemo(() => {
    const stats = { custom: 0, disabled: 0, default: 0, fallback: 0 }
    for (const row of bondRows) stats[row.state] += 1
    return stats
  }, [bondRows])

  const presetNames = Object.keys(bondPresets ?? {}).sort()

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
      <section className="info-section info-section--card">
        <div className="section-head">
          <h3 className="info-heading">Structure</h3>
          <span className="section-pill">{structure.atoms?.length ?? 0} atoms</span>
        </div>
        <dl className="info-dl">
          <dt>Space group</dt>
          <dd>{structure.spaceGroup || '—'}</dd>
        </dl>
      </section>

      {lp && (
        <section className="info-section info-section--card">
          <div className="section-head">
            <h3 className="info-heading">Lattice</h3>
            <span className="section-pill">A / deg</span>
          </div>
          <dl className="info-dl info-dl--grid">
            <dt>a</dt><dd>{fmt(lp.a, 4)}</dd>
            <dt>b</dt><dd>{fmt(lp.b, 4)}</dd>
            <dt>c</dt><dd>{fmt(lp.c, 4)}</dd>
            <dt>alpha</dt><dd>{fmt(lp.alpha, 3)}</dd>
            <dt>beta</dt><dd>{fmt(lp.beta, 3)}</dd>
            <dt>gamma</dt><dd>{fmt(lp.gamma, 3)}</dd>
          </dl>
        </section>
      )}

      {uniqueSymbols.length > 0 && (
        <section className="info-section info-section--card">
          <div className="section-head">
            <h3 className="info-heading">Elements</h3>
            <span className="section-pill">{uniqueSymbols.length} types</span>
          </div>
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
                  <span className="swatch-count">x{count}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {uniqueSymbols.length > 0 && (
        <section className="info-section info-section--card">
          <div className="section-head">
            <h3 className="info-heading">Polyhedra</h3>
            <span className="section-pill">{showPolyhedra ? 'Visible' : 'Hidden'}</span>
          </div>
          <div className="bond-criteria">
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
                  <span>{fmt(polyhedraSettings?.edgeThickness ?? 1.1, 1)}x</span>
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
        <section className="info-section info-section--card">
          <div className="section-head">
            <h3 className="info-heading">Bond Manager</h3>
            <span className="section-pill">{bondRows.length} pairs</span>
          </div>

          <div className="manager-stats">
            <span className="manager-stat"><strong>{bondStats.custom}</strong> custom</span>
            <span className="manager-stat"><strong>{bondStats.disabled}</strong> hidden</span>
            <span className="manager-stat"><strong>{bondStats.default}</strong> default</span>
            <span className="manager-stat"><strong>{bondStats.fallback}</strong> fallback</span>
          </div>

          <div className="manager-toolbar">
            <input
              className="manager-search"
              type="search"
              placeholder="Search bond pair"
              value={bondSearch}
              onChange={(e) => setBondSearch(e.target.value)}
            />
            <button className="btn-icon btn-inline" onClick={onBondRuleResetAll} type="button">
              Reset All
            </button>
          </div>

          <div className="preset-toolbar">
            <select
              className="manager-search"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              <option value="">Bond preset</option>
              {presetNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="btn-icon btn-inline" onClick={onBondPresetSave} type="button">
              Save
            </button>
            <button className="btn-icon btn-inline" onClick={() => onBondPresetLoad?.(selectedPreset)} type="button" disabled={!selectedPreset}>
              Load
            </button>
            <button className="btn-icon btn-inline" onClick={() => onBondPresetDelete?.(selectedPreset)} type="button" disabled={!selectedPreset}>
              Delete
            </button>
          </div>

          <div className="bond-table">
            {bondRows.map(row => (
              <button
                key={row.key}
                className={`bond-row${row.selected ? ' active' : ''}`}
                onClick={() => {
                  onBondPairChange?.([row.symA, row.symB])
                  onBondRuleSelect?.([row.symA, row.symB])
                }}
                type="button"
              >
                <span className="bond-row-pair">{row.symA} - {row.symB}</span>
                <span className={`bond-state bond-state--${row.state}`}>{stateLabel(row.state)}</span>
                <span className="bond-row-range">{fmt(row.rule.max, 2)} A</span>
              </button>
            ))}
          </div>

          <div className="bond-editor">
            <div className="section-head section-head--tight">
              <div>
                <div className="bond-editor-title">{activePair[0]} - {activePair[1]}</div>
                <div className="bond-editor-subtitle">{stateLabel(bondRuleState)}</div>
              </div>
              <span className={`bond-state bond-state--${bondRuleState}`}>{stateLabel(bondRuleState)}</span>
            </div>

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
                Create
              </button>
              <button className="btn-icon btn-inline" onClick={onBondRuleDelete} type="button">
                Hide
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
