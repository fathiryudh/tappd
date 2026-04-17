import { useState, useEffect } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { fetchOfficers, fetchOfficerFormOptions, addOfficer, deleteOfficer } from '../../api/officers.api'
import {
  RosterErrorState,
  RosterLoadingState,
  RosterLocationBadge,
  RosterShell,
} from './RosterPrimitives'
import DivisionBranchFilter from './DivisionBranchFilter'
import { ROSTER_COLORS as COLORS, getRevealStyle } from './rosterTheme'
import { buildOfficerPayload, createEmptyOfficerForm } from '../../lib/officerForm'

function getRequestErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.error || fallbackMessage
}

function getOfficerDisplayName(officer) {
  return officer.name || officer.telegramName || officer.phoneNumber
}

function updateField(setForm, field) {
  return (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [field]: value }))
  }
}

const CONTROL_CLASS_NAME = 'w-full rounded-[1rem] border border-transparent px-4 py-3 text-sm transition-colors duration-200 focus:outline-none'
const CONTROL_STYLE = { color: COLORS.text, background: COLORS.soft }

export default function OfficerList({
  filter = { divisionId: '', branchId: '' },
  onFilterChange,
  divisions = [],
  branches = [],
  pinnedFilter,
  onPin,
  onUnpin,
}) {
  const [officers, setOfficers] = useState([])
  const [divisionOptions, setDivisionOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createEmptyOfficerForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const resetForm = () => {
    setForm(createEmptyOfficerForm())
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
    setFormError(null)
  }

  const toggleForm = () => {
    setShowForm((current) => {
      if (current) {
        resetForm()
      }

      return !current
    })
    setFormError(null)
  }

  useEffect(() => {
    fetchOfficerFormOptions()
      .then(optionData => setDivisionOptions(optionData.divisions || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let stale = false
    setLoading(true)
    setRevealed(false)

    const load = async () => {
      try {
        const officerData = await fetchOfficers({ divisionId: filter.divisionId, branchId: filter.branchId })
        if (stale) return
        setOfficers(officerData)
        setError(null)
      } catch (err) {
        if (stale) return
        setError(getRequestErrorMessage(err, 'Could not load officers.'))
      } finally {
        if (stale) return
        setLoading(false)
        setTimeout(() => setRevealed(true), 40)
      }
    }

    load()
    return () => { stale = true }
  }, [filter.divisionId, filter.branchId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.phoneNumber.trim()) { setFormError('Phone number is required.'); return }
    setSaving(true); setFormError(null); setActionError(null)
    try {
      const created = await addOfficer(buildOfficerPayload(form))
      setOfficers(prev => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      resetForm()
      setShowForm(false)
    } catch (err) {
      setFormError(getRequestErrorMessage(err, 'Could not add officer.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteOfficer(id)
      setOfficers(prev => prev.filter(o => o.id !== id))
      setActionError(null)
    } catch (err) {
      setActionError(getRequestErrorMessage(err, 'Could not delete officer.'))
    }
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <div className="mb-5">
          <RosterLocationBadge />
        </div>

        {onFilterChange && (
          <div className="mb-5">
            <DivisionBranchFilter
              divisions={divisions}
              branches={branches}
              filter={filter}
              onFilterChange={onFilterChange}
              pinnedFilter={pinnedFilter}
              onPin={onPin}
              onUnpin={onUnpin}
            />
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1
              className="text-[2.9rem] font-semibold leading-none tracking-[-0.09em] md:text-[4.3rem]"
              style={{ color: COLORS.text }}
            >
              Roster
            </h1>
            {!loading && (
              <p className="mt-3 text-base md:text-lg" style={{ color: COLORS.muted }}>
                {officers.length} registered
              </p>
            )}
          </div>

          <button
            onClick={toggleForm}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200"
            style={{ background: COLORS.soft, color: COLORS.text }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.09)' }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.soft }}
          >
            <Plus size={15} weight="bold" />
            <span>{showForm ? 'Close form' : 'Add officer'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <RosterShell
          outerClassName="mb-6"
          innerClassName="px-5 py-6 md:px-8 md:py-7"
          innerStyle={{ background: 'rgba(255,255,255,0.94)' }}
        >
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Rank">
                <Input
                  value={form.rank}
                  onChange={updateField(setForm, 'rank')}
                  placeholder="e.g. CPT"
                />
              </Field>
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={updateField(setForm, 'name')}
                  placeholder="e.g. Tan Wei Ming"
                />
              </Field>
            </div>
            <Field label={<>Phone Number <span style={{ color: '#ef4444' }}>*</span></>}>
              <Input
                value={form.phoneNumber}
                onChange={updateField(setForm, 'phoneNumber')}
                placeholder="e.g. 91234567"
              />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Division">
                <Select
                  value={form.division}
                  onChange={updateField(setForm, 'division')}
                >
                  <option value="">Select division</option>
                  {divisionOptions.map(division => (
                    <option key={division.id} value={division.name}>
                      {division.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Branch">
                <Input
                  value={form.branch}
                  onChange={updateField(setForm, 'branch')}
                  placeholder="e.g. OPS"
                />
              </Field>
            </div>
            {formError && (
              <p className="text-[12px]" style={{ color: COLORS.danger }}>{formError}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium text-white transition-all duration-200 disabled:opacity-40"
                style={{ background: COLORS.info }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                {saving ? 'Adding…' : 'Add officer'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full px-5 py-3 text-sm font-medium transition-all duration-200"
                style={{ background: COLORS.soft, color: COLORS.muted }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.09)'; e.currentTarget.style.color = COLORS.text }}
                onMouseLeave={e => { e.currentTarget.style.background = COLORS.soft; e.currentTarget.style.color = COLORS.muted }}
              >
                Cancel
              </button>
            </div>
          </form>
        </RosterShell>
      )}

      {actionError && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ background: COLORS.dangerSoft, color: COLORS.danger, boxShadow: `0 0 0 1px ${COLORS.line}` }}
        >
          {actionError}
        </div>
      )}

      <RosterShell
        innerStyle={getRevealStyle(revealed)}
      >
          {loading ? (
            <RosterLoadingState />
          ) : error ? (
            <RosterErrorState message={error} />
          ) : officers.length === 0 ? (
            <EmptyState onAdd={() => setShowForm(true)} />
          ) : (
            <>
            <div className="md:hidden">
              {officers.map((officer, idx) => (
                <MobileOfficerCard
                  key={officer.id}
                  officer={officer}
                  idx={idx}
                  revealed={revealed}
                  onDelete={() => handleDelete(officer.id)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <th
                    className="text-left py-4 pl-6 pr-4 text-[10px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: COLORS.muted }}
                  >
                    Name
                  </th>
                  <th
                    className="text-left py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: COLORS.muted }}
                  >
                    Phone
                  </th>
                  <th className="py-4 pr-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {officers.map((officer, idx) => (
                  <OfficerRow
                    key={officer.id}
                    officer={officer}
                    idx={idx}
                    revealed={revealed}
                    onDelete={() => handleDelete(officer.id)}
                  />
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
      </RosterShell>

      {!loading && !error && officers.length > 0 && (
        <p className="mt-4 text-center text-[11px]" style={{ color: COLORS.muted }}>
          {officers.length} officer{officers.length !== 1 ? 's' : ''} registered
        </p>
      )}
    </div>
  )
}

function OfficerRow({ officer, idx, revealed, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const display = getOfficerDisplayName(officer)

  return (
    <tr
      style={{ borderBottom: `1px solid ${COLORS.line}`, ...getRevealStyle(revealed, { distance: 8, delay: idx * 28, duration: 500 }) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td className="py-3 pl-6 pr-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {officer.rank && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: COLORS.infoSoft, color: COLORS.info }}
            >
              {officer.rank}
            </span>
          )}
          <span className="text-sm font-medium" style={{ color: COLORS.text }}>
            {display}
          </span>
          {officer.telegramName && (
            <span className="text-[11px] font-mono" style={{ color: COLORS.muted }}>
              @{officer.telegramName}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] font-mono" style={{ color: COLORS.muted }}>
          {officer.phoneNumber}
        </span>
      </td>
      <td className="pr-4 py-3 text-right">
        <button
          onClick={onDelete}
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms, background 150ms',
          }}
          className="p-2 rounded-full group"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(215,38,15,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <Trash size={13} className="transition-colors duration-150" style={{ color: hovered ? COLORS.danger : COLORS.muted }} />
        </button>
      </td>
    </tr>
  )
}

function MobileOfficerCard({ officer, idx, revealed, onDelete }) {
  const display = getOfficerDisplayName(officer)

  return (
    <article
      className="border-b px-4 py-4 last:border-b-0"
      style={{ borderColor: COLORS.line, ...getRevealStyle(revealed, { distance: 8, delay: idx * 28, duration: 500 }) }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {officer.rank && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-mono"
                style={{ background: COLORS.infoSoft, color: COLORS.info }}
              >
                {officer.rank}
              </span>
            )}
            <span className="text-base font-semibold tracking-[-0.03em]" style={{ color: COLORS.text }}>
              {display}
            </span>
          </div>
          {officer.telegramName && (
            <div className="mt-2 text-[12px] font-mono" style={{ color: COLORS.muted }}>
              @{officer.telegramName}
            </div>
          )}
          <div className="mt-3 text-[12px] font-mono" style={{ color: COLORS.muted }}>
            {officer.phoneNumber}
          </div>
        </div>

        <button
          onClick={onDelete}
          className="rounded-full p-2"
          style={{ background: COLORS.dangerSoft, color: COLORS.danger }}
        >
          <Trash size={14} />
        </button>
      </div>
    </article>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label
        className="block text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: COLORS.muted }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={CONTROL_CLASS_NAME}
      style={CONTROL_STYLE}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 1px ${COLORS.info}` }}
      onBlur={e => { e.target.style.boxShadow = 'none' }}
    />
  )
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={CONTROL_CLASS_NAME}
      style={CONTROL_STYLE}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 1px ${COLORS.info}` }}
      onBlur={e => { e.target.style.boxShadow = 'none' }}
    >
      {children}
    </select>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <p className="text-sm" style={{ color: COLORS.muted }}>No officers registered yet.</p>
      <button
        onClick={onAdd}
        className="rounded-full px-4 py-2 text-[12px] font-medium transition-all duration-200"
        style={{ background: COLORS.infoSoft, color: COLORS.info }}
      >
        Add first officer
      </button>
    </div>
  )
}
