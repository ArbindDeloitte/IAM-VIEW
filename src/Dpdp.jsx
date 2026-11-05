import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './dpdp.css';
import CapabilityMap from './CapabilityMap.jsx';
import { IAM_CONTROLS } from './data.js';
import {
  COMPRESSION_NOTE, DATE_NOTE, FLOWS, OBLIGATIONS, PENALTIES, PENALTY_FOOTNOTE, PHASES, PRESETS, ZONE, ZONE_ORDER,
} from './dpdpData.js';

const controlById = Object.fromEntries(IAM_CONTROLS.map((c) => [c.id, c]));
const DAY = 86400000;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function useNow() {
  const [now] = useState(() => Date.now());
  return now;
}

function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(0);
  const [reduce] = useState(reducedMotion);
  const current = useRef(0);
  useEffect(() => {
    if (reduce) return undefined;
    const from = current.current;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return reduce ? target : Math.round(value);
}

function useInView(ref) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function readiness(o, selected) {
  if (!o.controls.length) return null;
  return o.controls.filter((c) => selected.has(c)).length / o.controls.length;
}

// ── icons ────────────────────────────────────────────────────────────────────

function ZoneIcon({ zone, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (zone === 'direct') return <svg {...common}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>;
  if (zone === 'partial') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>;
}

function Ring({ value, color }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg className="dp-ring" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r={r} className="bg" />
      <circle cx="13" cy="13" r={r} className="fg" transform="rotate(-90 13 13)" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - value) }} />
    </svg>
  );
}

// ── hero ─────────────────────────────────────────────────────────────────────

function Stat({ zone, value, total }) {
  const n = useCountUp(value);
  const z = ZONE[zone];
  return (
    <div className="dp-stat" style={{ '--z': z.color }}>
      <ZoneIcon zone={zone} size={22} />
      <b>{n}</b>
      <span>{z.label}</span>
      <small>{Math.round((value / total) * 100)}% of the {total} duties mapped</small>
    </div>
  );
}

function Hero() {
  const counts = useMemo(() => ZONE_ORDER.map((z) => OBLIGATIONS.filter((o) => o.zone === z).length), []);
  return (
    <header className="dp-hero dp-wrap">
      <div className="dp-hero-text">
        <p className="dp-eyebrow">India · Digital Personal Data Protection Act, 2023</p>
        <h2>Where IAM protects, where it assists, and where it can't</h2>
        <p className="dp-lead">
          Identity controls answer some DPDP duties outright, help with others, and have nothing to say about the rest.
          Pick the controls a customer has and watch the picture change. This is an indicative mapping, not legal advice.
        </p>
        <div className="dp-stats">
          {ZONE_ORDER.map((z, i) => <Stat key={z} zone={z} value={counts[i]} total={OBLIGATIONS.length} />)}
        </div>
      </div>
      <svg className="dp-orbit" viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r="46" className="ring" />
        <circle cx="120" cy="120" r="76" className="ring" />
        <circle cx="120" cy="120" r="104" className="ring" />
        <g className="spin s1"><circle cx="120" cy="74" r="7" fill={ZONE.direct.color} /></g>
        <g className="spin s2"><circle cx="120" cy="44" r="7" fill={ZONE.partial.color} /></g>
        <g className="spin s3"><circle cx="120" cy="16" r="7" fill={ZONE.none.color} /></g>
        <path className="shield" d="M120 92l28 12v20c0 20-12 32-28 40-16-8-28-20-28-40v-20l28-12z" />
        <path className="tick" d="M108 128l9 9 16-18" />
      </svg>
    </header>
  );
}

// ── timeline ─────────────────────────────────────────────────────────────────

