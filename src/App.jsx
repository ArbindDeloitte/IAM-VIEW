import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IAMScene } from './scene.js';
import { computeResults, controlColor, controlName, problemList } from './logic.js';
import { IAM_CONTROLS, PROBLEMS, PROBLEM_CATEGORIES, SEVERITY_COLORS } from './data.js';

const GROUPS = [
  { id: 'core', label: 'Core functional areas' },
  { id: 'newer', label: 'Newer & fast-growing' },
  { id: 'supporting', label: 'Supporting capabilities' },
];

const STEPS = ['Select controls', 'Problems solved', 'Compliance supported'];

const STATUS_LABEL = { strong: 'Core controls in place', partial: 'Partially supported' };

export default function App() {
  const [stage, setStage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [tip, setTip] = useState(null);
  const [focus, setFocus] = useState(null);
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const panelRef = useRef(null);
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const goTo = useCallback((s) => {
    setFocus(null);
    setStage(s);
  }, []);

  const onNode = useCallback(
    (node) => {
      setFocus(node);
      if (node?.kind === 'control' && stageRef.current === 1) toggle(node.id);
    },
    [toggle],
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setFocus(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const scene = new IAMScene(canvasRef.current, {
      onHover: (info, x, y) => setTip(info ? { ...info, x, y } : null),
      onSelectNode: onNode,
    });
    sceneRef.current = scene;
    const measure = () => {
      const w = window.innerWidth;
      if (w >= 900) scene.setLayout({ panelPx: panelRef.current.offsetWidth + 48, panelBottomPx: 0 });
      else scene.setLayout({ panelPx: 0, panelBottomPx: canvasRef.current.clientHeight * 0.5 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [onNode]);

  useEffect(() => {
    sceneRef.current?.setState({ stage, selected, focus });
  }, [stage, selected, focus]);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    sceneRef.current?.setLocked(locked);
  }, [locked]);

  const results = useMemo(() => computeResults(selected), [selected]);
  const problems = useMemo(() => problemList(results.solved, results.reinforced), [results]);
  const frameworks = results.frameworks.filter((f) => f.status !== 'none');

  return (
    <div className="app">
      <div className="canvas" ref={canvasRef} />

      <div className="overlay">
        <aside className="panel" ref={panelRef}>
          <header className="head">
            <h1>IAM Navigator</h1>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s} className={stage === i + 1 ? 'on' : stage > i + 1 ? 'done' : ''}>
                  <span>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </header>

          <div className="body" key={stage}>
            {stage === 1 && <Stage1 selected={selected} toggle={toggle} />}
            {stage === 2 && <Stage2 results={results} problems={problems} />}
            {stage === 3 && <Stage3 frameworks={frameworks} />}
          </div>

          <footer className="foot">
            {stage > 1 ? (
              <button className="btn ghost" onClick={() => goTo(stage - 1)}>Back</button>
            ) : (
              <button className="btn ghost" disabled={!selected.size} onClick={() => setSelected(new Set())}>Clear</button>
            )}
            <span className="count">{selected.size} selected</span>
            {stage < 3 ? (
              <button className="btn" disabled={!selected.size} onClick={() => goTo(stage + 1)}>
                {stage === 1 ? 'Show problems solved' : 'Show compliance'}
              </button>
            ) : (
              <button className="btn" onClick={() => { goTo(1); setSelected(new Set()); }}>Start over</button>
            )}
          </footer>
        </aside>

        <div className="toolbar">
          <button className="motion" onClick={() => sceneRef.current?.resetView()}>Reset view</button>
          <button className="motion" onClick={() => setLocked((l) => !l)} aria-pressed={locked}>
            {locked ? 'Unlock position' : 'Fix position'}
          </button>
          <button className="motion" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? 'Resume motion' : 'Pause motion'}
          </button>
        </div>

        {focus && <Detail focus={focus} stage={stage} results={results} onClose={() => setFocus(null)} />}

        <p className="hint">Drag to rotate, scroll to zoom, right-drag or Shift+drag to pan. Fix position locks the view. Click a node to see what it solves or trace it back to your controls (Esc clears). In step 1, clicking a control also toggles it.</p>
      </div>

      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 300), top: tip.y + 16, borderColor: tip.color }}>
          <strong style={{ color: tip.color }}>{tip.title}</strong>
          {tip.sub && <em>{tip.sub}</em>}
          <p>{tip.body}</p>
        </div>
      )}
    </div>
  );
}

