import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X } from '@phosphor-icons/react'
import { fetchOfficerFormOptions } from '../api/officers.api'
import { fetchScope, updateScope, fetchDigestEmails, updateDigestEmails } from '../api/settings.api'

const COLORS = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  soft: 'rgba(0,0,0,0.03)',
  line: 'rgba(0, 0, 0, 0.06)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#111111',
}

const CONTROL_CLASS =
  'w-full rounded-xl border px-3 py-2.5 text-sm transition-colors duration-150 focus:outline-none'

export default function Settings() {
  const navigate = useNavigate()
  const [divisions, setDivisions] = useState([])
  const [branches, setBranches] = useState([])
  const [scopeDivisionId, setScopeDivisionId] = useState('')
  const [scopeBranchId, setScopeBranchId] = useState('')
  const [digestEmails, setDigestEmails] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [emailInputError, setEmailInputError] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  useEffect(() => {
    fetchOfficerFormOptions().then(opts => {
      setDivisions(opts.divisions || [])
      setBranches(opts.branches || [])
    }).catch(() => {})

    fetchScope().then(data => {
      setScopeDivisionId(data.scopeDivisionId || '')
      setScopeBranchId(data.scopeBranchId || '')
    }).catch(() => {})

    fetchDigestEmails().then(data => {
      setDigestEmails(data.digestEmails || [])
    }).catch(() => {})
  }, [])

  const handleDivisionChange = async (e) => {
    const divisionId = e.target.value
    setScopeDivisionId(divisionId)
    setScopeBranchId('')
    try {
      await updateScope({ scopeDivisionId: divisionId || null, scopeBranchId: null })
      showToast('Department scope saved')
    } catch {
      showToast('Failed to save scope')
    }
  }

  const handleBranchChange = async (e) => {
    const branchId = e.target.value
    setScopeBranchId(branchId)
    try {
      await updateScope({ scopeDivisionId: scopeDivisionId || null, scopeBranchId: branchId || null })
      showToast('Department scope saved')
    } catch {
      showToast('Failed to save scope')
    }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleAddEmail = async () => {
    const email = emailInput.trim()
    if (!EMAIL_RE.test(email)) {
      setEmailInputError('Enter a valid email address')
      return
    }
    if (digestEmails.includes(email)) {
      setEmailInputError('Already in the list')
      return
    }
    setEmailInputError('')
    const next = [...digestEmails, email]
    setDigestEmails(next)
    setEmailInput('')
    try {
      await updateDigestEmails(next)
      showToast('Digest emails saved')
    } catch {
      showToast('Failed to save emails')
    }
  }

  const handleRemoveEmail = async (email) => {
    const next = digestEmails.filter(e => e !== email)
    setDigestEmails(next)
    try {
      await updateDigestEmails(next)
      showToast('Digest emails saved')
    } catch {
      showToast('Failed to save emails')
    }
  }

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: COLORS.bg, color: COLORS.text }}>
      <div className="mx-auto max-w-[640px] px-4 py-6">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center rounded-full p-2 transition-colors duration-150"
            style={{ background: COLORS.soft, color: COLORS.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.soft }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-[1.4rem] font-semibold leading-none tracking-[-0.04em]">Settings</div>
          </div>
        </div>

        {/* Section: Department Scope */}
        <section
          className="mb-6 rounded-2xl p-5"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
            Department Scope
          </div>
          <div className="mt-1 text-base font-semibold tracking-[-0.03em]">Filter digest by division</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: COLORS.muted }}>
                Division
              </label>
              <select
                value={scopeDivisionId}
                onChange={handleDivisionChange}
                className={CONTROL_CLASS}
                style={{ borderColor: COLORS.line, background: COLORS.bg, color: COLORS.text }}
              >
                <option value="">All divisions</option>
                {divisions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: COLORS.muted }}>
                Branch
              </label>
              <select
                value={scopeBranchId}
                onChange={handleBranchChange}
                disabled={!scopeDivisionId}
                className={CONTROL_CLASS}
                style={{
                  borderColor: COLORS.line,
                  background: COLORS.bg,
                  color: COLORS.text,
                  opacity: scopeDivisionId ? 1 : 0.5,
                  cursor: scopeDivisionId ? 'default' : 'not-allowed',
                }}
              >
                <option value="">All branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5" style={{ color: COLORS.muted }}>
            The daily digest email will only include officers from the selected division/branch.
            Leave blank to include all officers.
          </p>
        </section>

        {/* Section: Digest Emails */}
        <section
          className="rounded-2xl p-5"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
            Digest Emails
          </div>
          <div className="mt-1 text-base font-semibold tracking-[-0.03em]">Daily report recipients</div>

          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailInputError('') }}
                onKeyDown={handleEmailKeyDown}
                placeholder="email@example.com"
                className={CONTROL_CLASS}
                style={{
                  borderColor: emailInputError ? '#dc2626' : COLORS.line,
                  background: COLORS.bg,
                  color: COLORS.text,
                  flex: 1,
                }}
              />
              <button
                onClick={handleAddEmail}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150"
                style={{ background: COLORS.brand, color: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333' }}
                onMouseLeave={e => { e.currentTarget.style.background = COLORS.brand }}
              >
                <Plus size={15} weight="bold" />
                Add
              </button>
            </div>
            {emailInputError && (
              <p className="mt-1.5 text-xs" style={{ color: '#dc2626' }}>{emailInputError}</p>
            )}
          </div>

          {digestEmails.length > 0 && (
            <ul className="mt-4 space-y-2">
              {digestEmails.map(email => (
                <li
                  key={email}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: COLORS.soft, border: `1px solid ${COLORS.line}` }}
                >
                  <span className="text-sm">{email}</span>
                  <button
                    onClick={() => handleRemoveEmail(email)}
                    className="rounded-full p-1 transition-colors duration-150"
                    style={{ color: COLORS.muted }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.color = COLORS.muted }}
                  >
                    <X size={14} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs leading-5" style={{ color: COLORS.muted }}>
            If no emails are added, the digest is sent to your account email.
          </p>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-4 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: COLORS.brand, color: '#fff', zIndex: 50 }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
