import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Wallet, Loader2, Plus, Gavel, Send, Crown, Mic } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Turn = { by: string; text: string }
type Debate = { id: string; party_a: string; party_b: string; motion: string; transcript: Turn[]; turn: string; state: string; winner: string; score_a: number; score_b: number; reasoning: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_debates: 0, judged: 0 })
  const [debates, setDebates] = useState<Debate[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [motion, setMotion] = useState(''); const [opening, setOpening] = useState('')
  const [draft, setDraft] = useState(''); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_debates: Number(s?.total_debates ?? 0), judged: Number(s?.judged ?? 0) })
      const total = Number(s?.total_debates ?? 0); const out: Debate[] = []
      for (let i = total - 1; i >= 0 && i >= total - 16; i--) { try { const d = (await read('get_debate', [String(i)])) as any; if (d?.exists) out.push({ ...d, id: String(i), transcript: d.transcript ?? [] }) } catch {} }
      setDebates(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function openDebate() { if (!motion.trim() || !opening.trim()) return toast.error('Motion + opening.'); setCreating(true); const t = toast.loading('Opening…'); try { const id = (await write('open_debate', [motion.trim(), opening.trim()])) as any; toast.success('Open.', { id: t }); setMotion(''); setOpening(''); setShowNew(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function speak(d: Debate) { if (!draft.trim()) return toast.error('Your argument.'); setBusy(d.id); const t = toast.loading(d.state === 'awaiting_b' ? 'Joining as CON…' : 'Submitting…'); try { await write('speak', [d.id, draft.trim()]); setDraft(''); toast.success('Recorded.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function judge(d: Debate) { setBusy(d.id); const t = toast.loading('Judging… (30–60s)'); try { await write('judge', [d.id]); const x = (await read('get_debate', [d.id])) as any; toast.success(x?.winner === 'tie' ? 'Tie' : `Winner ${String(x?.winner).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const d = debates.find((x) => x.id === sel) || null
  const rounds: { a?: string; b?: string }[] = []
  if (d) d.transcript.forEach((t) => { if (t.by === 'a') rounds.push({ a: t.text }); else { if (rounds.length && rounds[rounds.length - 1].b === undefined) rounds[rounds.length - 1].b = t.text; else rounds.push({ b: t.text }) } })
  const winA = d?.state === 'judged' && d.winner === 'a', winB = d?.state === 'judged' && d.winner === 'b'

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Oswald, system-ui, sans-serif' }}>
      <Toaster theme="dark" position="top-center" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1000px_circle_at_50%_0%,#a78bfa22,transparent_55%)]" />
      {/* floating connect — no header bar */}
      <button onClick={connect} className="fixed right-4 top-4 z-30 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs backdrop-blur hover:border-primary"><Wallet className="mr-1 inline h-3.5 w-3.5" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'connected' : 'connect'}</button>

      <div className="mx-auto max-w-5xl px-5 pt-10 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.4em] text-primary">⚔ OpenDebate · fight night</div>
        <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">{stats.total_debates} bouts · {stats.judged} judged</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {debates.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`max-w-[220px] truncate rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${sel === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>#{x.id} {x.motion}</button>)}
          <button onClick={() => setShowNew(!showNew)} className="rounded-full border border-dashed border-border px-3 py-1 text-xs uppercase text-muted hover:text-primary"><Plus className="inline h-3 w-3" /> bout</button>
        </div>
        {showNew && (
          <div className="mx-auto mt-3 grid max-w-lg gap-2 rounded-xl border border-border bg-card/60 p-3 text-left">
            <input value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="Motion (you argue FOR)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" style={{ fontFamily: 'system-ui' }} />
            <div className="flex gap-2"><input value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Opening argument" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" style={{ fontFamily: 'system-ui' }} /><Button size="sm" onClick={openDebate} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open'}</Button></div>
          </div>
        )}
      </div>

      {d && (
        <main className="mx-auto max-w-5xl px-5 py-8">
          <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold uppercase leading-tight tracking-tight md:text-5xl">{d.motion}</h1>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className={`rounded-2xl border-2 p-4 text-center ${winA ? 'border-primary bg-primary/10' : 'border-border bg-card/50'}`}><div className="text-[11px] font-bold uppercase tracking-wider text-primary">PRO · for</div><div className="mt-1 text-[11px] text-muted" style={{ fontFamily: 'system-ui' }}>{short(d.party_a)}</div><div className="mt-2 text-5xl font-bold tabular-nums text-primary">{d.state === 'judged' ? d.score_a : '—'}</div>{winA && <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"><Crown className="h-4 w-4" /> winner</div>}</div>
            <div className="flex flex-col items-center gap-1"><div className="grid h-12 w-12 place-items-center rounded-full border-2 border-border bg-background text-sm font-bold text-muted">VS</div><div className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{d.state.replace('_', ' ')}</div>{d.state === 'debating' && <div className="text-[10px] text-primary">turn {d.turn.toUpperCase()}</div>}</div>
            <div className={`rounded-2xl border-2 p-4 text-center ${winB ? 'border-accent bg-accent/10' : 'border-border bg-card/50'}`}><div className="text-[11px] font-bold uppercase tracking-wider text-accent">CON · against</div><div className="mt-1 text-[11px] text-muted" style={{ fontFamily: 'system-ui' }}>{d.party_b ? short(d.party_b) : 'open seat'}</div><div className="mt-2 text-5xl font-bold tabular-nums text-accent">{d.state === 'judged' ? d.score_b : '—'}</div>{winB && <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent"><Crown className="h-4 w-4" /> winner</div>}</div>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border" style={{ fontFamily: 'system-ui' }}>
            <div className="grid grid-cols-[1fr_64px_1fr] bg-card/80 text-center text-[10px] font-bold uppercase tracking-wider text-muted"><div className="py-2 text-primary">PRO</div><div className="py-2">round</div><div className="py-2 text-accent">CON</div></div>
            {rounds.length === 0 && <div className="p-6 text-center text-xs text-muted">No arguments yet.</div>}
            {rounds.map((r, i) => <div key={i} className="grid grid-cols-[1fr_64px_1fr] items-stretch border-t border-border/60"><div className="bg-primary/[0.04] p-3 text-sm">{r.a || <span className="text-muted/40">—</span>}</div><div className="grid place-items-center border-x border-border/60 text-xs text-muted">{i + 1}</div><div className="bg-accent/[0.04] p-3 text-right text-sm">{r.b || <span className="text-muted/40">—</span>}</div></div>)}
          </div>
          {d.state === 'judged' ? (d.reasoning && <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted" style={{ fontFamily: 'system-ui' }}>“{d.reasoning}”</p>) : (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex w-full max-w-xl gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && speak(d)} placeholder={d.state === 'awaiting_b' ? 'Take the CON seat…' : `Argument for ${d.turn.toUpperCase()}…`} className="flex-1 rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" style={{ fontFamily: 'system-ui' }} /><Button disabled={busy === d.id} onClick={() => speak(d)}>{busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : d.state === 'awaiting_b' ? <Mic className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button></div>
              {d.state === 'debating' && d.transcript.length >= 2 && <button onClick={() => judge(d)} disabled={busy === d.id} className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary hover:underline"><Gavel className="h-3.5 w-3.5" /> call the judge</button>}
            </div>
          )}
          <div className="mt-8 text-center text-[11px] text-muted" style={{ fontFamily: 'system-ui' }}><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div>
        </main>
      )}
    </div>
  )
}
