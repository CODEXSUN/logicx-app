import { useEffect, useRef, useState } from 'react'
import { MasterForm } from '@codexsun/ui/blocks/master-list'
import { Button } from '@codexsun/ui/components/button'
import { Input } from '@codexsun/ui/components/input'
import { generalMasterApi } from './api'
import { empty, fields } from './general-master'

const formId = 'general-master-workspace-form'

export default function GeneralMasterWorkspace({ setHeaderAction }) {
  const [records, setRecords] = useState([])
  const [values, setValues] = useState(empty)
  const [initial, setInitial] = useState(empty)
  const [recordId, setRecordId] = useState(null)
  const [listQuery, setListQuery] = useState('')
  const [lookupOpen, setLookupOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [focusVersion, setFocusVersion] = useState(0)
  const savingRef = useRef(false)
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  async function load() {
    setLoading(true)
    try { setRecords(await generalMasterApi.list()); setError('') }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (saving) return
    const frame = requestAnimationFrame(() => document.getElementById(`${formId}-type`)?.focus())
    return () => cancelAnimationFrame(frame)
  }, [focusVersion, saving])
  useEffect(() => {
    const preventLoss = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [dirty])
  useEffect(() => {
    setHeaderAction({ title: 'Master', label: saving ? 'Saving…' : 'Save',
      disabled: saving || loading, onSelect: () => document.getElementById(formId)?.requestSubmit(),
      confirmLeave: () => !dirty || window.confirm('Discard your unsaved changes?') })
    return () => setHeaderAction(null)
  }, [saving, loading, dirty, setHeaderAction])

  function reset() {
    setValues(empty); setInitial(empty); setRecordId(null); setQuery('')
    setFocusVersion(version => version + 1)
  }
  function selectRecord(record) {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    const next = { ...record, active: record.active ? 'Active' : 'Inactive' }
    const data = Object.fromEntries(Object.keys(empty).map(key => [key, String(next[key] ?? '')]))
    setValues(data); setInitial(data); setRecordId(record.name); setNotice(''); setQuery('')
    setFocusVersion(version => version + 1)
  }
  async function save(next) {
    if (savingRef.current) return
    if (!heads.includes(next.type.trim()) && !(recordId && next.type.trim() === initial.type)) {
      setError('Select an existing Master Head from the search results.')
      document.getElementById(`${formId}-type`)?.focus()
      return
    }
    savingRef.current = true; setSaving(true); setError(''); setNotice('')
    try {
      const saved = await generalMasterApi.save(recordId, next)
      setRecords(current => [saved, ...current.filter(record => record.name !== saved.name)])
      reset(); setNotice('Saved. Ready for the next entry.')
    } catch (failure) { setError(failure.message) }
    finally { savingRef.current = false; setSaving(false) }
  }

  const heads = [...new Set(records.filter(record => String(record.type).trim().toLowerCase() === 'type')
    .map(record => record.master_name?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const options = heads
  const matches = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()))
  const choices = matches
  function choose(value) {
    setValues(current => ({ ...current, type: value })); setQuery(''); setError('')
    document.getElementById(`${formId}-master_name`)?.focus()
  }

  return <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(240px,1fr)_minmax(340px,1.4fr)]">
    <section aria-label="General Master data list" className="min-w-0 rounded-2xl border bg-card">
      <header className="flex h-12 items-center border-b bg-muted/30 px-4"><h2 className="text-sm font-semibold">Data list</h2></header>
      <div className="p-4"><Input aria-label="Search general masters" placeholder="Search records…" value={listQuery} onChange={event => setListQuery(event.target.value)} /></div>
      {loading ? <p role="status" className="p-4">Loading records…</p> : <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr><th className="p-3">Master Head</th><th className="p-3">Value</th></tr></thead>
          <tbody>{records.filter(record => `${record.type} ${record.master_name}`.toLowerCase().includes(listQuery.toLowerCase())).map(record =>
            <tr key={record.name} className={record.name === recordId ? 'border-t bg-accent' : 'border-t'}><td className="break-words p-3">{record.type}</td>
              <td className="p-3"><button className="text-left font-medium hover:underline" onClick={() => selectRecord(record)}>{record.master_name}</button></td></tr>)}</tbody></table>
        {!records.length && <p className="p-4 text-muted-foreground">No records yet.</p>}
      </div>}
      <div className="border-t p-4 text-xs text-muted-foreground">{records.length} records</div>
      {error && <div role="alert" className="p-4 text-sm text-destructive">{error}<Button variant="outline" onClick={load}>Refresh list</Button></div>}
    </section>
    <section aria-label="General Master entry" className="min-w-0">
      {notice && <p role="status" className="sr-only">{notice}</p>}
      <MasterForm formId={formId} title="Entry" variant="panel" compact hideSubmitButton
        fields={fields} values={values} onValueChange={(key, value) => setValues(current => ({ ...current, [key]: value }))}
        onSubmit={save} onCancel={() => { if (!dirty || window.confirm('Discard your unsaved changes?')) reset() }}
        renderField={(field, control) => field.id === 'type' ? <Input id={control.id} value={control.value}
          role="combobox" aria-expanded={lookupOpen} aria-controls={`${formId}-results`} aria-autocomplete="list"
          aria-activedescendant={lookupOpen && choices[highlight] ? `${formId}-option-${highlight}` : undefined}
          aria-invalid={control.invalid} aria-required={field.required} autoComplete="off"
          placeholder="Search existing master heads"
          onFocus={() => { setLookupOpen(true); setQuery(''); setHighlight(0) }}
          onBlur={() => setLookupOpen(false)}
          onChange={event => { control.onChange(event.target.value); setQuery(event.target.value); setHighlight(0); setLookupOpen(true) }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Escape') { event.preventDefault(); setLookupOpen(false); return }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setLookupOpen(true)
              if (choices.length) setHighlight(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length)
            }
            if (event.key === 'Enter') {
              event.preventDefault(); event.stopPropagation()
              if (!loading && choices[highlight]) choose(choices[highlight])
            }
          }} /> : null} />
    </section>
    {lookupOpen && <aside aria-label="Master Head lookup drawer" className="fixed bottom-4 right-4 top-28 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border bg-card shadow-xl">
      <header className="flex h-12 items-center border-b bg-muted/30 px-4"><h2 className="text-sm font-semibold">Search Master Head</h2></header>
      <div id={`${formId}-results`} role="listbox" aria-label="Master Head results" className="space-y-1 p-3">
        {choices.map((option, index) => <Button key={option} id={`${formId}-option-${index}`} role="option"
          aria-selected={highlight === index} variant="ghost" className={`w-full justify-start ${highlight === index ? 'bg-accent' : ''}`}
          tabIndex={-1} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>{option}</Button>)}
        {!loading && !choices.length && <p className="p-3 text-sm text-muted-foreground">No matching values.</p>}
      </div>
    </aside>}
  </div>
}
