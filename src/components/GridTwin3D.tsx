import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { TwinSnapshot, CommEvent } from '../twin/gridTwinController';
import { IDS, LINKS, linkKey } from '../twin/gridTwinController';

/* Positions of T1–T4 on the ground plane (x, z) */
const POS: Record<string, THREE.Vector3> = {
  T1: new THREE.Vector3(-6, 0, -4.5),
  T2: new THREE.Vector3(6, 0, -4.5),
  T3: new THREE.Vector3(6, 0, 4.5),
  T4: new THREE.Vector3(-6, 0, 4.5),
};

export const STATE_COLOR: Record<string, string> = {
  NORMAL: '#5E9C76',
  RECOVERY: '#5B8DB8',
  WARNING: '#D6A84F',
  HIGH_STRESS: '#C47A3A',
  OVERLOAD: '#C0504D',
  FAULT: '#C0504D',
};
const COMM_COLOR: Record<CommEvent['kind'], string> = {
  alert: '#E06666',
  offer: '#6FA8DC',
  decline: '#8A8F98',
  transfer: '#E3B341',
  confirm: '#7CC48F',
  blocked: '#E06666',
};

interface Props {
  snapshot: TwinSnapshot;
  selectedId: string;
  onSelect: (id: string) => void;
}

interface Pulse { mesh: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; start: number; dur: number; stopAt: number; }

