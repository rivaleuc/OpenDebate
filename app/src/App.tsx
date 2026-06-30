import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Swords, Wallet, Loader2, Plus, Gavel, Send, Crown, Mic } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
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
  async function openDebate() { if (!motion.trim() || !opening.trim()) return toast.error('Motion + opening (side A).'); setCreating(true); const t = toast.loading('Opening…'); try { const id = (await write('open_debate', [motion.trim(), opening.trim()])) as any; toast.success('Open — awaiting opponent.', { id: t }); setMotion(''); setOpening(''); setShowNew(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function speak(d: Debate) { if (!draft.trim()) return toast.error('Your argument.'); setBusy(d.id); const t = toast.loading(d.state === 'awaiting_b' ? 'Joining as CON…' : 'Submitting turn…'); try { await write('speak', [d.id, draft.trim()]); setDraft(''); toast.success('Recorded.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function judge(d: Debate) { setBusy(d.id); const t = toast.loading('Judging… (30–60s)'); try { await write('judge', [d.id]); const x = (await read('get_debate', [d.id])) as any; toast.success(x?.winner === 'tie' ? 'Tie' : `Winner: ${String(x?.winner).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const d = debates.find((x) => x.id === sel) || null
  // pair the flat transcript into rounds: [A,B][A,B]...
  const rounds: { a?: string; b?: string }[] = []
  if (d) d.transcript.forEach((t) => { if (t.by === 'a') rounds.push({ a: t.text }); else { if (rounds.length && rounds[rounds.length - 1].b === undefined) rounds[rounds.length - 1].b = t.text; else rounds.push({ b: t.text }) } })
  const winA = d?.state === 'judged' && d.winner === 'a', winB = d?.state === 'judged' && d.winner === 'b'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#a78bfa1f,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
          <Swords className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">OpenDebate</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_debates} /></b> bouts · <b className="text-primary"><NumberTicker value={stats.judged} /></b> judged</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      {/* card-tabs of bouts */}
      <div className="mx-auto max-w-5xl px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {debates.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`max-w-[220px] truncate rounded-full border px-3 py-1.5 text-xs transition ${sel === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>#{x.id} · {x.motion}</button>
          ))}
          <button onClick={() => setShowNew(!showNew)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:text-primary"><Plus className="h-3.5 w-3.5" /> new bout</button>
        </div>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="Motion (you argue FOR)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Your opening argument" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" onClick={openDebate} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Open</Button></div>
            </div>
          </motion.div>
        )}
      </div>

      {!d ? (
        <div className="mx-auto max-w-5xl px-5 py-24 text-center text-sm text-muted">No bouts yet — open the first.</div>
      ) : (
        <main className="mx-auto max-w-5xl px-5 py-6">
          <div className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">the motion</div>
          <h1 className="mx-auto mt-1 max-w-3xl text-center text-2xl font-black tracking-tight md:text-3xl">{d.motion}</h1>

          {/* corners + VS */}
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className={`rounded-2xl border-2 p-4 text-center ${winA ? 'border-primary bg-primary/10' : 'border-border bg-card/50'}`}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">PRO · for</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{short(d.party_a)}</div>
              <div className="mt-2 text-5xl font-black tabular-nums text-primary">{d.state === 'judged' ? d.score_a : '—'}</div>
              {winA && <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"><Crown className="h-4 w-4" /> winner</div>}
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-border bg-background text-sm font-black text-muted">VS</div>
              <div className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{d.state.replace('_', ' ')}</div>
              {d.state === 'debating' && <div className="text-[10px] text-primary">turn: {d.turn.toUpperCase()}</div>}
            </div>
            <div className={`rounded-2xl border-2 p-4 text-center ${winB ? 'border-accent bg-accent/10' : 'border-border bg-card/50'}`}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-accent">CON · against</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{d.party_b ? short(d.party_b) : 'open seat'}</div>
              <div className="mt-2 text-5xl font-black tabular-nums text-accent">{d.state === 'judged' ? d.score_b : '—'}</div>
              {winB && <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent"><Crown className="h-4 w-4" /> winner</div>}
            </div>
          </div>

          {/* tale of the tape */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1fr_64px_1fr] bg-card/80 text-center text-[10px] font-bold uppercase tracking-wider text-muted"><div className="py-2 text-primary">PRO</div><div className="py-2">round</div><div className="py-2 text-accent">CON</div></div>
            {rounds.length === 0 && <div className="p-6 text-center text-xs text-muted">No arguments yet.</div>}
            {rounds.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_1fr] items-stretch border-t border-border/60">
                <div className="bg-primary/[0.04] p-3 text-sm">{r.a || <span className="text-muted/40">—</span>}</div>
                <div className="grid place-items-center border-x border-border/60 font-mono text-xs text-muted">{i + 1}</div>
                <div className="bg-accent/[0.04] p-3 text-right text-sm">{r.b || <span className="text-muted/40">—</span>}</div>
              </div>
            ))}
          </div>

          {d.state === 'judged' ? (
            d.reasoning && <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted">“{d.reasoning}”</p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex w-full max-w-xl gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && speak(d)} placeholder={d.state === 'awaiting_b' ? 'Take the CON seat — your opening…' : `Argument for ${d.turn.toUpperCase()}…`} className="flex-1 rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
                <Button disabled={busy === d.id} onClick={() => speak(d)}>{busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : d.state === 'awaiting_b' ? <Mic className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
              </div>
              {d.state === 'debating' && d.transcript.length >= 2 && <button onClick={() => judge(d)} disabled={busy === d.id} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Gavel className="h-3.5 w-3.5" /> call the judge</button>}
            </div>
          )}
        </main>
      )}
      <footer className="mt-6 border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>OpenDebate · adversarial debates judged by consensus</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
