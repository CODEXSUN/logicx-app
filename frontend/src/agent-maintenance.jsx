import { useEffect, useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'
import { updateApi } from './api'

const activePhases = new Set(['queued', 'pulling', 'installing_dependencies', 'migrating', 'building', 'clearing_cache'])

export default function AgentMaintenance() {
  const [state, setState] = useState(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const active = activePhases.has(state?.phase)

  useEffect(() => {
    let cancelled = false
    updateApi.status(false).then((status) => {
      if (!cancelled) setState(status)
    }).catch((failure) => {
      if (!cancelled) setError(failure.message)
    }).finally(() => {
      if (!cancelled) setPending(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let timer
    async function poll() {
      try {
        const status = await updateApi.status(false)
        if (cancelled) return
        setState(status)
        setError('')
        if (!activePhases.has(status.phase)) return
      } catch (failure) {
        if (cancelled) return
        setError(failure.message)
      }
      timer = window.setTimeout(poll, 2000)
    }
    timer = window.setTimeout(poll, 2000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active])

  async function perform(action) {
    setPending(true)
    setError('')
    try {
      setState(await action())
    } catch (failure) {
      setError(failure.message.replace(/^frappe\.exceptions\.\w+:\s*/u, ''))
    } finally {
      setPending(false)
    }
  }

  const disabled = pending || active
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><RefreshCwIcon size={16} /> Updates and maintenance</h2>
      <p className="text-sm text-muted-foreground">Update from Git runs a fast-forward pull, site migration, asset build, and cache clear. Migrate and build uses the current checkout.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => perform(() => updateApi.status())} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Check for updates</button>
        <button type="button" disabled={disabled || !state?.update_available || state?.dirty} onClick={() => perform(updateApi.start)} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Update from Git</button>
        <button type="button" disabled={disabled} onClick={() => perform(updateApi.maintain)} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">Migrate and build</button>
      </div>
      <div aria-live="polite" className="space-y-1 text-sm text-muted-foreground">
        {pending && <p>Contacting Bench…</p>}
        {!pending && state?.phase !== 'idle' && <p>{state?.message}</p>}
        {state?.repository_message && <p>{state.repository_message}</p>}
        {state?.dirty && <p>Commit local changes before updating from Git.</p>}
        {state?.phase === 'complete' && <button type="button" onClick={() => window.location.reload()} className="underline">Reload LogicX</button>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