export const GridTwin3D: React.FC<Props> = ({ snapshot, selectedId, onSelect }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snapshot);
  const selRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  snapRef.current = snapshot; selRef.current = selectedId; onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current!;
    const w = () => host.clientWidth || 800, h = () => host.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d131b);
    scene.fog = new THREE.Fog(0x0d131b, 38, 70);
    const camera = new THREE.PerspectiveCamera(42, w() / h(), 0.1, 200);
    camera.position.set(0, 21, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), h());
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w(), h());
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    host.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0.6);
    controls.minDistance = 10; controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI / 2.15;

    // lights + ground
    scene.add(new THREE.HemisphereLight(0xcfd8e3, 0x1a2230, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x121a24, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(40, 40, 0x223044, 0x18212d); (grid.material as THREE.Material).opacity = 0.6; (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    /* ---------- transformers ---------- */
    const pickables: THREE.Object3D[] = [];
    const units: Record<string, { ring: THREE.Mesh; sel: THREE.Mesh; beacon: THREE.Mesh; beaconLight: THREE.PointLight; tankMat: THREE.MeshStandardMaterial; label: HTMLDivElement; group: THREE.Group }> = {};
    for (const id of IDS) {
      const g = new THREE.Group(); g.position.copy(POS[id]);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x7d8a99, metalness: 0.55, roughness: 0.45, emissive: 0x000000 });
      const finMat = new THREE.MeshStandardMaterial({ color: 0x5f6b79, metalness: 0.5, roughness: 0.55 });
      const porcelain = new THREE.MeshStandardMaterial({ color: 0xb9876b, roughness: 0.35 });
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a4554, roughness: 0.9 }));
      plinth.position.y = 0.15; plinth.receiveShadow = true; g.add(plinth);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.0, 1.5), tankMat);
      tank.position.y = 1.3; tank.castShadow = true; tank.userData.id = id; g.add(tank); pickables.push(tank);
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.5), finMat);
        fin.position.set(side * 1.25 + side * 0.04, 1.3, -0.5 + k * 0.25); fin.castShadow = true; g.add(fin);
      }
      const cons = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 20), tankMat);
      cons.rotation.z = Math.PI / 2; cons.position.set(0, 2.75, -0.55); g.add(cons);
      for (let k = -1; k <= 1; k++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 12), porcelain);
        b.position.set(k * 0.6, 2.75, 0.3); b.castShadow = true; g.add(b);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.15, 48), new THREE.MeshBasicMaterial({ color: STATE_COLOR.NORMAL, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      const sel = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.45, 48), new THREE.MeshBasicMaterial({ color: 0xe7e9ed, side: THREE.DoubleSide, transparent: true, opacity: 0.0 }));
      sel.rotation.x = -Math.PI / 2; sel.position.y = 0.03; g.add(sel);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), new THREE.MeshBasicMaterial({ color: STATE_COLOR.NORMAL }));
      beacon.position.set(0.85, 2.5, 0.55); g.add(beacon);
      const beaconLight = new THREE.PointLight(STATE_COLOR.NORMAL, 0.0, 6); beaconLight.position.copy(beacon.position); g.add(beaconLight);

      const label = document.createElement('div');
      label.style.cssText = 'font:600 11px/1.25 ui-monospace,Menlo,monospace;color:#e7e9ed;background:rgba(13,19,27,.82);border:1px solid #2a3547;border-radius:6px;padding:3px 7px;white-space:nowrap;text-align:center';
      const lo = new CSS2DObject(label); lo.position.set(0, 3.2, -1.6); g.add(lo);
      scene.add(g);
      units[id] = { ring, sel, beacon, beaconLight, tankMat, label, group: g };
    }

    /* ---------- links: communication arcs (high) + power paths (low) ---------- */
    const linkObjs: Record<string, { arc: THREE.QuadraticBezierCurve3; power: Record<string, THREE.LineCurve3>; tube: THREE.Mesh; mat: THREE.MeshBasicMaterial; powerLine: THREE.Line; label: HTMLDivElement; flow: HTMLDivElement; labelObj: CSS2DObject; flowObj: CSS2DObject }> = {};
    for (const [a, b] of LINKS) {
      const pa = POS[a].clone().setY(3.0), pb = POS[b].clone().setY(3.0);
      const mid = pa.clone().add(pb).multiplyScalar(0.5); mid.y = a === 'T1' && b === 'T3' ? 6.2 : b === 'T4' && a === 'T2' ? 5.4 : 4.6;
      const arc = new THREE.QuadraticBezierCurve3(pa, mid, pb);
      const mat = new THREE.MeshBasicMaterial({ color: 0x3b4a5e, transparent: true, opacity: 0.85 });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(arc, 48, 0.035, 6, false), mat);
      scene.add(tube);
      const ga = POS[a].clone().setY(0.35), gb = POS[b].clone().setY(0.35);
      const power: Record<string, THREE.LineCurve3> = { [`${a}>${b}`]: new THREE.LineCurve3(ga, gb), [`${b}>${a}`]: new THREE.LineCurve3(gb, ga) };
      const powerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ga, gb]), new THREE.LineBasicMaterial({ color: 0x2c3a4c }));
      scene.add(powerLine);
      const label = document.createElement('div');
      label.style.cssText = 'font:600 10px ui-monospace,Menlo,monospace;color:#E06666;background:rgba(13,19,27,.85);border:1px solid #E06666;border-radius:4px;padding:1px 5px';
      label.textContent = 'LINK DOWN';
      const lo = new CSS2DObject(label); lo.position.copy(arc.getPoint(0.5)); scene.add(lo);
      const flow = document.createElement('div');
      flow.style.cssText = 'font:600 10px ui-monospace,Menlo,monospace;color:#E3B341;background:rgba(13,19,27,.85);border:1px solid #E3B341;border-radius:4px;padding:1px 5px';
      const fo = new CSS2DObject(flow); fo.position.copy(ga.clone().add(gb).multiplyScalar(0.5).setY(0.9)); scene.add(fo);
      lo.visible = false; fo.visible = false;
      linkObjs[linkKey(a, b)] = { arc, power, tube, mat, powerLine, label, flow, labelObj: lo, flowObj: fo };
    }

    /* ---------- pulses ---------- */
    const pulses: Pulse[] = [];
    const pulseGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const seen = new Set<number>();
    const lastActive: Record<string, { until: number; color: string }> = {};
    const spawn = (curve: THREE.Curve<THREE.Vector3>, color: string, delay: number, dur: number, stopAt = 1, size = 1) => {
      const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.scale.setScalar(size); m.visible = false; scene.add(m);
      pulses.push({ mesh: m, curve, start: performance.now() + delay, dur, stopAt });
    };
    const arcFrom = (from: string, to: string) => {
      const k = linkKey(from, to); const L = linkObjs[k]; if (!L) return null;
      const forward = LINKS.some(([a, b]) => a === from && b === to);
      return forward ? L.arc : new THREE.QuadraticBezierCurve3(L.arc.v2, L.arc.v1, L.arc.v0);
    };
    const transferFlowPhase: Record<string, number> = {};
    const flowMeshes: Record<string, THREE.Mesh[]> = {};

    /* ---------- picking ---------- */
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // it was a drag
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) onSelectRef.current(hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.style.cursor = 'grab';

    const ro = new ResizeObserver(() => {
      camera.aspect = w() / h(); camera.updateProjectionMatrix();
      renderer.setSize(w(), h()); labelRenderer.setSize(w(), h());
    });
    ro.observe(host);

    /* ---------- frame loop ---------- */
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const snap = snapRef.current;

      // new communication events → pulses
      for (const ev of snap.comm) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const curve = arcFrom(ev.from, ev.to); if (!curve) continue;
        const col = COMM_COLOR[ev.kind];
        const k = linkKey(ev.from, ev.to);
        if (ev.kind === 'blocked') { spawn(curve, col, 0, 900, 0.45, 1.1); }
        else {
          const n = ev.kind === 'alert' ? 3 : ev.kind === 'transfer' ? 4 : 2;
          for (let q = 0; q < n; q++) spawn(curve, col, q * 260, 1300, 1, ev.kind === 'transfer' ? 1.2 : 1);
          lastActive[k] = { until: now + 2200, color: col };
        }
      }

      // links: status colour
      for (const [a, b] of LINKS) {
        const k = linkKey(a, b); const L = linkObjs[k];
        const up = snap.links[k] !== false;
        const act = lastActive[k] && lastActive[k].until > now ? lastActive[k] : null;
        L.mat.color.set(!up ? '#7a2e2e' : act ? act.color : '#3b4a5e');
        L.mat.opacity = !up ? 0.55 : act ? 1 : 0.8;
        L.labelObj.visible = !up;
        const tr = snap.transfers.find((x) => linkKey(x.from, x.to) === k);
        (L.powerLine.material as THREE.LineBasicMaterial).color.set(tr ? '#E3B341' : '#2c3a4c');
        L.flowObj.visible = !!tr;
        if (tr) L.flow.textContent = `${tr.from} → ${tr.to}  ${tr.mva.toFixed(2)} MVA`;
      }

      // persistent power-flow particles on active transfers (supporter → relieved unit)
      const activeKeys = new Set(snap.transfers.map((x) => `${x.from}>${x.to}`));
      for (const key of Object.keys(flowMeshes)) if (!activeKeys.has(key)) { flowMeshes[key].forEach((m) => scene.remove(m)); delete flowMeshes[key]; }
      for (const tr of snap.transfers) {
        const key = `${tr.from}>${tr.to}`;
        const L = linkObjs[linkKey(tr.from, tr.to)]; if (!L) continue;
        const curve = L.power[key];
        if (!flowMeshes[key]) {
          flowMeshes[key] = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: '#E3B341' })); m.scale.setScalar(0.8); scene.add(m); return m; });
          transferFlowPhase[key] = now;
        }
        flowMeshes[key].forEach((m, q) => { const u = (((now - transferFlowPhase[key]) / 2600) + q / 6) % 1; m.position.copy(curve.getPoint(u)); });
      }

      // pulses
      for (let p = pulses.length - 1; p >= 0; p--) {
        const P = pulses[p]; const u = (now - P.start) / P.dur;
        if (u < 0) continue;
        P.mesh.visible = true;
        if (u >= 1) { scene.remove(P.mesh); pulses.splice(p, 1); continue; }
        const along = Math.min(u, 1) * P.stopAt;
        P.mesh.position.copy(P.curve.getPoint(along));
        (P.mesh.material as THREE.MeshBasicMaterial).opacity = P.stopAt < 1 && u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      }

      // transformer status
      for (const id of IDS) {
        const U = units[id]; const us = snap.units[id]; if (!us) continue;
        const st = us.state.operatingState;
        const isEvent = snap.event?.affected === id;
        const phase = isEvent ? snap.event!.phase : null;
        let col = STATE_COLOR[st] ?? STATE_COLOR.NORMAL;
        if (phase === 'RECOVERING') col = STATE_COLOR.RECOVERY;
        if (us.isolated) col = '#8A8F98';
        (U.ring.material as THREE.MeshBasicMaterial).color.set(col);
        (U.beacon.material as THREE.MeshBasicMaterial).color.set(col);
        U.beaconLight.color.set(col);
        const alarm = st === 'OVERLOAD' || st === 'FAULT' || us.dist.D >= 0.45;
        const blink = alarm ? 0.5 + 0.5 * Math.sin(now / 160) : phase === 'RECOVERING' ? 0.5 + 0.5 * Math.sin(now / 500) : 0.25;
        U.beaconLight.intensity = 2.2 * blink;
        U.tankMat.emissive.set(alarm ? '#5a1a1a' : '#000000');
        U.tankMat.emissiveIntensity = alarm ? 0.35 * blink : 0;
        (U.sel.material as THREE.MeshBasicMaterial).opacity = selRef.current === id ? 0.9 : 0;
        const stateText = us.isolated ? 'ISOLATED (SIM)' : phase === 'RECOVERING' ? 'RECOVERING' : phase === 'RECOVERED' ? 'RECOVERED' : st.replace('_', ' ');
        U.label.innerHTML = `<div style="font-size:12px">${id} <span style="color:#9299a8;font-weight:500">${us.state.ratedCapacityMVA} MVA</span></div>`
          + `<div style="color:${col}">● ${stateText}</div>`
          + `<div style="color:#9299a8;font-weight:500">${us.state.loadPercent.toFixed(0)} % · ${us.state.transformerTemperatureC.toFixed(1)} °C</div>`;
        U.label.style.borderColor = selRef.current === id ? '#e7e9ed' : '#2a3547';
      }

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose(); renderer.dispose();
      host.innerHTML = '';
    };
  }, []);

  return <div ref={hostRef} className="relative w-full h-full overflow-hidden rounded-lg" />;
};
