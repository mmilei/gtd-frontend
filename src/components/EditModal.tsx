import { Check, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dismissItem, fetchItem, markDone, markdownifyItem, moveItem, patchMeta, replaceBody } from '../lib/api'
import { BUCKET_META, BUCKET_ORDER } from '../lib/bucketMeta'
import { SYSTEM_TAGS } from '../lib/types'
import type { Bucket, Item } from '../lib/types'
import { Overlay } from './Overlay'
import { PillEditor } from './PillEditor'

interface Props {
  file: string
  tagSuggestions: string[]
  onClose: () => void
  onSaved: () => void
}

const cleanTag = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

export function EditModal({ file, tagSuggestions, onClose, onSaved }: Props) {
  const [original, setOriginal] = useState<Item | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [people, setPeople] = useState<string[]>([])
  const [due, setDue] = useState('')
  const [todaySince, setTodaySince] = useState('')
  const [area, setArea] = useState('')
  const [estimate, setEstimate] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Save')
  const [improving, setImproving] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchItem(file)
      .then(item => {
        if (cancelled) return
        setOriginal(item)
        setTitle(item.title ?? file)
        setBody(item.body ?? '')
        setBucket(item.bucket ?? null)
        setTags(item.tags ?? [])
        setPeople(item.delegado_a ?? [])
        setDue(item.due ?? '')
        setTodaySince(item.today_since ?? '')
        setArea(item.area ?? '')
        setEstimate(item.estimate_minutes != null ? String(item.estimate_minutes) : '')
      })
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
  }, [file])

  const userTags = useMemo(() => tags.filter(t => !SYSTEM_TAGS.has(t)), [tags])

  const dirty = useMemo(() => {
    if (!original) return false
    const same = (a: string[], b: string[]) =>
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
    return (
      title !== (original.title ?? '') ||
      body !== (original.body ?? '') ||
      bucket !== (original.bucket ?? null) ||
      !same(tags, original.tags ?? []) ||
      !same(people, original.delegado_a ?? []) ||
      (due || null) !== (original.due ?? null) ||
      (todaySince || null) !== (original.today_since ?? null) ||
      (area || null) !== (original.area ?? null) ||
      (estimate ? Number(estimate) : null) !== (original.estimate_minutes ?? null)
    )
  }, [original, title, body, bucket, tags, people, due, todaySince, area, estimate])

  function requestClose() {
    if (dirty) setConfirmingDiscard(true)
    else onClose()
  }

  async function save() {
    if (!original) return
    setSaving(true)
    setSaveLabel('Saving…')
    try {
      if (bucket && bucket !== original.bucket) {
        await moveItem(file, bucket, bucket === 'today' ? due || null : null)
      }
      if (body !== (original.body ?? '')) await replaceBody(file, body)

      const nextTags = tags.includes('gtd') ? tags : ['gtd', ...tags]
      const meta: Partial<Item> = {}
      if (title && title !== (original.title ?? '')) meta.title = title
      if (JSON.stringify([...nextTags].sort()) !== JSON.stringify([...(original.tags ?? [])].sort())) meta.tags = nextTags
      if ((due || null) !== (original.due ?? null)) meta.due = due || null
      if (bucket === 'today' && !original.today_since && !todaySince) {
        const d = new Date()
        meta.today_since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } else if ((todaySince || null) !== (original.today_since ?? null)) {
        meta.today_since = todaySince || null
      }
      if (JSON.stringify([...people].sort()) !== JSON.stringify([...(original.delegado_a ?? [])].sort())) meta.delegado_a = people
      if ((area || null) !== (original.area ?? null)) meta.area = area || null
      const estimateNum = estimate ? Math.max(1, Math.round(Number(estimate))) : null
      if (estimateNum !== (original.estimate_minutes ?? null)) meta.estimate_minutes = estimateNum
      if (Object.keys(meta).length > 0) await patchMeta(file, meta)

      setOriginal({ ...original, title, body, bucket: bucket ?? undefined, tags: nextTags, due: due || null, today_since: meta.today_since !== undefined ? meta.today_since : original.today_since, delegado_a: people, area: area || null })
      setSaveLabel('Saved ✓')
      setTimeout(() => setSaveLabel('Save'), 1000)
      onSaved()
    } catch {
      setSaveLabel('Error — retry')
    } finally {
      setSaving(false)
    }
  }

  async function improve() {
    setImproving(true)
    try {
      const result = await markdownifyItem(file)
      if (result.body) setBody(result.body)
      if (Array.isArray(result.tags)) setTags(result.tags)
    } catch {
      // button re-enables; user can retry
    } finally {
      setImproving(false)
    }
  }

  async function runAndClose(action: () => Promise<unknown>) {
    try {
      await action()
      onSaved()
      onClose()
    } catch {
      // keep the modal open so nothing is silently lost
    }
  }

  return (
    <Overlay title={loadFailed ? file : 'Edit'} onClose={requestClose} wide>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-1.5">
          {BUCKET_ORDER.map(b => {
            const meta = BUCKET_META[b]
            const active = b === bucket
            return (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active ? 'border-transparent' : 'border-line text-ink-muted hover:border-line-strong'
                }`}
                style={active ? { background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, color: meta.color } : undefined}
              >
                <meta.Icon size={12} />
                {meta.label}
              </button>
            )
          })}
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          spellCheck={false}
          placeholder="Title"
          className="rounded-card border border-line bg-bg px-3.5 py-2 font-display text-[15px] text-ink focus:border-accent/60 focus:outline-none"
        />

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
          }}
          spellCheck={false}
          rows={8}
          placeholder="Notes (markdown)"
          className="resize-y rounded-card border border-line bg-bg px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink focus:border-accent/60 focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">Due date</span>
            <input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              className="rounded-card border border-line bg-bg px-3 py-1.5 font-mono text-[12px] text-ink focus:border-accent/60 focus:outline-none [color-scheme:dark]"
            />
          </label>
          {bucket !== 'reference' && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">Estimate (min)</span>
              <input
                type="number"
                min={1}
                step={5}
                value={estimate}
                onChange={e => setEstimate(e.target.value)}
                placeholder="e.g. 30"
                className="rounded-card border border-line bg-bg px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
          )}
          {bucket === 'today' && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">In today since</span>
              <input
                type="date"
                value={todaySince}
                onChange={e => setTodaySince(e.target.value)}
                className="rounded-card border border-line bg-bg px-3 py-1.5 font-mono text-[12px] text-ink focus:border-accent/60 focus:outline-none [color-scheme:dark]"
              />
            </label>
          )}
          {bucket === 'reference' && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">Area</span>
              <input
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="e.g. work, health, finance"
                className="rounded-card border border-line bg-bg px-3 py-1.5 text-[12px] text-ink focus:border-accent/60 focus:outline-none"
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">Tags</span>
          <PillEditor
            values={userTags}
            placeholder="+ tag"
            suggestions={tagSuggestions}
            normalize={cleanTag}
            onAdd={t => setTags(prev => (prev.includes(t) ? prev : [...prev, t]))}
            onRemove={t => setTags(prev => prev.filter(x => x !== t))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">Related people</span>
          <PillEditor
            values={people}
            placeholder="+ person"
            onAdd={p => setPeople(prev => (prev.includes(p) ? prev : [...prev, p]))}
            onRemove={p => setPeople(prev => prev.filter(x => x !== p))}
          />
        </div>

        {confirmingDiscard ? (
          <div className="flex items-center gap-3 rounded-card border border-waiting/40 bg-waiting/10 px-4 py-2.5">
            <span className="flex-1 text-[12.5px] text-ink">Discard unsaved changes?</span>
            <button onClick={onClose} className="rounded-md bg-discard/20 px-3 py-1 text-[12px] text-discard">Discard</button>
            <button onClick={() => setConfirmingDiscard(false)} className="rounded-md border border-line px-3 py-1 text-[12px] text-ink-muted">Keep editing</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-line pt-4">
            <button
              onClick={() => runAndClose(() => markDone(file))}
              className="flex items-center gap-1.5 rounded-md border border-done/40 px-3 py-1.5 text-[12px] text-done transition-colors hover:bg-done/10"
            >
              <Check size={13} /> Done
            </button>
            <button
              onClick={() => runAndClose(() => dismissItem(file))}
              className="flex items-center gap-1.5 rounded-md border border-discard/40 px-3 py-1.5 text-[12px] text-discard transition-colors hover:bg-discard/10"
            >
              <Trash2 size={13} /> Discard
            </button>
            {bucket !== 'reference' && (
              <button
                onClick={improve}
                disabled={improving || !!original?.markdownified}
                title={original?.markdownified ? 'Already improved with AI' : 'Enrich with AI'}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
              >
                <Sparkles size={13} /> {improving ? 'Improving…' : 'Improve'}
              </button>
            )}
            <div className="flex-1" />
            <button onClick={requestClose} className="rounded-md px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink">
              {dirty ? 'Discard changes' : 'Cancel'}
            </button>
            <button
              onClick={save}
              disabled={saving || !original}
              className="rounded-md bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saveLabel}
            </button>
          </div>
        )}
      </div>
    </Overlay>
  )
}
