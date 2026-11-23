import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { MasterForm } from '@codexsun/ui/blocks/master-list'
import { createDataTableColumnHelper, DataTableBlock, DataTableRowActions } from '@codexsun/ui/blocks/table'
import { Button } from '@codexsun/ui/components/button'
import { generalMasterApi } from './api'
import GeneralMasterHead from './general-master-head'

export const empty = { type: '', master_name: '', description: '', active: 'Active', tag: '' }
export const fields = [
  { id: 'type', label: 'Master Head', required: true, placeholder: 'Select an existing Value under Type.' },
  { id: 'master_name', label: 'Value', required: true },
  { id: 'description', label: 'Description', type: 'textarea' },
  { id: 'active', label: 'Active', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }] },
  { id: 'tag', label: 'Tag' },
]

function ErrorNotice({ error, retry }) {
  return error ? <div role="alert" className="m-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
    <p>{error}</p>{retry && <Button onClick={retry} variant="outline">Retry</Button>}
  </div> : null
}

function GeneralMasterList({ setHeaderAction }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setRecords(await generalMasterApi.list()) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    setHeaderAction({ label: 'New general master', onSelect: () => navigate('/general-masters/new') })
    return () => setHeaderAction(null)
  }, [navigate, setHeaderAction])

  async function deactivate(record) {
    try { await generalMasterApi.deactivate(record.name); await load() }
    catch (failure) { setError(failure.message) }
  }

  const helper = createDataTableColumnHelper()
  const open = record => navigate(`/general-masters/${encodeURIComponent(record.name)}/edit`)
  const columns = ['type', 'master_name', 'description', 'active', 'tag'].map(key => helper.accessor(key, {
    header: fields.find(field => field.id === key).label,
    cell: ({ row }) => <div data-field-label={fields.find(field => field.id === key).label}>{key === 'master_name'
      ? <button className="text-left font-medium underline-offset-4 hover:underline" onClick={() => open(row.original)}>{row.original.master_name}</button>
      : key === 'active' ? (row.original.active ? 'Active' : 'Inactive') : row.original[key] || '—'}</div>,
  }))
  columns.push(helper.display({ id: 'actions', header: 'Actions', cell: ({ row }) =>
    <DataTableRowActions label={`Actions for ${row.original.master_name}`} actions={[
      { id: 'edit', label: 'Edit', onSelect: () => navigate(`/general-masters/${encodeURIComponent(row.original.name)}/edit`) },
      ...(row.original.active ? [{ id: 'deactivate', label: 'Deactivate', onSelect: () => deactivate(row.original) }] : []),
    ]} />,
  }))

  return <div className="logicx-master-list logicx-general-list flex min-w-0 flex-col px-4 py-4 sm:px-6">
    <ErrorNotice error={error} retry={load} />
    {loading ? <p role="status" className="p-6 text-sm">Loading general masters…</p> :
      <DataTableBlock columns={columns} data={records} getRowId={record => record.name}
        getSearchText={record => fields.map(field => field.id === 'active' ? (record.active ? 'Active' : 'Inactive') : String(record[field.id] ?? '')).join(' ')}
        filterOptions={[{ label: 'Active', value: '1' }, { label: 'Inactive', value: '0' }]}
        getFilterValue={record => String(record.active)} itemLabel="general masters" pageWidth="full"
        defaultPageSize={100} pageSizeOptions={[10, 20, 25, 50, 100]}
        emptyMessage="No general masters found." />}
  </div>
}

function GeneralMasterRecord({ create = false, setHeaderAction }) {
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
  const editable = true

  async function load() {
    setLoading(true)
    setError('')
    try {
      const record = await generalMasterApi.get(name)
      const next = Object.fromEntries(Object.keys(empty).map(key => [key, String(record[key] ?? empty[key])]))
      next.active = record.active ? 'Active' : 'Inactive'
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
    if (!loading && loaded) document.getElementById('general-master-form-type')?.focus()
  }, [loading, loaded])

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
        if (!savingRef.current) document.getElementById('general-master-form')?.requestSubmit()
      }
    }
    window.addEventListener('keydown', saveShortcut)
    return () => window.removeEventListener('keydown', saveShortcut)
  }, [editable])

  useEffect(() => {
    setHeaderAction(loading || !loaded ? null : editable
      ? { label: saving ? 'Saving…' : 'Save', disabled: saving,
          confirmLeave: () => !dirty || window.confirm('Discard your unsaved changes?'),
          cancel: () => { if (!dirty || window.confirm('Discard your unsaved changes?')) navigate('/general-masters') },
          title: create ? 'General Master / New' : 'General Master / Edit',
          onSelect: () => document.getElementById('general-master-form')?.requestSubmit() }
      : { label: 'Edit', title: 'General Master / ' + values.master_name,
          onSelect: () => navigate(`/general-masters/${encodeURIComponent(name)}/edit`) })
    return () => setHeaderAction(null)
  }, [editable, create, loading, loaded, saving, dirty, name, values.master_name, navigate, setHeaderAction])

  function cancel() {
    if (!dirty || window.confirm('Discard your unsaved changes?')) navigate('/general-masters')
  }

  async function save(next) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const heads = await generalMasterApi.heads()
      if (!heads.includes(next.type.trim()) && !(name && next.type.trim() === initial.type)) {
        throw new Error('Select an existing Master Head from the search results.')
      }
      await generalMasterApi.save(create ? null : name, next)
      setInitial(next)
      navigate('/general-masters')
    } catch (failure) { setError(failure.message) }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <div className="w-full p-6 lg:pr-[360px]">
    <ErrorNotice error={error} retry={!create ? load : undefined} />
    {loading ? <p role="status">Loading general master…</p> : !loaded ? null :
      <fieldset disabled={saving}><MasterForm compact formId="general-master-form" title={create ? 'New general master' : 'Edit general master'}
        fields={fields} values={values} onValueChange={(key, value) => setValues(current => ({ ...current, [key]: value }))}
        renderField={(field, control) => field.id === 'type' ? <GeneralMasterHead {...control} /> : null}
        onSubmit={save} onCancel={cancel} hideSubmitButton /></fieldset>}
  </div>
}

export default function GeneralMasterRoutes({ setHeaderAction }) {
  return <Routes>
    <Route index element={<GeneralMasterList setHeaderAction={setHeaderAction} />} />
    <Route path="new" element={<GeneralMasterRecord key="new" create setHeaderAction={setHeaderAction} />} />
    <Route path=":name/edit" element={<GeneralMasterRecord key="edit" setHeaderAction={setHeaderAction} />} />
    <Route path=":name" element={<Navigate to="/general-masters" replace />} />
  </Routes>
}
