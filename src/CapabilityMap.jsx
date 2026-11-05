import { useMemo, useState } from 'react';
import { IAM_CONTROLS } from './data.js';
import { OBLIGATIONS, ZONE } from './dpdpData.js';
import { CAPABILITIES, PROVISIONS, PROVISION_GROUPS } from './dpdpMap.js';

const ROW_H = 72;
const ROW_GAP = 10;
const GROUP_H = 28;
const PROV_H = 52;
const PROV_GAP = 8;
const MID_W = 150;

const ctrl = Object.fromEntries(IAM_CONTROLS.map((c) => [c.id, c]));
const obById = Object.fromEntries(OBLIGATIONS.map((o) => [o.id, o]));
const provById = Object.fromEntries(PROVISIONS.map((p) => [p.id, p]));
const COMPONENTS = IAM_CONTROLS.filter((c) => CAPABILITIES.some((k) => k.control === c.id));
const compIndex = Object.fromEntries(COMPONENTS.map((c, i) => [c.id, i]));

const PROV_LAYOUT = (() => {
  let y = 0;
  const pos = {};
  const heads = [];
  for (const g of PROVISION_GROUPS) {
    heads.push({ ...g, y });
    y += GROUP_H + 4;
    for (const p of PROVISIONS.filter((x) => x.group === g.id)) {
      pos[p.id] = y;
      y += PROV_H + PROV_GAP;
    }
    y += 6;
  }
  return { pos, heads, height: y - 6 - PROV_GAP };
})();

function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function Chip({ id, dashed }) {
  return <span className={`dp-gchip ${dashed ? 'dashed' : ''}`} style={{ '--c': ctrl[id].color }}>{ctrl[id].abbreviation}</span>;
}

