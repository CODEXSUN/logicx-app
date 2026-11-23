import { useEffect, useRef, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { MasterForm } from '@codexsun/ui/blocks/master-list'
import { createDataTableColumnHelper, DataTableBlock, DataTableRowActions } from '@codexsun/ui/blocks/table'
import { Button } from '@codexsun/ui/components/button'
import { lineMasterApi } from './api'

const empty = { factory: '', floor: '', area: '', line_no: '' }
const fields = [
  { id: 'factory', label: 'Factory', required: true },
  { id: 'floor', label: 'Floor', required: true },
  { id: 'area', label: 'Area', required: true },
  { id: 'line_no', label: 'Line No', required: true },
]

function ErrorNotice({ error, retry }) {
  return error ? <div role="alert" className="m-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
    <p>{error}</p>{retry && <Button onClick={retry} variant="outline">Retry</Button>}
  </div> : null
}

function LineMasterList({ setHeaderAction }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setRecords(await lineMasterApi.list()) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    setHeaderAction({ label: 'New line master', onSelect: () => navigate('/line-masters/new') })
    return () => setHeaderAction(null)
  }, [navigate, setHeaderAction])

  const helper = createDataTableColumnHelper()
  const open = record => navigate(`/line-masters/${encodeURIComponent(record.name)}`)
  const columns = ['name', 'factory', 'floor', 'area', 'line_no'].map(key => helper.accessor(key, {
    header: key === 'name' ? 'Serial No' : fields.find(field => field.id === key).label,
    cell: ({ row }) => <div data-field-label={key === 'name' ? 'Serial No' : fields.find(field => field.id === key).label}>{key === 'name'
      ? <button className="text-left font-medium underline-offset-4 hover:underline" onClick={() => open(row.original)}>{row.original.name}</button>
      : row.original[key] || '—'}</div>,
  }))
  columns.push(helper.display({ id: 'actions', header: 'Actions', cell: ({ row }) =>
    <DataTableRowActions label={`Actions for ${row.original.name}`} actions={[
      { id: 'view', label: 'View', onSelect: () => open(row.original) },
      { id: 'edit', label: 'Edit', onSelect: () => navigate(`/line-masters/${encodeURIComponent(row.original.name)}/edit`) },
    ]} />,
  }))

  return <div className="logicx-master-list logicx-line-list flex min-w-0 flex-col px-4 py-4 sm:px-6">
    <ErrorNotice error={error} retry={load} />
    {loading ? <p role="status" className="p-6 text-sm">Loading line masters…</p> :
      <DataTableBlock columns={columns} data={records} getRowId={record => record.name}
        getSearchText={record => [record.name, ...fields.map(field => record[field.id])].join(' ')}
        itemLabel="line masters" pageWidth="full"
        defaultPageSize={100} pageSizeOptions={[10, 20, 25, 50, 100]}
        emptyMessage="No line masters found." />}
  </div>
}

function LineMasterRecord({ edit = false, create = false, setHeaderAction }) {
  const { name } = useParams()
  const navigate = useNavigate()
  const [values, setValues] = useState(empty)
  const [initial, setInitial] = useState(empty)
  const [loading, setLoading] = useState(!create)
  const [loaded, setLoaded] = useState(create)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const editable = edit || create

  async function load() {
    setLoading(true)
    setError('')
    try {
      const record = await lineMasterApi.get(name)
      const next = Object.fromEntries(Object.keys(empty).map(key => [key, String(record[key] ?? empty[key])]))
      setValues(next)
      setInitial(next)
      setLoaded(true)
    } catch (failure) { setLoaded(false); setError(failure.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (create) { setValues(empty); setInitial(empty); setLoading(false) }
    else load()
  }, [name, create])

  useEffect(() => {
    function preventLoss(event) { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [dirty])

  useEffect(() => {
    if (!editable) return
    function saveShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!savingRef.current) document.getElementById('line-master-form')?.requestSubmit()
      }
    }
    window.addEventListener('keydown', saveShortcut)
    return () => window.removeEventListener('keydown', saveShortcut)
  }, [editable])

  useEffect(() => {
    setHeaderAction(loading || !loaded ? null : editable
      ? { label: saving ? 'Saving…' : 'Save', disabled: saving,
          confirmLeave: () => !dirty || window.confirm('Discard your unsaved changes?'),
          cancel: () => { if (!dirty || window.confirm('Discard your unsaved changes?')) navigate('/line-masters') },
          title: create ? 'Line Master / New' : 'Line Master / Edit',
          onSelect: () => document.getElementById('line-master-form')?.requestSubmit() }
      : { label: 'Edit', title: 'Line Master / ' + name,
          onSelect: () => navigate(`/line-masters/${encodeURIComponent(name)}/edit`) })
    return () => setHeaderAction(null)
  }, [editable, create, loading, loaded, saving, dirty, name, navigate, setHeaderAction])

  function cancel() {
    if (!dirty || window.confirm('Discard your unsaved changes?')) navigate('/line-masters')
  }

  async function save(next) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const record = await lineMasterApi.save(create ? null : name, next)
      setInitial(next)
      navigate(`/line-masters/${encodeURIComponent(record.name)}`)
    } catch (failure) { setError(failure.message) }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <div className="mx-auto w-full max-w-[1100px] p-6">
    <ErrorNotice error={error} retry={!create ? load : undefined} />
    {loading ? <p role="status">Loading line master…</p> : !loaded ? null : editable ?
      <fieldset disabled={saving}><MasterForm formId="line-master-form" title={create ? 'New line master' : 'Edit line master'}
        description={create ? 'Serial No is assigned automatically when saved.' : `Serial No: ${name}`} fields={fields} values={values} onValueChange={(key, value) => setValues(current => ({ ...current, [key]: value }))}
        onSubmit={save} onCancel={cancel} hideSubmitButton /></fieldset> :
      <section className="space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">{name}</h1>
          <Button variant="outline" onClick={() => navigate('/line-masters')}>Back to list</Button></div>
        <dl className="grid gap-5 rounded-lg border p-6 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">Serial No</dt><dd className="mt-1">{name}</dd></div>
          {fields.map(field => <div key={field.id}><dt className="text-sm text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{values[field.id] || '—'}</dd></div>)}
        </dl>
      </section>}
  </div>
}

export default function LineMasterRoutes({ setHeaderAction }) {
  return <Routes>
    <Route index element={<LineMasterList setHeaderAction={setHeaderAction} />} />
    <Route path="new" element={<LineMasterRecord key="new" create setHeaderAction={setHeaderAction} />} />
    <Route path=":name/edit" element={<LineMasterRecord key="edit" edit setHeaderAction={setHeaderAction} />} />
    <Route path=":name" element={<LineMasterRecord key="show" setHeaderAction={setHeaderAction} />} />
  </Routes>
}
