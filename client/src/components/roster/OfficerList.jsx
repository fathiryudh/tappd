import { useState, useEffect } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { fetchOfficers, addOfficer, deleteOfficer } from '../../api/officers.api'

const COLORS = {
  shell: 'rgba(0, 0, 0, 0.03)',
  surface: '#FFFFFF',
  soft: '#F5F5F2',
  line: 'rgba(0, 0, 0, 0.06)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#111111',
  info: '#111111',
  infoSoft: 'rgba(0,0,0,0.04)',
  danger: '#9B3B36',
  dangerSoft: '#FCEDED',
  lineStrong: 'rgba(0, 0, 0, 0.10)',
}

export default function OfficerList() {
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rank: '', name: '', phoneNumber: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    fetchOfficers()
      .then(data => { setOfficers(data); setError(null) })
      .catch(() => setError('Could not load officers.'))
      .finally(() => {
        setLoading(false)
        setTimeout(() => setRevealed(true), 40)
      })
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.phoneNumber.trim()) { setFormError('Phone number is required.'); return }
    setSaving(true); setFormError(null)
    try {
      const created = await addOfficer({
        rank: form.rank.trim() || undefined,
        name: form.name.trim() || undefined,
        phoneNumber: form.phoneNumber.trim(),
      })
      setOfficers(prev => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setForm({ rank: '', name: '', phoneNumber: '' })
      setShowForm(false)
    } catch (err) {
      setFormError(err.response?.data?.error || 'Could not add officer.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteOfficer(id)
      setOfficers(prev => prev.filter(o => o.id !== id))
    } catch { /* silent */ }
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <div className="mb-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
            style={{ background: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.68)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: COLORS.brand }} />
            SCDF 2 Div HQ · Tampines
          </span>
        </div>

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
            onClick={() => { setShowForm(s => !s); setFormError(null) }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200"
            style={{ background: COLORS.soft, color: COLORS.text }}
          >
            <Plus size={15} weight="bold" />
            <span>{showForm ? 'Close form' : 'Add officer'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div
        className="mb-6 rounded-[2rem] p-[6px]"
          style={{ background: COLORS.shell, boxShadow: `0 0 0 1px ${COLORS.line}` }}
        >
          <div className="rounded-[calc(2rem-0.5rem)] overflow-hidden px-5 py-6 md:px-8 md:py-7" style={{ background: 'rgba(255,255,255,0.94)' }}>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Rank">
                  <Input
                    value={form.rank}
                    onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}
                    placeholder="e.g. CPT"
                  />
                </Field>
                <Field label="Name">
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Tan Wei Ming"
                  />
                </Field>
              </div>
              <Field label={<>Phone Number <span style={{ color: '#ef4444' }}>*</span></>}>
                <Input
                  value={form.phoneNumber}
                  onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="e.g. 91234567"
                />
              </Field>
              {formError && (
                <p className="text-[12px]" style={{ color: COLORS.danger }}>{formError}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium text-white transition-opacity duration-200 disabled:opacity-40"
                  style={{ background: COLORS.info }}
                >
                  {saving ? 'Adding…' : 'Add officer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(null) }}
                  className="rounded-full px-5 py-3 text-sm font-medium transition-colors duration-200"
                  style={{ background: COLORS.soft, color: COLORS.muted }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div
        className="rounded-[2rem] p-[6px]"
        style={{ background: COLORS.shell, boxShadow: `0 0 0 1px ${COLORS.line}` }}
      >
        <div
          className="rounded-[calc(2rem-0.5rem)] overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.96)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 600ms cubic-bezier(0.32,0.72,0,1), transform 600ms cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
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
        </div>
      </div>

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
  const display = officer.name || officer.telegramName || officer.phoneNumber

  return (
    <tr
      style={{
        borderBottom: `1px solid ${COLORS.line}`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms, transform 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms`,
      }}
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
  const display = officer.name || officer.telegramName || officer.phoneNumber

  return (
    <article
      className="border-b px-4 py-4 last:border-b-0"
      style={{
        borderColor: COLORS.line,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms, transform 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms`,
      }}
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
      className="w-full px-4 py-3 rounded-[1rem] text-sm border border-transparent focus:outline-none transition-colors duration-200"
      style={{ color: COLORS.text, background: COLORS.soft }}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 1px ${COLORS.info}` }}
      onBlur={e => { e.target.style.boxShadow = 'none' }}
    />
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(89,37,220,0.28)', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: COLORS.muted }}>
      {message}
    </div>
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