function Stage1({ selected, toggle }) {
  return (
    <>
      <p className="lead">Choose the IAM controls you have or plan to deploy. Combine as many as you like.</p>
      {GROUPS.map((g) => (
        <section key={g.id}>
          <h3>{g.label}</h3>
          <div className="grid">
            {IAM_CONTROLS.filter((c) => c.category === g.id).map((c) => (
              <button
                key={c.id}
                className={`card ${selected.has(c.id) ? 'sel' : ''}`}
                style={{ '--c': c.color }}
                onClick={() => toggle(c.id)}
                aria-pressed={selected.has(c.id)}
              >
                <b>{c.abbreviation}</b>
                <span>{c.name}</span>
                <small>{c.description}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Stage2({ results, problems }) {
  const byCat = Object.keys(PROBLEM_CATEGORIES)
    .map((cat) => ({ cat, items: problems.filter((p) => p.cat === cat) }))
    .filter((g) => g.items.length);

  return (
    <>
      <p className="lead">
        {problems.length} organizational problems addressed. Glowing nodes in the 3D view are the ones reinforced by more than one control.
      </p>

      {results.activeCombos.length > 0 && (
        <section>
          <h3>Combination effects</h3>
          {results.activeCombos.map((c) => (
            <div className="combo" key={c.id}>
              <div className="chips">{c.controlIds.map((id) => <Chip key={id} id={id} />)}</div>
              <b>{c.name}</b>
              <small>{c.description}</small>
            </div>
          ))}
        </section>
      )}

      {byCat.map(({ cat, items }) => (
        <section key={cat}>
          <h3 style={{ color: PROBLEM_CATEGORIES[cat].color }}>{PROBLEM_CATEGORIES[cat].label}</h3>
          {items.map((p) => (
            <div className={`prob ${p.reinforced ? 'rf' : ''}`} key={p.id}>
              <div className="row">
                <b>{p.name}</b>
                <span className="sev" style={{ color: SEVERITY_COLORS[p.severity] }}>{p.severity}</span>
              </div>
              <small>{p.desc}</small>
              <div className="chips">
                {p.sources.map((id) => <Chip key={id} id={id} />)}
                {p.reinforced && <span className="rfTag">reinforced</span>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function Stage3({ frameworks }) {
  if (!frameworks.length) return <p className="lead">The selected controls don't map to any framework in this model.</p>;
  return (
    <>
      <p className="lead">
        Frameworks these controls help you satisfy. Technology supports compliance but does not guarantee it; policy, process and evidence are still required.
      </p>
      {frameworks.map((f) => (
        <article className={`fw ${f.status}`} key={f.id} style={{ '--c': f.color }}>
          <div className="row">
            <b>{f.name}</b>
            <span className="badge">{STATUS_LABEL[f.status]}</span>
          </div>
          <small>{f.fullName} · {f.region}</small>
          <div className="bar"><i style={{ width: `${Math.round(f.coverage * 100)}%` }} /></div>
          <small>{f.coveredProblems.length} of {f.problemIds.length} related problems addressed</small>

          <ul>{f.keyRequirements.map((r) => <li key={r}>{r}</li>)}</ul>

          <div className="chips">
            {f.requiredHave.map((id) => <Chip key={id} id={id} />)}
            {f.requiredMissing.map((id) => <Chip key={id} id={id} missing />)}
          </div>
          {f.requiredMissing.length > 0 && <small className="miss">Missing core control: {f.requiredMissing.map(controlName).join(', ')}</small>}
          {f.note && <small className="note">{f.note}</small>}
        </article>
      ))}
      <small className="note">Regulatory details verified against public sources on 2 Nov 2026. These change often, so confirm with counsel before relying on them.</small>
    </>
  );
}

function Chip({ id, missing }) {
  return (
    <span className={`chip ${missing ? 'miss' : ''}`} style={{ '--c': controlColor(id) }}>
      {controlName(id)}
    </span>
  );
}

function Detail({ focus, stage, results, onClose }) {
  const { solved, selected, reinforced, frameworks } = results;
  let color = '#818cf8';
  let title = '';
  let sub = '';
  let body = null;

  if (focus.kind === 'control') {
    const c = IAM_CONTROLS.find((x) => x.id === focus.id);
    color = c.color;
    title = c.name;
    sub = selected.has(c.id) ? 'Selected control' : 'Not selected';
    const supports = frameworks.filter((f) => f.requiredControlIds.includes(c.id) || f.complementaryControlIds.includes(c.id));
    body = (
      <>
        <p className="dd">{c.description}</p>
        <h4>What it solves</h4>
        {c.problemIds.map((pid) => (
          <div className="li" key={pid}>
            <b>{PROBLEMS[pid].name}</b>
            <span className="sev" style={{ color: SEVERITY_COLORS[PROBLEMS[pid].severity] }}>{PROBLEMS[pid].severity}</span>
            <small>{PROBLEMS[pid].desc}{stage >= 2 && reinforced.has(pid) ? ' Reinforced by a combination of your controls.' : ''}</small>
          </div>
        ))}
        <h4>Compliance it helps support</h4>
        <div className="chips">
          {supports.map((f) => (
            <span key={f.id} className="chip" style={{ '--c': f.color }}>
              {f.name}{f.requiredControlIds.includes(c.id) ? ' · core' : ''}
            </span>
          ))}
        </div>
      </>
    );
  } else if (focus.kind === 'problem') {
    const p = PROBLEMS[focus.id];
    color = PROBLEM_CATEGORIES[p.cat].color;
    title = p.name;
    sub = `${PROBLEM_CATEGORIES[p.cat].label} · ${p.severity}`;
    const have = [...(solved.get(p.id) ?? [])].map((id) => IAM_CONTROLS.find((c) => c.id === id));
    const others = IAM_CONTROLS.filter((c) => c.problemIds.includes(p.id) && !selected.has(c.id));
    const relevant = frameworks.filter((f) => f.problemIds.includes(p.id));
    body = (
      <>
        <p className="dd">{p.desc}</p>
        <h4>Tied back to your controls</h4>
        {have.length ? have.map((c) => (
          <div className="li" key={c.id}>
            <Chip id={c.id} />
            <small>{c.name}: {c.description}</small>
          </div>
        )) : <small>No selected control addresses this.</small>}
        {others.length > 0 && (
          <>
            <h4>Also addressed by (not selected)</h4>
            <div className="chips">{others.map((c) => <Chip key={c.id} id={c.id} missing />)}</div>
          </>
        )}
        <h4>Frameworks where this matters</h4>
        <div className="chips">
          {relevant.map((f) => <span key={f.id} className="chip" style={{ '--c': f.color }}>{f.name}</span>)}
        </div>
      </>
    );
  } else {
    const f = frameworks.find((x) => x.id === focus.id);
    color = f.color;
    title = f.name;
    sub = `${f.region} · ${STATUS_LABEL[f.status] ?? 'Not supported yet'}`;
    body = (
      <>
        <p className="dd">{f.fullName}</p>
        <h4>Controls it relies on</h4>
        <div className="chips">
          {f.requiredHave.map((id) => <Chip key={id} id={id} />)}
          {f.requiredMissing.map((id) => <Chip key={id} id={id} missing />)}
        </div>
        <small>Core controls. Dashed means not selected.</small>
        <div className="chips">
          {f.complementaryHave.map((id) => <Chip key={id} id={id} />)}
          {f.complementaryMissing.map((id) => <Chip key={id} id={id} missing />)}
        </div>
        <small>Supporting controls.</small>
        <h4>Problems it covers and which controls solve them</h4>
        {f.problemIds.map((pid) => {
          const src = [...(solved.get(pid) ?? [])];
          return (
            <div className="li" key={pid}>
              <b>{PROBLEMS[pid].name}</b>
              <div className="chips">
                {src.length ? src.map((id) => <Chip key={id} id={id} />) : <small className="miss">not covered by your selection</small>}
              </div>
            </div>
          );
        })}
        <h4>Key requirements</h4>
        <ul className="req">{f.keyRequirements.map((r) => <li key={r}>{r}</li>)}</ul>
        {f.note && <small className="note">{f.note}</small>}
      </>
    );
  }

  return (
    <aside className="detail" style={{ borderColor: color }}>
      <button className="x" onClick={onClose} aria-label="Close details">×</button>
      <strong style={{ color }}>{title}</strong>
      <em>{sub}</em>
      {body}
    </aside>
  );
}
