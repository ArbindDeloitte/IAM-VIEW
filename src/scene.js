import * as THREE from 'three';
import { IAM_CONTROLS, PROBLEMS, PROBLEM_CATEGORIES, COMPLIANCE_FRAMEWORKS } from './data.js';
import { computeResults, computeFocus } from './logic.js';

const CAT_ORDER = Object.keys(PROBLEM_CATEGORIES);
const RING = { control: 3.4, problem: 6.3, compliance: 9.2 };
const TILT = { control: 0.45, problem: -0.3, compliance: 0.2 };
const LERP = 0.08;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function labelSprite(text, color, { w = 384, h = 80, font = 38, sw = 2.4, sh = 0.5 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.font = `600 ${font}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 8;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0 });
  const s = new THREE.Sprite(mat);
  s.scale.set(sw, sh, 1);
  s.userData.base = [sw, sh];
  s.renderOrder = 10;
  return s;
}

const PROBLEM_LABEL = { w: 640, h: 64, font: 30, sw: 4.6, sh: 0.46 };

function ringPosition(i, n, kind, phase = 0) {
  const a = (i / n) * Math.PI * 2 + phase;
  const r = RING[kind];
  const t = TILT[kind];
  return new THREE.Vector3(
    Math.cos(a) * r,
    Math.sin(a) * r * Math.cos(t) * 0.82,
    Math.sin(a) * r * Math.sin(t) + Math.sin(a * 3 + i) * 0.9,
  );
}

export class IAMScene {
  constructor(container, { onHover, onSelectNode }) {
    this.container = container;
    this.onHover = onHover;
    this.onSelectNode = onSelectNode;
    this.paused = false;
    this.motionTime = 0;
    this.focusSet = null;
    this.stage = 1;
    this.results = computeResults([]);
    this.layout = { panelPx: 0, narrow: false };
    this.layerAlpha = [0, 0, 0];
    this.layerTarget = [0, 0, 0];
    this.locked = false;
    this.drag = null;
    this.view = { rx: 0.05, ry: 0, zoom: 1, panX: 0, panY: 0 };
    this.basePos = new THREE.Vector3();
    this.baseScale = 1;
    this.worldPerPx = 0.02;
    this.pointer = new THREE.Vector2(10, 10);
    this.hovered = null;
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050816, 0.018);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 0, 21);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050816, 1);
    container.appendChild(this.renderer.domElement);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.glowTex = glowTexture();
    this.raycaster = new THREE.Raycaster();

    this.buildStars();
    this.buildRings();
    this.buildNodes();
    this.buildEdgeObjects();

    this.onResize = this.onResize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onContextMenu = (e) => e.preventDefault();
    window.addEventListener('resize', this.onResize);
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContextMenu);
    this.onResize();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ── construction ──────────────────────────────────────────────────────────

  buildStars() {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph) - 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x8890c8, size: 0.35, map: this.glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  buildRings() {
    this.rings = {};
    for (const kind of Object.keys(RING)) {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        const r = RING[kind];
        const t = TILT[kind];
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * Math.cos(t) * 0.82, Math.sin(a) * r * Math.sin(t)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x2a3366, transparent: true, opacity: 0.35 });
      const line = new THREE.Line(geo, mat);
      this.world.add(line);
      this.rings[kind] = line;
    }
  }

  makeNode({ kind, id, color, radius, pos, label, labelOpts, hitScale = 1 }) {
    const col = new THREE.Color(color);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 }),
    );
    mesh.position.copy(pos);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * hitScale, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    mesh.add(hit);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(radius * 7);
    mesh.add(glow);
    let sprite = null;
    if (label) {
      sprite = labelSprite(label, color, labelOpts);
      sprite.position.set(0, radius + 0.55, 0);
      mesh.add(sprite);
    }
    this.world.add(mesh);
    const node = {
      kind, id, mesh, hit, glow, sprite, pos, color: col, radius,
      scale: 0.01, opacity: 0, glowOpacity: 0, labelOpacity: 0,
      tScale: 1, tOpacity: 0, tGlow: 0, tLabel: 0, delayUntil: 0, pickable: false,
    };
    hit.userData.node = node;
    return node;
  }

  buildNodes() {
    this.controlNodes = IAM_CONTROLS.map((c, i) =>
      this.makeNode({ kind: 'control', id: c.id, color: c.color, radius: 0.34, pos: ringPosition(i, IAM_CONTROLS.length, 'control'), label: c.abbreviation, hitScale: 1.9 }),
    );

    const problems = Object.values(PROBLEMS).sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
    this.problemNodes = problems.map((p, i) =>
      this.makeNode({ kind: 'problem', id: p.id, color: PROBLEM_CATEGORIES[p.cat].color, radius: 0.15, pos: ringPosition(i, problems.length, 'problem', 0.1), label: p.name, labelOpts: PROBLEM_LABEL, hitScale: 2.2 }),
    );

    this.complianceNodes = COMPLIANCE_FRAMEWORKS.map((f, i) =>
      this.makeNode({ kind: 'compliance', id: f.id, color: f.color, radius: 0.28, pos: ringPosition(i, COMPLIANCE_FRAMEWORKS.length, 'compliance', 0.2), label: f.name, hitScale: 1.8 }),
    );

    this.allNodes = [...this.controlNodes, ...this.problemNodes, ...this.complianceNodes];
    this.nodeIndex = {
      control: Object.fromEntries(this.controlNodes.map((n) => [n.id, n])),
      problem: Object.fromEntries(this.problemNodes.map((n) => [n.id, n])),
      compliance: Object.fromEntries(this.complianceNodes.map((n) => [n.id, n])),
    };
    this.hitMeshes = this.allNodes.map((n) => n.hit);
  }

  buildEdgeObjects() {
    const mk = () => {
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const obj = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
      obj.frustumCulled = false;
      this.world.add(obj);
      return obj;
    };
    this.lineCP = mk();
    this.linePF = mk();
    this.edges = [];

    const maxPulses = 420;
    this.pulseGeo = new THREE.BufferGeometry();
    this.pulseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPulses * 3), 3));
    this.pulseGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxPulses * 3), 3));
    this.pulseGeo.setDrawRange(0, 0);
    this.pulses = new THREE.Points(
      this.pulseGeo,
      new THREE.PointsMaterial({ size: 0.34, map: this.glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.pulses.frustumCulled = false;
    this.world.add(this.pulses);
    this.pulseState = [];
    this.maxPulses = maxPulses;
  }

  // ── state ─────────────────────────────────────────────────────────────────

  setPaused(paused) {
    this.paused = paused;
  }

  setState({ stage, selected, focus }) {
    const stageChanged = stage !== this.stage;
    this.stage = stage;
    this.results = computeResults(selected);
    const now = this.clock ? this.clock.elapsedTime : 0;
    const { solved, reinforced, frameworks } = this.results;
    const fwStatus = Object.fromEntries(frameworks.map((f) => [f.id, f.status]));

    this.focus = focus ? computeFocus(focus, stage, this.results) : null;
    this.focusSet = this.focus?.set ?? null;

    // Step 1: keep every selected control's connections visible while one node is inspected.
    if (this.focus && stage === 1) {
      const have = new Set(this.focus.cp.map(([c, p]) => `${c}>${p}`));
      for (const [pid, sources] of solved) {
        for (const cid of sources) {
          if (!selected.has(cid)) continue;
          this.focusSet.add(`control:${cid}`);
          this.focusSet.add(`problem:${pid}`);
          if (!have.has(`${cid}>${pid}`)) this.focus.cp.push([cid, pid]);
        }
      }
    }

    this.layerTarget = [1, stage >= 2 || this.focus || selected.size > 0 ? 1 : 0, stage >= 3 ? 1 : 0];

    this.controlNodes.forEach((n, i) => {
      const sel = selected.has(n.id);
      if (stage === 1) {
        n.tScale = sel ? 1.7 : 1;
        n.tOpacity = sel ? 1 : 0.6;
        n.tGlow = sel ? 0.9 : 0.12;
        n.tLabel = sel ? 1 : 0.7;
      } else {
        n.tScale = sel ? 1.35 : 0.6;
        n.tOpacity = sel ? 1 : 0.14;
        n.tGlow = sel ? 0.7 : 0;
        n.tLabel = sel ? 1 : 0.12;
      }
      if (stageChanged) n.delayUntil = now + i * 0.02;
    });

    this.problemNodes.forEach((n, i) => {
      const isSolved = solved.has(n.id);
      n.tLabel = 0;
      if (stage === 1) {
        if (isSolved) {
          n.tScale = 0.95; n.tOpacity = 0.75; n.tGlow = 0.3;
        } else {
          n.tScale = 0.5; n.tOpacity = 0.14; n.tGlow = 0;
        }
      } else if (isSolved) {
        n.tScale = reinforced.has(n.id) ? 2 : 1.3;
        n.tOpacity = 1;
        n.tGlow = reinforced.has(n.id) ? 0.95 : 0.5;
      } else {
        n.tScale = 0.5; n.tOpacity = 0.1; n.tGlow = 0;
      }
      if (stageChanged) n.delayUntil = now + 0.15 + i * 0.018;
    });

    this.complianceNodes.forEach((n, i) => {
      const st = fwStatus[n.id];
      if (stage < 3 || st === 'none') {
        n.tScale = 0.5; n.tOpacity = stage < 3 ? 0.1 : 0.12; n.tGlow = 0; n.tLabel = 0;
      } else if (st === 'strong') {
        n.tScale = 1.7; n.tOpacity = 1; n.tGlow = 1; n.tLabel = 1;
      } else {
        n.tScale = 1.05; n.tOpacity = 0.7; n.tGlow = 0.35; n.tLabel = 0.65;
      }
      if (stageChanged) n.delayUntil = now + 0.2 + i * 0.05;
    });

    // Nodes remain clickable based on their normal state, then focus dims everything off the trace.
    for (const n of this.allNodes) {
      n.pickable = n.tOpacity > 0.3;
      if (!this.focusSet) continue;
      if (this.focusSet.has(`${n.kind}:${n.id}`)) {
        n.tOpacity = 1;
        n.tScale = Math.max(n.tScale, 1.3) * 1.15;
        n.tGlow = Math.max(n.tGlow, 0.8);
        n.tLabel = 1;
      } else if (n.kind === 'control' && selected.has(n.id)) {
        // selection must stay visible while another node is inspected
        if (stage > 1) {
          n.tOpacity = Math.max(n.tOpacity * 0.12, 0.45);
          n.tGlow = 0.25;
          n.tLabel = 0.6;
        }
      } else {
        n.tOpacity *= 0.25;
        n.tGlow = 0;
        n.tLabel *= 0.15;
      }
    }

    this.rebuildEdges(selected);
  }

  rebuildEdges(selected) {
    const { solved, frameworks } = this.results;
    const edges = [];
    const cpPos = [];
    const cpCol = [];
    const pfPos = [];
    const pfCol = [];

    const push = (arr, col, a, b, color) => {
      arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
      col.push(color.r, color.g, color.b, color.r, color.g, color.b);
    };

    const cpList = [];
    const pfList = [];
    if (this.focus) {
      cpList.push(...this.focus.cp);
      pfList.push(...this.focus.pf);
    } else {
      for (const [pid, sources] of solved) {
        for (const cid of sources) if (selected.has(cid)) cpList.push([cid, pid]);
      }
      for (const fw of frameworks) {
        if (fw.status === 'none') continue;
        for (const pid of fw.coveredProblems) pfList.push([pid, fw.id]);
      }
    }

    for (const [cid, pid] of cpList) {
      const cn = this.nodeIndex.control[cid];
      const pn = this.nodeIndex.problem[pid];
      if (!cn || !pn) continue;
      push(cpPos, cpCol, cn.pos, pn.pos, cn.color);
      edges.push({ a: cn.pos, b: pn.pos, color: cn.color, layer: 1 });
    }
    for (const [pid, fid] of pfList) {
      const pn = this.nodeIndex.problem[pid];
      const fn = this.nodeIndex.compliance[fid];
      if (!pn || !fn) continue;
      push(pfPos, pfCol, pn.pos, fn.pos, fn.color);
      edges.push({ a: pn.pos, b: fn.pos, color: fn.color, layer: 2 });
    }

    const apply = (obj, pos, col) => {
      obj.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      obj.geometry = g;
    };
    apply(this.lineCP, cpPos, cpCol);
    apply(this.linePF, pfPos, pfCol);

    // sample pulses across edges
    const step = Math.max(1, Math.ceil(edges.length / this.maxPulses));
    this.pulseState = [];
    for (let i = 0; i < edges.length; i += step) {
      this.pulseState.push({ edge: edges[i], t: Math.random(), speed: 0.12 + Math.random() * 0.18 });
    }
    this.pulseGeo.setDrawRange(0, this.pulseState.length);
  }

  // ── layout / events ───────────────────────────────────────────────────────

  setLayout(layout) {
    this.layout = layout;
    this.onResize();
  }

  onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const visH = 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360);
    const visW = visH * this.camera.aspect;
    const { panelPx, panelBottomPx } = this.layout;
    if (panelBottomPx) {
      const freeH = visH * (1 - panelBottomPx / h);
      const fit = Math.min(freeH, visW) / 21.5;
      this.baseScale = Math.min(1, fit);
      this.basePos.set(0, (panelBottomPx / h) * (visH / 2), 0);
    } else {
      const freeW = visW * (1 - (panelPx || 0) / w);
      const fit = Math.min(visH, freeW) / 21.5;
      this.baseScale = Math.min(1, fit);
      this.basePos.set(((panelPx || 0) / w) * (visW / 2), 0, 0);
    }
    this.worldPerPx = visH / h;
  }

  setLocked(locked) {
    this.locked = locked;
    this.drag = null;
    this.renderer.domElement.style.cursor = 'default';
  }

  resetView() {
    this.view = { rx: 0.05, ry: 0, zoom: 1, panX: 0, panY: 0 };
  }

  setPointer(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  onPointerDown(e) {
    this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.button === 2 || e.shiftKey, moved: false };
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
    this.hovered = null;
    this.onHover?.(null, 0, 0);
  }

  onPointerUp(e) {
    const d = this.drag;
    this.drag = null;
    this.renderer.domElement.releasePointerCapture?.(e.pointerId);
    if (!d || d.moved || e.type === 'pointercancel' || e.button === 2) return;
    this.setPointer(e);
    const n = this.pick();
    this.onSelectNode?.(n ? { kind: n.kind, id: n.id } : null);
  }

  onWheel(e) {
    e.preventDefault();
    if (this.locked) return;
    this.view.zoom = THREE.MathUtils.clamp(this.view.zoom * Math.exp(-e.deltaY * 0.001), 0.4, 2.6);
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    for (const h of hits) {
      const n = h.object.userData.node;
      if (n.pickable && n.opacity > 0.05) return n;
    }
    return null;
  }

  onPointerMove(e) {
    const el = this.renderer.domElement;
    if (this.drag) {
      const d = this.drag;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true;
      if (d.moved && !this.locked) {
        if (d.pan) {
          this.view.panX += dx * this.worldPerPx;
          this.view.panY -= dy * this.worldPerPx;
        } else {
          this.view.ry += dx * 0.006;
          this.view.rx = THREE.MathUtils.clamp(this.view.rx + dy * 0.006, -1.4, 1.4);
        }
      }
      el.style.cursor = this.locked ? 'default' : 'grabbing';
      return;
    }
    this.setPointer(e);
    const n = this.pick();
    this.hovered = n;
    el.style.cursor = n ? 'pointer' : this.locked ? 'default' : 'grab';
    this.onHover?.(n ? this.describe(n) : null, e.clientX, e.clientY);
  }

  onPointerLeave() {
    if (this.drag) return;
    this.hovered = null;
    this.pointer.set(10, 10);
    this.onHover?.(null, 0, 0);
  }

  describe(n) {
    const { solved, reinforced, frameworks } = this.results;
    if (n.kind === 'control') {
      const c = IAM_CONTROLS.find((x) => x.id === n.id);
      return { title: c.name, sub: 'Click to see what it solves', body: c.description, color: c.color };
    }
    if (n.kind === 'problem') {
      const p = PROBLEMS[n.id];
      const src = solved.get(n.id);
      const names = src ? [...src].map((id) => IAM_CONTROLS.find((c) => c.id === id)?.abbreviation).join(' + ') : null;
      return {
        title: p.name,
        sub: `${PROBLEM_CATEGORIES[p.cat].label} · ${p.severity}`,
        body: p.desc + (names ? `\nSolved by: ${names}${reinforced.has(n.id) ? ' (reinforced by combination)' : ''}` : '\nNot addressed by current selection.'),
        color: PROBLEM_CATEGORIES[p.cat].color,
      };
    }
    const f = frameworks.find((x) => x.id === n.id);
    const label = { strong: 'Core controls in place', partial: 'Partially supported', none: 'Not supported yet' }[f.status];
    return { title: f.name, sub: `${f.region} · ${label}`, body: f.fullName, color: f.color };
  }

  // ── render loop ───────────────────────────────────────────────────────────

  frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = this.clock.elapsedTime;

    if (!this.paused) {
      this.motionTime += dt;
      this.stars.rotation.y += dt * 0.004;
    }
    if (!this.paused && !this.locked && !this.drag) this.view.ry += dt * 0.07;
    const v = this.view;
    this.world.rotation.set(v.rx, v.ry, 0);
    this.world.scale.setScalar(this.baseScale * v.zoom);
    this.world.position.set(this.basePos.x + v.panX, this.basePos.y + v.panY, 0);
    const motion = this.motionTime;

    for (let i = 0; i < 3; i++) this.layerAlpha[i] += (this.layerTarget[i] - this.layerAlpha[i]) * 0.04;
    const edgeBoost = this.focus ? 1.8 : 1;
    this.lineCP.material.opacity = Math.min(1, this.layerAlpha[1] * 0.5 * edgeBoost);
    this.linePF.material.opacity = Math.min(1, this.layerAlpha[2] * 0.4 * edgeBoost);
    this.rings.problem.material.opacity = 0.2 + this.layerAlpha[1] * 0.2;
    this.rings.compliance.material.opacity = 0.15 + this.layerAlpha[2] * 0.25;

    for (const n of this.allNodes) {
      const active = now >= n.delayUntil;
      const ts = active ? n.tScale : n.scale;
      const to = active ? n.tOpacity : n.opacity;
      const tg = active ? n.tGlow : n.glowOpacity;
      const tl = active ? n.tLabel : n.labelOpacity;
      n.scale += (ts - n.scale) * LERP;
      n.opacity += (to - n.opacity) * LERP;
      n.glowOpacity += (tg - n.glowOpacity) * LERP;
      n.labelOpacity += (tl - n.labelOpacity) * LERP;

      const hover = n === this.hovered ? 1.35 : 1;
      const pulse = n.glowOpacity > 0.6 ? 1 + Math.sin(motion * 3 + n.pos.x) * 0.08 : 1;
      n.mesh.scale.setScalar(Math.max(0.01, n.scale * hover * pulse));
      n.mesh.material.opacity = n.opacity;
      n.glow.material.opacity = n.glowOpacity * (n === this.hovered ? 1 : 0.85);
      if (n.sprite) {
        n.sprite.material.opacity = n.labelOpacity;
        const k = 1 / Math.max(0.6, n.mesh.scale.x);
        n.sprite.scale.set(n.sprite.userData.base[0] * k, n.sprite.userData.base[1] * k, 1);
      }
    }

    // travelling pulses
    const pos = this.pulseGeo.attributes.position;
    const col = this.pulseGeo.attributes.color;
    for (let i = 0; i < this.pulseState.length; i++) {
      const p = this.pulseState[i];
      if (!this.paused) p.t += dt * p.speed;
      if (p.t > 1) p.t -= 1;
      const { a, b, color, layer } = p.edge;
      pos.setXYZ(i, a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t, a.z + (b.z - a.z) * p.t);
      const k = this.layerAlpha[layer] * Math.sin(p.t * Math.PI);
      col.setXYZ(i, color.r * k, color.g * k, color.b * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.onContextMenu);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.glowTex.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
