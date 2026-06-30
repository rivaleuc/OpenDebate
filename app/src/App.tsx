import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Swords, Wallet, Loader2, Plus, Gavel, Send, Trophy, ChevronDown, Mic,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button, Badge } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Turn = { by: string; text: string }
type Debate = { id: string; party_a: string; party_b: string; motion: string; transcript: Turn[]; turn: string; state: string; winner: string; score_a: number; score_b: number; reasoning: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_debates: 0, judged: 0 })
  const [debates, setDebates] = useState<Debate[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [motion, setMotion] = useState(''); const [opening, setOpening] = useState('')
  const [draft, setDraft] = useState(''); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_debates: Number(s?.total_debates ?? 0), judged: Number(s?.judged ?? 0) })
      const total = Number(s?.total_debates ?? 0); const out: Debate[] = []
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const d = (await read('get_debate', [String(i)])) as any; if (d?.exists) out.push({ ...d, id: String(i), transcript: d.transcript ?? [] }) } catch {} }
      setDebates(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function openDebate() { if (!motion.trim() || !opening.trim()) return toast.error('Motion + your opening (side A).'); setCreating(true); const t = toast.loading('Opening debate…'); try { const id = (await write('open_debate', [motion.trim(), opening.trim()])) as any; toast.success('Debate open — awaiting an opponent.', { id: t }); setMotion(''); setOpening(''); setOpen(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function speak(d: Debate) { if (!draft.trim()) return toast.error('Write your argument.'); setBusy(d.id); const t = toast.loading(d.state === 'awaiting_b' ? 'Joining as side B…' : 'Submitting your turn…'); try { await write('speak', [d.id, draft.trim()]); setDraft(''); toast.success('Argument recorded.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function judge(d: Debate) { setBusy(d.id); const t = toast.loading('Validators judging the debate… (30–60s)'); try { await write('judge', [d.id]); const x = (await read('get_debate', [d.id])) as any; const w = x?.winner; toast.success(w === 'tie' ? 'Verdict: tie' : `Winner: side ${String(w).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const active = debates.find((d) => d.id === sel) || null
  const winnerTone = (w: string) => (w === 'a' ? 'true' : w === 'b' ? 'false' : 'unverifiable')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#a78bfa1f,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-5">
          <Swords className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">OpenDebate</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_debates} /></b> debates · <b className="text-primary"><NumberTicker value={stats.judged} /></b> judged</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-5 py-6 lg:grid-cols-[300px_1fr]">
        {/* left: debate list */}
        <aside className="space-y-2">
          <Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'} className="w-full"><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Open a debate'}</Button>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="grid gap-2 rounded-xl border border-border bg-card/60 p-3">
                  <input value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="Motion (you argue FOR it)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                  <textarea value={opening} onChange={(e) => setOpening(e.target.value)} rows={3} placeholder="Your opening argument…" className="resize-none rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                  <Button size="sm" onClick={openDebate} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Open</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-1.5">
            {debates.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">No debates yet.</div>}
            {debates.map((d) => (
              <button key={d.id} onClick={() => setSel(d.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${sel === d.id ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40 hover:bg-card/70'}`}>
                <div className="flex items-center gap-2"><span className="line-clamp-2 text-sm font-medium">{d.motion}</span>{d.state === 'judged' && <Trophy className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />}</div>
                <div className="mt-0.5 text-[11px] text-muted">{d.transcript.length} turns · {d.state.replace('_', ' ')}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* right: debate floor */}
        <section className="flex min-h-[62vh] flex-col rounded-2xl border border-border bg-card/40">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted"><Swords className="mb-2 h-8 w-8 opacity-40" />Pick or open a debate.</div>
          ) : (
            <>
              <div className="border-b border-border px-5 py-3">
                <div className="flex items-start gap-2"><h2 className="font-bold leading-snug">{active.motion}</h2>{active.state === 'judged' && <Badge tone={winnerTone(active.winner)} className="ml-auto shrink-0">{active.winner === 'tie' ? 'tie' : `side ${active.winner.toUpperCase()} wins`}</Badge>}</div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                  <span className="text-true">● A (for) {active.party_a && short(active.party_a)}</span>
                  <span className="text-false">● B (against) {active.party_b ? short(active.party_b) : '— open'}</span>
                  {active.state === 'debating' && <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-primary">turn: {active.turn.toUpperCase()}</span>}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {active.transcript.map((t, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${t.by === 'a' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${t.by === 'a' ? 'rounded-bl-sm border border-true/30 bg-true/10' : 'rounded-br-sm border border-false/30 bg-false/10'}`}>
                      <div className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${t.by === 'a' ? 'text-true' : 'text-false'}`}>{t.by === 'a' ? 'For' : 'Against'}</div>
                      {t.text}
                    </div>
                  </motion.div>
                ))}
                {active.state === 'judged' && (
                  <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"><Gavel className="h-4 w-4" /> verdict</div>
                    <div className="flex h-3 overflow-hidden rounded-full"><div className="bg-true" style={{ width: `${active.score_a}%` }} /><div className="bg-border" style={{ width: `${Math.max(0, 100 - active.score_a - active.score_b)}%` }} /><div className="bg-false" style={{ width: `${active.score_b}%` }} /></div>
                    <div className="mt-1 flex justify-between font-mono text-[11px]"><span className="text-true">A {active.score_a}</span><span className="text-false">{active.score_b} B</span></div>
                    {active.reasoning && <p className="mt-2 text-sm text-muted">{active.reasoning}</p>}
                  </div>
                )}
              </div>

              {active.state !== 'judged' && (
                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <input value={sel === active.id ? draft : ''} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && speak(active)} placeholder={active.state === 'awaiting_b' ? 'Join as side B (against)…' : `Argument for side ${active.turn.toUpperCase()}…`} className="flex-1 rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
                    <Button disabled={busy === active.id} onClick={() => speak(active)}>{busy === active.id ? <Loader2 className="h-4 w-4 animate-spin" /> : active.state === 'awaiting_b' ? <Mic className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
                  </div>
                  {active.state === 'debating' && active.transcript.length >= 2 && <button onClick={() => judge(active)} disabled={busy === active.id} className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Gavel className="h-3.5 w-3.5" /> call the judge</button>}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted"><span>OpenDebate · adversarial debates judged by consensus on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