export default function CapabilityMap({ customer, onOpen }) {
  const [sel, setSel] = useState(() => new Set(['IGA', 'PAM']));
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  const [reduce] = useState(reducedMotion);

  const active = pinned ?? hover;

  const caps = useMemo(
    () => CAPABILITIES.filter((k) => sel.has(k.control)).sort((a, b) => compIndex[a.control] - compIndex[b.control]),
    [sel],
  );

  const capY = (i) => i * (ROW_H + ROW_GAP);
  const leftH = caps.length ? caps.length * (ROW_H + ROW_GAP) - ROW_GAP : 0;
  const H = Math.max(leftH, PROV_LAYOUT.height, 220);

  const links = useMemo(
    () => caps.flatMap((k, i) => k.links.map(([pid, strength, how], j) => {
      const y1 = i * (ROW_H + ROW_GAP) + ROW_H / 2;
      const y2 = PROV_LAYOUT.pos[pid] + PROV_H / 2;
      return {
        key: `${k.id}|${pid}`, cap: k, pid, strength, how, delay: (i * 0.06 + j * 0.05).toFixed(2),
        d: `M0 ${y1} C ${MID_W * 0.55} ${y1}, ${MID_W * 0.45} ${y2}, ${MID_W} ${y2}`,
      };
    })),
    [caps],
  );

  const touched = useMemo(() => {
    const t = {};
    for (const l of links) {
      t[l.pid] ??= { primary: 0, supporting: 0 };
      t[l.pid][l.strength] += 1;
    }
    return t;
  }, [links]);

  const touchedCount = Object.keys(touched).length;
  const primaryCount = Object.values(touched).filter((t) => t.primary > 0).length;
  const untouched = PROVISIONS.filter((p) => !touched[p.id]);

  const linkOn = (l) => !active || (active.type === 'cap' ? l.cap.id === active.id : l.pid === active.id);
  const capRelated = (k) => !active || (active.type === 'cap' ? k.id === active.id : k.links.some((x) => x[0] === active.id));
  const activeCap = active?.type === 'cap' ? CAPABILITIES.find((k) => k.id === active.id) : null;
  const provRelated = (p) => !active || (active.type === 'prov' ? p.id === active.id : activeCap.links.some((x) => x[0] === p.id));

  const toggleComp = (id) => setSel((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const pin = (type, id) => setPinned((p) => (p && p.type === type && p.id === id ? null : { type, id }));

  const matchCustomer = () => setSel(new Set(COMPONENTS.filter((c) => customer.has(c.id)).map((c) => c.id)));
  const customerHas = COMPONENTS.some((c) => customer.has(c.id));

  return (
    <section className="dp-wrap dp-section dp-map">
      <h3>Which part of the law does each IAM capability answer?</h3>
      <p className="dp-lead sm">
        An IAM component like IGA or PAM is too coarse to map to a law. Each one is split into the capabilities you actually buy or build, and each capability is linked to the specific rule or section it helps with.
      </p>

      <div className="dp-mapbar">
        <div className="dp-ctls">
          {COMPONENTS.map((c) => (
            <button
              key={c.id}
              className={`dp-ctl ${sel.has(c.id) ? 'on' : ''}`}
              style={{ '--c': c.color }}
              onClick={() => toggleComp(c.id)}
              aria-pressed={sel.has(c.id)}
              title={customer.has(c.id) ? 'The customer already runs this' : undefined}
            >
              {c.abbreviation}
              <em>{CAPABILITIES.filter((k) => k.control === c.id).length}</em>
              {customer.has(c.id) && <i className="own" aria-label="customer runs this" />}
            </button>
          ))}
        </div>
        <div className="dp-presets">
          <button className="dp-btn ghost sm" onClick={matchCustomer} disabled={!customerHas}>Match customer stack</button>
          <button className="dp-btn ghost sm" onClick={() => setSel(new Set(COMPONENTS.map((c) => c.id)))}>Show all</button>
          <button className="dp-btn ghost sm" onClick={() => { setSel(new Set()); setPinned(null); }}>Clear</button>
        </div>
      </div>

      <div className="dp-mapsum" aria-live="polite">
        <span><b>{caps.length}</b> capabilities</span>
        <span><b>{touchedCount}</b> of {PROVISIONS.length} provisions touched</span>
        <span><b>{primaryCount}</b> with a primary capability</span>
        <span className="legend"><i className="ln primary" />primary <i className="ln supporting" />supporting</span>
      </div>

      <div className="dp-graph" style={{ '--mw': `${MID_W}px`, '--h': `${H}px` }}>
        <div className="dp-gcol left" style={{ height: H }}>
          {caps.length === 0 && <p className="dp-empty">Pick an IAM component above to see what it breaks into.</p>}
          {caps.map((k, i) => (
            <button
              key={k.id}
              className={`dp-gcap ${capRelated(k) ? '' : 'dim'} ${active?.type === 'cap' && active.id === k.id ? 'act' : ''}`}
              style={{ top: capY(i), height: ROW_H, '--c': ctrl[k.control].color, animationDelay: `${i * 0.05}s` }}
              onMouseEnter={() => setHover({ type: 'cap', id: k.id })}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ type: 'cap', id: k.id })}
              onBlur={() => setHover(null)}
              onClick={() => pin('cap', k.id)}
              aria-pressed={pinned?.type === 'cap' && pinned.id === k.id}
            >
              <span className="comp">{ctrl[k.control].abbreviation}</span>
              <b>{k.name}</b>
              <small>{k.does}</small>
              <span className="tags">
                {k.links.map(([pid, strength]) => <em key={pid} className={strength}>{provById[pid].ref}</em>)}
              </span>
            </button>
          ))}
        </div>

        <svg className="dp-glinks" width={MID_W} height={H} viewBox={`0 0 ${MID_W} ${H}`} aria-hidden="true">
          {links.map((l) => (
            <g key={l.key} className={`lk ${linkOn(l) ? (active ? 'hot' : '') : 'dim'}`}>
              <path
                className={`dp-link ${l.strength}`}
                d={l.d}
                stroke={ctrl[l.cap.control].color}
                pathLength={l.strength === 'primary' ? 1 : undefined}
                style={{ animationDelay: `${l.delay}s` }}
              />
              {l.strength === 'primary' && !reduce && (
                <circle r="2.8" fill={ctrl[l.cap.control].color}>
                  <animateMotion dur={`${2.4 + (Number(l.delay) * 7) % 1.6}s`} begin={`${l.delay}s`} repeatCount="indefinite" path={l.d} />
                </circle>
              )}
            </g>
          ))}
        </svg>

        <div className="dp-gcol right" style={{ height: H }}>
          {PROV_LAYOUT.heads.map((g) => (
            <div key={g.id} className="dp-ghead" style={{ top: g.y, height: GROUP_H }}>{g.label}</div>
          ))}
          {PROVISIONS.map((p) => {
            const t = touched[p.id];
            const zone = obById[p.ob].zone;
            return (
              <button
                key={p.id}
                className={`dp-gprov z-${zone} ${t ? 'on' : ''} ${provRelated(p) ? '' : 'dim'} ${active?.type === 'prov' && active.id === p.id ? 'act' : ''}`}
                style={{ top: PROV_LAYOUT.pos[p.id], height: PROV_H }}
                onMouseEnter={() => setHover({ type: 'prov', id: p.id })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ type: 'prov', id: p.id })}
                onBlur={() => setHover(null)}
                onClick={() => pin('prov', p.id)}
                aria-pressed={pinned?.type === 'prov' && pinned.id === p.id}
              >
                <span className="ref">{p.ref}</span>
                <b>{p.label}</b>
                <span className="cnt">
                  {t ? (t.primary ? `${t.primary} primary${t.supporting ? ` + ${t.supporting}` : ''}` : `${t.supporting} supporting`) : 'not touched'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Panel active={active} pinned={!!pinned} sel={sel} untouched={untouched} onPin={pin} onOpen={onOpen} />
    </section>
  );
}

function Panel({ active, pinned, sel, untouched, onPin, onOpen }) {
  if (!active) {
    return (
      <div className="dp-gpanel">
        <p className="dp-lead sm">
          Hover or click a capability to see how it helps and where it lands, or click a provision to see every capability that answers it.
        </p>
        {untouched.length > 0 && (
          <p className="dp-foot">
            Not touched by this selection: {untouched.map((p) => p.ref).join(' · ')}.
          </p>
        )}
      </div>
    );
  }

  if (active.type === 'cap') {
    const k = CAPABILITIES.find((x) => x.id === active.id);
    return (
      <div className="dp-gpanel" key={`c-${k.id}`} style={{ '--c': ctrl[k.control].color }}>
        <div className="top"><Chip id={k.control} /><b>{k.name}</b>{pinned && <span className="pinned">pinned</span>}</div>
        <p className="what">{k.does}</p>
        <ul>
          {[...k.links].sort((a, b) => (a[1] === 'primary' ? 0 : 1) - (b[1] === 'primary' ? 0 : 1)).map(([pid, strength, how]) => (
            <li key={pid} className={strength}>
              <span className="pill">{strength}</span>
              <div>
                <button className="lnk" onClick={() => onPin('prov', pid)}>{provById[pid].ref}</button>
                <span className="lab"> {provById[pid].label}</span>
                <small>{how}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const p = provById[active.id];
  const ob = obById[p.ob];
  const answering = CAPABILITIES
    .map((k) => ({ k, link: k.links.find((l) => l[0] === p.id) }))
    .filter((x) => x.link)
    .sort((a, b) => (a.link[1] === 'primary' ? 0 : 1) - (b.link[1] === 'primary' ? 0 : 1));
  const hasPrimary = answering.some((x) => x.link[1] === 'primary');

  return (
    <div className="dp-gpanel" key={`p-${p.id}`} style={{ '--c': ZONE[ob.zone].color }}>
      <div className="top">
        <b>{p.ref}</b><span className="lab">{p.label}</span>
        <span className="zone" style={{ color: ZONE[ob.zone].color }}>{ZONE[ob.zone].label}</span>
        {pinned && <span className="pinned">pinned</span>}
      </div>
      {!hasPrimary && <p className="what">No IAM capability meets this on its own; IAM only supports it. See the duty for who owns the rest.</p>}
      <ul>
        {answering.map(({ k, link }) => (
          <li key={k.id} className={link[1]}>
            <span className="pill">{link[1]}</span>
            <div>
              <Chip id={k.control} dashed={!sel.has(k.control)} />
              <button className="lnk" onClick={() => onPin('cap', k.id)}>{k.name}</button>
              <small>{link[2]}{sel.has(k.control) ? '' : ' (component not selected)'}</small>
            </div>
          </li>
        ))}
      </ul>
      <button className="dp-btn ghost sm" onClick={() => onOpen(p.ob)}>Open duty: {ob.title}</button>
    </div>
  );
}
