import { IAM_CONTROLS, PROBLEMS, COMPLIANCE_FRAMEWORKS, COMBINATIONS } from './data.js';

const controlById = Object.fromEntries(IAM_CONTROLS.map((c) => [c.id, c]));

export function computeResults(selectedIds) {
  const selected = new Set(selectedIds);

  // problemId -> controls that address it
  const solved = new Map();
  for (const c of IAM_CONTROLS) {
    if (!selected.has(c.id)) continue;
    for (const pid of c.problemIds) {
      if (!solved.has(pid)) solved.set(pid, new Set());
      solved.get(pid).add(c.id);
    }
  }

  // combos whose controls are all selected reinforce their problems
  const activeCombos = COMBINATIONS.filter((combo) => combo.controlIds.every((id) => selected.has(id)));
  const reinforced = new Set();
  for (const combo of activeCombos) {
    for (const pid of combo.additionalProblemIds) {
      if (!solved.has(pid)) solved.set(pid, new Set());
      combo.controlIds.forEach((id) => solved.get(pid).add(id));
      reinforced.add(pid);
    }
  }
  for (const [pid, sources] of solved) if (sources.size >= 2) reinforced.add(pid);

  const frameworks = COMPLIANCE_FRAMEWORKS.map((fw) => {
    const requiredHave = fw.requiredControlIds.filter((id) => selected.has(id));
    const complementaryHave = fw.complementaryControlIds.filter((id) => selected.has(id));
    const coveredProblems = fw.problemIds.filter((pid) => solved.has(pid));
    const coverage = fw.problemIds.length ? coveredProblems.length / fw.problemIds.length : 0;
    let status = 'none';
    if (requiredHave.length === fw.requiredControlIds.length) status = 'strong';
    else if (requiredHave.length > 0 || coveredProblems.length > 0) status = 'partial';
    return {
      ...fw,
      status,
      requiredHave,
      requiredMissing: fw.requiredControlIds.filter((id) => !selected.has(id)),
      complementaryHave,
      complementaryMissing: fw.complementaryControlIds.filter((id) => !selected.has(id)),
      coveredProblems,
      coverage,
    };
  });

  const rank = { strong: 0, partial: 1, none: 2 };
  frameworks.sort((a, b) => rank[a.status] - rank[b.status] || b.coverage - a.coverage);

  return { selected, solved, reinforced, activeCombos, frameworks };
}

export function controlName(id) {
  return controlById[id]?.abbreviation ?? id;
}

export function controlColor(id) {
  return controlById[id]?.color ?? '#fff';
}

export function problemList(solved, reinforced) {
  const sev = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...solved.keys()]
    .map((pid) => ({ ...PROBLEMS[pid], sources: [...solved.get(pid)], reinforced: reinforced.has(pid) }))
    .sort((a, b) => sev[a.severity] - sev[b.severity] || a.name.localeCompare(b.name));
}

// Builds the trace for a clicked node: which nodes stay lit and which edges are drawn.
export function computeFocus(focus, stage, results) {
  const { solved, frameworks } = results;
  const set = new Set([`${focus.kind}:${focus.id}`]);
  const cp = [];
  const pf = [];

  const addFrameworks = (problemIds) => {
    if (stage < 3) return;
    for (const f of frameworks) {
      if (f.status === 'none') continue;
      for (const p of f.coveredProblems) {
        if (!problemIds.has(p)) continue;
        set.add(`compliance:${f.id}`);
        pf.push([p, f.id]);
      }
    }
  };

  if (focus.kind === 'control') {
    const pids = new Set(controlById[focus.id].problemIds);
    for (const p of pids) {
      set.add(`problem:${p}`);
      cp.push([focus.id, p]);
    }
    addFrameworks(pids);
  } else if (focus.kind === 'problem') {
    for (const c of solved.get(focus.id) ?? []) {
      set.add(`control:${c}`);
      cp.push([c, focus.id]);
    }
    addFrameworks(new Set([focus.id]));
  } else {
    const f = frameworks.find((x) => x.id === focus.id);
    for (const p of f.coveredProblems) {
      set.add(`problem:${p}`);
      pf.push([p, f.id]);
      for (const c of solved.get(p) ?? []) {
        set.add(`control:${c}`);
        cp.push([c, p]);
      }
    }
    f.requiredHave.forEach((c) => set.add(`control:${c}`));
  }
  return { set, cp, pf };
}