function Timeline() {
  const ref = useRef(null);
  const seen = useInView(ref);
  const now = useNow();
  const start = new Date(`${PHASES[0].date}T00:00:00Z`).getTime();
  const end = new Date(`${PHASES[PHASES.length - 1].date}T00:00:00Z`).getTime();
  const pos = (t) => Math.max(0, Math.min(1, (t - start) / (end - start)));
  const todayPct = pos(now) * 100;

  return (
    <section className="dp-wrap dp-section" ref={ref}>
      <h3>When the duties switch on</h3>
      <div className="dp-timeline">
        <div className="dp-track">
          <i className="fill" style={{ width: seen ? `${todayPct}%` : '0%' }} />
          {PHASES.map((p) => {
            const t = new Date(`${p.date}T00:00:00Z`).getTime();
            return <span key={p.id} className={`node ${t <= now ? 'on' : ''}`} style={{ left: `${pos(t) * 100}%` }} />;
          })}
          <span className="today" style={{ left: seen ? `${todayPct}%` : '0%' }}><em>Today</em></span>
        </div>
        <div className="dp-phases">
          {PHASES.map((p) => {
            const t = new Date(`${p.date}T00:00:00Z`).getTime();
            const days = Math.ceil((t - now) / DAY);
            return (
              <article key={p.id} className={`dp-phase ${days <= 0 ? 'live' : ''}`}>
                <small>{formatDate(p.date)}</small>
                <b>{p.title}</b>
                <span className="when">{days <= 0 ? 'In force' : `in ${days} day${days === 1 ? '' : 's'}`}</span>
                <ul>{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </article>
            );
          })}
        </div>
      </div>
      <p className="dp-foot">{DATE_NOTE}</p>
      <p className="dp-warn"><b>Date may move.</b> {COMPRESSION_NOTE}</p>
    </section>
  );
}

// ── sort arena ───────────────────────────────────────────────────────────────

const CHIP_H = 58;
const STRIDE = 68;
const HEAD_H = 64;
const PILE_H = 520;

function computeLayout(W) {
  const wide = W >= 860;
  const pad = 10;
  const gap = 12;
  const lanes = ZONE_ORDER.map((z) => OBLIGATIONS.filter((o) => o.zone === z));
  const pos = {};
  const boxes = [];
  let height;
  if (wide) {
    const laneW = (W - pad * 2 - gap * 2) / 3;
    const rows = Math.max(...lanes.map((l) => l.length));
    lanes.forEach((list, i) => {
      const x = pad + i * (laneW + gap);
      boxes.push({ zone: ZONE_ORDER[i], x, y: 0, w: laneW, h: HEAD_H + rows * STRIDE + 12 });
      list.forEach((o, r) => { pos[o.id] = { x: x + 10, y: HEAD_H + r * STRIDE, w: laneW - 20 }; });
    });
    height = HEAD_H + rows * STRIDE + 12;
  } else {
    const laneW = W - pad * 2;
    let y = 0;
    lanes.forEach((list, i) => {
      const h = HEAD_H + list.length * STRIDE + 12;
      boxes.push({ zone: ZONE_ORDER[i], x: pad, y, w: laneW, h });
      list.forEach((o, r) => { pos[o.id] = { x: pad + 10, y: y + HEAD_H + r * STRIDE, w: laneW - 20 }; });
      y += h + gap;
    });
    height = y - gap;
  }
  return { pos, boxes, height };
}

function computePile(W) {
  const cx = W / 2;
  const cy = PILE_H / 2;
  const w = Math.min(300, W - 40);
  const spread = Math.min(1, W / 900 + 0.35);
  const out = {};
  OBLIGATIONS.forEach((o, i) => {
    const a = i * 2.399963;
    const r = 24 * Math.sqrt(i + 1) * spread;
    out[o.id] = { x: cx - w / 2 + Math.cos(a) * r * 2.2, y: cy - CHIP_H / 2 + Math.sin(a) * r * 1.15, w, rot: ((i * 37) % 17) - 8 };
  });
  return out;
}

function Arena({ selected, openId, onOpen }) {
  const arenaRef = useRef(null);
  const timer = useRef(null);
  const [W, setW] = useState(980);
  const [phase, setPhase] = useState('pile');

  useLayoutEffect(() => {
    const el = arenaRef.current;
    const measure = () => setW(el.clientWidth || 980);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const layout = useMemo(() => computeLayout(W), [W]);
  const pile = useMemo(() => computePile(W), [W]);

  const run = () => {
    clearTimeout(timer.current);
    if (reducedMotion()) {
      setPhase('sorted');
      return;
    }
    setPhase('scan');
    timer.current = setTimeout(() => setPhase('sorted'), 1500);
  };
  const reset = () => {
    clearTimeout(timer.current);
    setPhase('pile');
  };

  const sorted = phase === 'sorted';
  const zoned = phase !== 'pile';
  const height = sorted ? layout.height : PILE_H;

  return (
    <div className="dp-arena-wrap">
      <div className="dp-arena-bar">
        <button className="dp-btn" onClick={run} disabled={phase === 'scan'}>
          {phase === 'pile' ? 'Run IAM assessment' : phase === 'scan' ? 'Scanning…' : 'Replay'}
        </button>
        <button className="dp-btn ghost" onClick={reset} disabled={phase === 'pile'}>Shuffle back</button>
        <span className="dp-hintline">Click any duty for detail. Dashed rings fill as you add controls.</span>
      </div>

      <div className={`dp-arena ${phase}`} ref={arenaRef} style={{ height }}>
        {layout.boxes.map((b) => (
          <div key={b.zone} className={`dp-lane z-${b.zone}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
            <ZoneIcon zone={b.zone} size={22} />
            <b>{ZONE[b.zone].label}</b>
            <small>{ZONE[b.zone].blurb}</small>
          </div>
        ))}
        {phase === 'scan' && <div className="dp-beam" />}

        {OBLIGATIONS.map((o, i) => {
          const p = sorted ? layout.pos[o.id] : pile[o.id];
          const ready = readiness(o, selected);
          const delay = phase === 'scan' ? i * 55 : phase === 'sorted' ? i * 35 : i * 15;
          return (
            <button
              key={o.id}
              className={`dp-chip z-${o.zone} ${zoned ? 'zoned' : ''} ${openId === o.id ? 'open' : ''}`}
              style={{
                width: p.w,
                height: CHIP_H,
                transform: `translate(${p.x}px, ${p.y}px) rotate(${sorted ? 0 : p.rot}deg)`,
                transitionDelay: `${delay}ms`,
                zIndex: openId === o.id ? 50 : i + 1,
              }}
              onClick={() => onOpen(o.id)}
              aria-label={`${o.title}: ${ZONE[o.zone].label}`}
            >
              <span className="main"><b>{o.title}</b><small>{o.ref}</small></span>
              {zoned && <span className="zi"><ZoneIcon zone={o.zone} /></span>}
              {sorted && ready !== null && (
                <span className="rd">
                  <Ring value={ready} color={ZONE[o.zone].color} />
                  <em>{Math.round(ready * 100)}%</em>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── control picker + readiness ───────────────────────────────────────────────

function Picker({ selected, setSelected }) {
  const used = useMemo(() => IAM_CONTROLS.filter((c) => OBLIGATIONS.some((o) => o.controls.includes(c.id))), []);
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const avg = (zone) => {
    const list = OBLIGATIONS.filter((o) => o.zone === zone);
    return list.reduce((s, o) => s + (readiness(o, selected) ?? 0), 0) / list.length;
  };
  const rows = [
    { zone: 'direct', value: avg('direct') },
    { zone: 'partial', value: avg('partial') },
  ];
  const noneCount = OBLIGATIONS.filter((o) => o.zone === 'none').length;

  return (
    <section className="dp-wrap dp-section">
      <h3>What the customer already runs</h3>
      <div className="dp-picker">
        <div className="dp-presets">
          {PRESETS.map((p) => (
            <button key={p.id} className="dp-btn ghost sm" onClick={() => setSelected(new Set(p.controls))}>{p.label}</button>
          ))}
          <button className="dp-btn ghost sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
        <div className="dp-ctls">
          {used.map((c) => (
            <button key={c.id} className={`dp-ctl ${selected.has(c.id) ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => toggle(c.id)} aria-pressed={selected.has(c.id)}>
              {c.abbreviation}
            </button>
          ))}
        </div>
        <div className="dp-meters">
          {rows.map((r) => (
            <div key={r.zone} className="dp-meter" style={{ '--z': ZONE[r.zone].color }}>
              <span>{ZONE[r.zone].label}</span>
              <div className="bar"><i style={{ width: `${Math.round(r.value * 100)}%` }} /></div>
              <b>{Math.round(r.value * 100)}%</b>
            </div>
          ))}
          <div className="dp-meter capped" style={{ '--z': ZONE.none.color }}>
            <span>{ZONE.none.label}</span>
            <div className="bar"><i style={{ width: '0%' }} /></div>
            <b>0%</b>
            <small>{noneCount} duties stay at 0% however much IAM you buy.</small>
          </div>
        </div>
        <p className="dp-foot">Readiness is the share of each duty's relevant IAM controls you have, averaged per lane. It is a conversation aid, not an assessment.</p>
      </div>
    </section>
  );
}

// ── flows ────────────────────────────────────────────────────────────────────

function FlowDemo() {
  const [fid, setFid] = useState(FLOWS[0].id);
  const [idx, setIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const flow = FLOWS.find((f) => f.id === fid);
  const n = flow.steps.length;
  const shown = Math.min(idx, n - 1);
  const playing = running && idx < n - 1;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setIdx((i) => i + 1), 1200);
    return () => clearInterval(id);
  }, [playing]);

  const choose = (id) => {
    setFid(id);
    setIdx(-1);
    setRunning(false);
  };
  const play = () => {
    setIdx(0);
    setRunning(true);
  };

  const tally = ZONE_ORDER.map((z) => flow.steps.filter((s, i) => i <= shown && s.zone === z).length);
  const done = shown >= n - 1;

  return (
    <section className="dp-wrap dp-section">
      <h3>Follow a real scenario</h3>
      <div className="dp-tabs" role="tablist">
        {FLOWS.map((f) => (
          <button key={f.id} role="tab" aria-selected={f.id === fid} className={`dp-tab ${f.id === fid ? 'on' : ''}`} onClick={() => choose(f.id)}>{f.title}</button>
        ))}
        <button className="dp-btn" onClick={play} disabled={playing}>{playing ? 'Playing…' : done ? 'Replay' : 'Play scenario'}</button>
      </div>
      <p className="dp-lead sm">{flow.blurb}</p>

      <ol className="dp-steps" style={{ '--n': n }}>
        {flow.steps.map((s, i) => {
          const reached = i <= shown;
          return (
            <li key={s.label} className={`dp-step z-${s.zone} ${reached ? 'reached' : ''} ${i === shown ? 'active' : ''}`}>
              <button onClick={() => { setRunning(false); setIdx(i); }}>
                <span className="num">{i + 1}</span>
                <b>{s.label}</b>
                <span className="badge"><ZoneIcon zone={s.zone} size={14} />{ZONE[s.zone].short}</span>
                <p>{s.note}</p>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={`dp-tally ${done ? 'show' : ''}`}>
        {ZONE_ORDER.map((z, i) => (
          <span key={z} style={{ '--z': ZONE[z].color }}><b>{tally[i]}</b> {ZONE[z].short.toLowerCase()}</span>
        ))}
        <small>of {n} steps. IAM touches {tally[0] + tally[1]} of them, and owns {tally[0]} outright.</small>
      </div>
    </section>
  );
}

// ── penalties ────────────────────────────────────────────────────────────────

function Penalties() {
  const ref = useRef(null);
  const seen = useInView(ref);
  return (
    <section className="dp-wrap dp-section" ref={ref}>
      <h3>What is at stake, and how much of it IAM touches</h3>
      <div className="dp-pen">
        {PENALTIES.map((p, i) => (
          <div key={p.label} className="dp-pen-row" style={{ '--z': ZONE[p.zone].color }}>
            <div className="lab"><b>{p.label}</b><small>{p.ref} · {p.note}</small></div>
            <div className="bar"><i style={{ width: seen ? `${(p.amount / 250) * 100}%` : '0%', transitionDelay: `${i * 120}ms` }} /></div>
            <span className="amt">up to ₹{p.amount} crore</span>
            <span className="zt"><ZoneIcon zone={p.zone} size={14} />{ZONE[p.zone].short}</span>
          </div>
        ))}
      </div>
      <p className="dp-foot">{PENALTY_FOOTNOTE} Amounts are ceilings per instance; the Data Protection Board decides the actual figure after an inquiry.</p>
    </section>
  );
}

// ── detail drawer ────────────────────────────────────────────────────────────

function Drawer({ open, id, selected, onClose }) {
  const now = useNow();
  const o = OBLIGATIONS.find((x) => x.id === id);
  if (!o) return null;
  const z = ZONE[o.zone];
  const ready = readiness(o, selected);
  const phase = PHASES[o.phase - 1];
  const days = Math.ceil((new Date(`${phase.date}T00:00:00Z`).getTime() - now) / DAY);

  return (
    <aside className={`dp-drawer z-${o.zone} ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button className="x" onClick={onClose} aria-label="Close details">×</button>
      <span className="dp-badge"><ZoneIcon zone={o.zone} size={16} />{z.label}</span>
      <h4>{o.title}</h4>
      <div className="dp-meta">
        <span>{o.ref}</span>
        <span>{days <= 0 ? `In force since ${formatDate(phase.date)}` : `From ${formatDate(phase.date)} (${days} days)`}</span>
        <span>{o.penalty ? `Up to ₹${o.penalty} crore` : 'Penalty tier: check the Schedule'}</span>
      </div>

      <h5>What the law asks</h5>
      <p>{o.law}</p>
      <h5>{o.zone === 'none' ? 'IAM\'s role' : 'Where IAM helps'}</h5>
      <p className="good">{o.iam}</p>
      <h5>{o.zone === 'direct' ? 'What still sits outside IAM' : 'What IAM cannot do'}</h5>
      <p className="bad">{o.gap}</p>
      <p className="owner"><b>Who owns the rest:</b> {o.owner}</p>

      {o.controls.length > 0 && (
        <>
          <h5>IAM controls that matter here</h5>
          <div className="dp-ctls">
            {o.controls.map((c) => (
              <span key={c} className={`dp-ctl static ${selected.has(c) ? 'on' : ''}`} style={{ '--c': controlById[c].color }}>{controlById[c].abbreviation}</span>
            ))}
          </div>
          <div className="dp-meter" style={{ '--z': z.color }}>
            <span>Your coverage</span>
            <div className="bar"><i style={{ width: `${Math.round(ready * 100)}%` }} /></div>
            <b>{Math.round(ready * 100)}%</b>
          </div>
        </>
      )}
    </aside>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function Dpdp() {
  const [selected, setSelected] = useState(() => new Set());
  const [drawer, setDrawer] = useState({ id: null, open: false });

  const open = useCallback((id) => setDrawer((d) => (d.open && d.id === id ? { id, open: false } : { id, open: true })), []);
  const close = useCallback(() => setDrawer((d) => ({ ...d, open: false })), []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="dp-root">
      <div className="dp-scroll">
        <Hero />
        <Timeline />
        <Picker selected={selected} setSelected={setSelected} />
        <section className="dp-wrap dp-section">
          <h3>Sort the duties by what IAM can do about them</h3>
          <Arena selected={selected} openId={drawer.open ? drawer.id : null} onOpen={open} />
        </section>
        <CapabilityMap customer={selected} onOpen={open} />
        <FlowDemo />
        <Penalties />
      </div>
      <Drawer open={drawer.open} id={drawer.id} selected={selected} onClose={close} />
    </div>
  );
}
