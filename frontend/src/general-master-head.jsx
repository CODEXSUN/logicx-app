import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { Input } from '@codexsun/ui/components/input'
import { Button } from '@codexsun/ui/components/button'
import { nextEntryControl } from '@codexsun/ui/lib/entry-focus'
import { generalMasterApi } from './api'

export default function GeneralMasterHead({ id, value, onChange, invalid }) {
  const [savedHeads, setSavedHeads] = useState([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setLoading(true)
    generalMasterApi.heads().then(heads => {
      if (!cancelled) setSavedHeads(heads)
    }).catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  const options = useMemo(() => {
    return [...new Set(savedHeads.filter(Boolean))].sort((left, right) => left.localeCompare(right))
  }, [savedHeads])

  const matches = options.filter(head => head.toLowerCase().includes(query.trim().toLowerCase()))
  function choose(head) {
    onChange(head)
    setOpen(false)
    nextEntryControl(document.getElementById(id))?.focus()
  }

  return <>
    <Input id={id} value={value} role="combobox" aria-label="Master Head" aria-expanded={open}
      aria-controls={open ? `${id}-results` : undefined} aria-autocomplete="list" aria-required="true" aria-invalid={invalid}
      aria-activedescendant={open && matches[highlight] ? `${id}-result-${highlight}` : undefined}
      autoComplete="off" placeholder="Search existing master heads"
      onFocus={() => { setOpen(true); setQuery(''); setHighlight(0) }} onBlur={() => setOpen(false)}
      onChange={event => { onChange(event.target.value); setQuery(event.target.value); setHighlight(0); setOpen(true) }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true)
          if (matches.length) setHighlight(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
        }
        if (event.key === 'Enter') {
          event.preventDefault(); event.stopPropagation()
          if (!loading && !error && matches[highlight]) choose(matches[highlight])
        }
      }} />
    {open && createPortal(<aside aria-label="Master Head lookup drawer" className="fixed bottom-4 right-4 top-28 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border bg-card shadow-xl">
      <header className="flex h-12 items-center border-b bg-muted/30 px-4"><h2 className="text-sm font-semibold">Search Master Head</h2></header>
      <div id={`${id}-results`} role="listbox" aria-label="Master Head results" className="space-y-1 p-3">
        {loading ? <p role="status" className="p-3 text-sm">Loading…</p> : error ?
          <div role="alert" className="p-3 text-sm">Could not load master heads.<Button variant="outline" onPointerDown={event => event.preventDefault()} onClick={() => setAttempt(current => current + 1)}>Retry</Button></div> :
          matches.map((head, index) => <Button key={head} id={`${id}-result-${index}`} type="button" role="option" tabIndex={-1}
            aria-selected={highlight === index} variant="ghost" className={`w-full justify-start ${highlight === index ? 'bg-accent' : ''}`}
            onPointerDown={event => event.preventDefault()} onClick={() => choose(head)}>{head}</Button>)}
        {!loading && !error && !matches.length && <p role="status" className="p-3 text-sm text-muted-foreground">No matching values.</p>}
      </div>
    </aside>, document.body)}
  </>
}
