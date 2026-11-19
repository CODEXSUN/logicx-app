import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, MessageSquareIcon, XIcon } from 'lucide-react'
import { agentChatApi } from './api'
import AgentMaintenance from './agent-maintenance'

const workspaces = {
  planning: {
    title: 'Planning',
    description: 'Map the production flow and turn factory requirements into an implementation plan.',
    sections: [
      ['Fabric receipt and inspection', 'Track rolls, supplier lots, shade groups, inspection results, and release to cutting.'],
      ['Cutting and stitching', 'Define material allocation, lay plans, bundle tracking, and work order handoffs.'],
      ['Finishing and packing', 'Capture final inspection, rework, size and color counts, and carton assignment.'],
      ['Dispatch', 'Confirm packed quantities, trace cartons to orders, and record shipment handoff.'],
    ],
    prompt: 'Plan fabric receipt, roll inspection, and release to cutting. Include records, exceptions, and acceptance criteria.',
  },
  coding: {
    title: 'Agentic Coding',
    description: 'Draft implementation changes for LogicX and review the approach before editing the repository.',
    sections: [
      ['Scope the change', 'Name the screen or workflow, describe the expected behavior, and share relevant source.'],
      ['Draft the implementation', 'Work through Frappe DocTypes, API permissions, and React UI changes with the agent.'],
      ['Plan verification', 'Identify integration tests, manual checks, and migration steps for developer review.'],
    ],
    prompt: 'Draft an implementation and test plan for a shade-lot mismatch warning on fabric allocation.',
  },
}

export default function AgentWorkspace({ mode, isAdministrator }) {
  const workspace = workspaces[mode]
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(true)
  const end = useRef(null)
  const submitting = useRef(false)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, error, pending])

  async function submit(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || submitting.current) return
    submitting.current = true
    const next = [...messages, { role: 'user', content }]
    setError('')
    setPending(true)
    try {
      const recent = next.slice(-11).map((message) => ({ ...message, content: message.content.slice(0, 6000) }))
      const result = await agentChatApi.reply(mode, recent)
      setMessages([...next, { role: 'assistant', content: result.text }])
      setDraft('')
    } catch (failure) {
      setError(failure.message.replace(/^frappe\.exceptions\.\w+:\s*/u, ''))
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-full gap-5 bg-muted/30 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
      <main className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{workspace.title}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{workspace.description}</p>
          </div>
          {!open && <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"><MessageSquareIcon size={16} /> Open chat</button>}
        </header>
        {mode === 'coding' && isAdministrator && <AgentMaintenance />}
        <div className="divide-y rounded-xl border bg-card">
          {workspace.sections.map(([title, description]) => (
            <section key={title} className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </section>
          ))}
        </div>
      </main>
      {open && (
        <aside aria-label="Agent chat" className="flex h-[min(72vh,680px)] min-h-96 min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareIcon size={16} /> Agent chat</h2>
            <button aria-label="Close chat" type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><XIcon size={16} /></button>
          </header>
          <div role="log" className="min-h-0 flex-1 space-y-3 overflow-auto p-4 text-sm">
            {messages.length === 0 && (
              <button type="button" disabled={pending} onClick={() => setDraft(workspace.prompt)} className="rounded-lg border bg-muted/40 p-3 text-left hover:bg-muted">{workspace.prompt}</button>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`whitespace-pre-wrap break-words rounded-lg p-3 ${message.role === 'user' ? 'ml-5 bg-primary text-primary-foreground' : 'mr-5 bg-muted'}`}>
                <div className="mb-1 text-xs font-semibold">{message.role === 'user' ? 'You' : 'Agent'}</div>
                {message.content}
              </div>
            ))}
            {pending && <p role="status" className="text-muted-foreground">Waiting for the agent…</p>}
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <div ref={end} />
          </div>
          <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
            <textarea aria-label="Message" placeholder="Message the agent" rows={2} maxLength={6000} value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm" />
            <button type="submit" aria-label="Send message" disabled={pending || !draft.trim()} className="rounded-md bg-primary p-2.5 text-primary-foreground disabled:opacity-40"><ArrowUpIcon size={18} /></button>
          </form>
        </aside>
      )}
    </div>
  )
}
