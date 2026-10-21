import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TransformerState, TransformerConfig } from '../simulation/types';
import { Box, Eye, RotateCw, Thermometer, ShieldCheck, Gauge } from 'lucide-react';

interface DigitalTwin3DVisualizerProps {
  state: TransformerState;
  config: TransformerConfig;
}

export const DigitalTwin3DVisualizer: React.FC<DigitalTwin3DVisualizerProps> = ({ state, config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Material & Mesh references for dynamic synchronization
  const statusLightRef = useRef<THREE.Mesh | null>(null);
  const statusPointLightRef = useRef<THREE.PointLight | null>(null);
  const tankMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const thermalGlowMeshRef = useRef<THREE.Mesh | null>(null);
  const thermalGlowMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const flowParticlesRef = useRef<THREE.Points | null>(null);
  const coolingFanRef = useRef<THREE.Group | null>(null);

  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const { operatingState, loadPercent, transformerTemperatureC, healthIndex } = state;

  // Initialize Three.js Scene once
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 440;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14); // Deep charcoal background (#0B0F14)
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 10, 16);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent below ground grid
    controls.minDistance = 6;
    controls.maxDistance = 40;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x5b7c99, 0.8);
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    // 6. Ground Grid Floor
    const gridHelper = new THREE.GridHelper(30, 30, 0x2a3547, 0x172033);
    gridHelper.position.y = -3.5;
    scene.add(gridHelper);

    // 7. BUILD 3D TRANSFORMER MODEL COMPONENTS
    const transformerGroup = new THREE.Group();
    scene.add(transformerGroup);

    // A. Base Concrete Pad
    const padGeo = new THREE.BoxGeometry(10, 0.5, 7);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1c2636, roughness: 0.9, metalness: 0.1 });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = -3.25;
    padMesh.receiveShadow = true;
    transformerGroup.add(padMesh);

    // B. Main Oil Tank Body (Dark Steel / Graphite)
    const tankGeo = new THREE.BoxGeometry(6.5, 4.5, 4.2);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x172033,
      roughness: 0.4,
      metalness: 0.7,
      transparent: true,
      opacity: 0.92,
    });
    tankMaterialRef.current = tankMat;
    const tankMesh = new THREE.Mesh(tankGeo, tankMat);
    tankMesh.position.y = -0.75;
    tankMesh.castShadow = true;
    transformerGroup.add(tankMesh);

    // C. Internal Magnetic Core (Visible inside tank)
    const coreGroup = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.8 });
    coreMaterialRef.current = coreMat;

    const limbGeo = new THREE.BoxGeometry(0.6, 3.2, 0.6);
    const yokeGeo = new THREE.BoxGeometry(3.6, 0.6, 0.6);

    const limb1 = new THREE.Mesh(limbGeo, coreMat); limb1.position.set(-1.3, -0.75, 0); coreGroup.add(limb1);
    const limb2 = new THREE.Mesh(limbGeo, coreMat); limb2.position.set(0, -0.75, 0); coreGroup.add(limb2);
    const limb3 = new THREE.Mesh(limbGeo, coreMat); limb3.position.set(1.3, -0.75, 0); coreGroup.add(limb3);

    const topYoke = new THREE.Mesh(yokeGeo, coreMat); topYoke.position.set(0, 0.65, 0); coreGroup.add(topYoke);
    const botYoke = new THREE.Mesh(yokeGeo, coreMat); botYoke.position.set(0, -2.15, 0); coreGroup.add(botYoke);

    // D. Copper Coils / Windings
    const windingMat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.3, metalness: 0.7 });
    const windingGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.4, 16);

    [-1.3, 0, 1.3].forEach((x) => {
      const winding = new THREE.Mesh(windingGeo, windingMat);
      winding.position.set(x, -0.75, 0);
      coreGroup.add(winding);
    });

    transformerGroup.add(coreGroup);

    // E. Internal Thermal Glow Mesh (Heatmap representation)
    const thermalGeo = new THREE.SphereGeometry(2.2, 16, 16);
    const thermalMat = new THREE.MeshBasicMaterial({ color: 0x5e9c76, transparent: true, opacity: 0.15 });
    thermalGlowMaterialRef.current = thermalMat;
    const thermalMesh = new THREE.Mesh(thermalGeo, thermalMat);
    thermalMesh.position.set(0, -0.75, 0);
    thermalGlowMeshRef.current = thermalMesh;
    transformerGroup.add(thermalMesh);

    // F. Top Cover & Conservator Tank (Oil Reservoir)
    const coverGeo = new THREE.BoxGeometry(6.7, 0.3, 4.4);
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x1c2636, roughness: 0.5, metalness: 0.6 });
    const coverMesh = new THREE.Mesh(coverGeo, coverMat);
    coverMesh.position.y = 1.65;
    transformerGroup.add(coverMesh);

    const consGeo = new THREE.CylinderGeometry(0.7, 0.7, 4.5, 16);
    consGeo.rotateZ(Math.PI / 2);
    const consMat = new THREE.MeshStandardMaterial({ color: 0x2a3547, roughness: 0.4, metalness: 0.6 });
    const consMesh = new THREE.Mesh(consGeo, consMat);
    consMesh.position.set(0, 2.5, -1.2);
    transformerGroup.add(consMesh);

    // G. Radiator Cooling Fins (Sides)
    const finGeo = new THREE.BoxGeometry(0.1, 3.5, 3.2);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.6, metalness: 0.5 });

    [-3.4, 3.4].forEach((x) => {
      for (let offset = -1.2; offset <= 1.2; offset += 0.4) {
        const fin = new THREE.Mesh(finGeo, finMat);
        fin.position.set(x, -0.75, offset);
        transformerGroup.add(fin);
      }
    });

    // H. Cooling Fan Assembly (Right Radiator)
    const fanGroup = new THREE.Group();
    const fanHousingGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16);
    fanHousingGeo.rotateX(Math.PI / 2);
    const fanHousing = new THREE.Mesh(fanHousingGeo, new THREE.MeshStandardMaterial({ color: 0x2a3547 }));
    fanGroup.add(fanHousing);

    const bladeGeo = new THREE.BoxGeometry(0.1, 1.1, 0.05);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x5b7c99 });
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (b * Math.PI) / 2;
      fanGroup.add(blade);
    }
    fanGroup.position.set(3.6, -0.75, 0);
    coolingFanRef.current = fanGroup;
    transformerGroup.add(fanGroup);

    // I. High Voltage Bushings (Primary 11 kV - Top Left)
    const bushingMat = new THREE.MeshStandardMaterial({ color: 0x2a3547, roughness: 0.2, metalness: 0.3 });
    const bushingGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.8, 12);

    [-1.8, -0.6, 0.6, 1.8].forEach((x) => {
      const bushing = new THREE.Mesh(bushingGeo, bushingMat);
      bushing.position.set(x, 2.7, 0.8);
      transformerGroup.add(bushing);

      // Terminal cap
      const capGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x5b7c99, metalness: 0.9 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, 3.6, 0.8);
      transformerGroup.add(cap);
    });

    // J. Low Voltage Bushings (Secondary 0.415 kV - Top Right)
    [-1.5, -0.5, 0.5, 1.5].forEach((x) => {
      const lvBushing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.2, 12),
        bushingMat
      );
      lvBushing.position.set(x, 2.4, -0.8);
      transformerGroup.add(lvBushing);
    });

    // K. Localized Operating State Indicator Beacon Light
    const statusBeaconGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const statusBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x5e9c76, // Normal green default
      emissive: 0x5e9c76,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    statusLightRef.current = statusBeaconMat as any;
    const statusBeaconMesh = new THREE.Mesh(statusBeaconGeo, statusBeaconMat);
    statusBeaconMesh.position.set(0, 3.2, 1.6);
    transformerGroup.add(statusBeaconMesh);

    const statusPointLight = new THREE.PointLight(0x5e9c76, 2.0, 6);
    statusPointLight.position.set(0, 3.2, 1.6);
    statusPointLightRef.current = statusPointLight;
    transformerGroup.add(statusPointLight);

    // L. Electrical Flow Particle Trail (Grid Input -> Transformer -> Feeder Output)
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      const progress = p / particleCount;
      particlePositions[p * 3] = -10 + progress * 20;
      particlePositions[p * 3 + 1] = 3.6 + Math.sin(progress * Math.PI * 4) * 0.2;
      particlePositions[p * 3 + 2] = 0.8;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x4f8f8b,
      size: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    const flowParticles = new THREE.Points(particleGeo, particleMat);
    flowParticlesRef.current = flowParticles;
    transformerGroup.add(flowParticles);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Controls update
      controls.update();

      // Fan rotation when running
      if (coolingFanRef.current) {
        coolingFanRef.current.rotation.z += 0.05;
      }

      // Animate flow particles
      if (flowParticlesRef.current) {
        const positions = flowParticlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += 0.08;
          if (positions[i * 3] > 10) {
            positions[i * 3] = -10;
          }
        }
        flowParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Thermal pulsing if in fault or overload
      if (thermalGlowMaterialRef.current && (operatingState === 'FAULT' || operatingState === 'OVERLOAD')) {
        thermalGlowMaterialRef.current.opacity = 0.2 + Math.sin(elapsedTime * 6) * 0.15;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || 800;
      const h = 440;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
    };
  }, []);

  // Update 3D Materials & Synchronization based on simulation state
  useEffect(() => {
    if (!statusLightRef.current || !statusPointLightRef.current || !thermalGlowMaterialRef.current) return;

    let targetHex = 0x5e9c76; // Normal Green (#5E9C76)
    let particleHex = 0x4f8f8b; // Muted Teal (#4F8F8B)

    switch (operatingState) {
      case 'WARNING':
        targetHex = 0xd6a84f; // Golden Yellow
        particleHex = 0xd6a84f;
        break;
      case 'HIGH_STRESS':
        targetHex = 0xc47a3a; // Amber
        particleHex = 0xc47a3a;
        break;
      case 'OVERLOAD':
      case 'FAULT':
        targetHex = 0xb94a48; // Deep Red
        particleHex = 0xb94a48;
        break;
      case 'RECOVERY':
        targetHex = 0x5b7c99; // Steel Blue
        particleHex = 0x5b7c99;
        break;
      default:
        targetHex = 0x5e9c76;
        particleHex = 0x4f8f8b;
        break;
    }

    // Update Status Beacon Light
    const mat = statusLightRef.current as any;
    if (mat.color) {
      mat.color.setHex(targetHex);
      mat.emissive.setHex(targetHex);
    }
    statusPointLightRef.current.color.setHex(targetHex);

    // Update Thermal Heatmap Glow intensity & color
    if (thermalGlowMaterialRef.current) {
      thermalGlowMaterialRef.current.color.setHex(targetHex);
      const tempNormalized = Math.min(1.0, Math.max(0.05, (transformerTemperatureC - 30) / 80));
      thermalGlowMaterialRef.current.opacity = 0.1 + tempNormalized * 0.35;
    }

    // Update Particle Trail color
    if (flowParticlesRef.current) {
      (flowParticlesRef.current.material as THREE.PointsMaterial).color.setHex(particleHex);
    }
  }, [operatingState, transformerTemperatureC]);

  // Update Auto-rotate setting
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [autoRotate]);

  // Camera preset handlers
  const setCameraView = (view: 'reset' | 'top' | 'front' | 'side') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (view) {
      case 'top':
        cam.position.set(0, 22, 0.1);
        ctrl.target.set(0, 0, 0);
        break;
      case 'front':
        cam.position.set(0, 3, 20);
        ctrl.target.set(0, 0, 0);
        break;
      case 'side':
        cam.position.set(20, 3, 0);
        ctrl.target.set(0, 0, 0);
        break;
      case 'reset':
      default:
        cam.position.set(12, 10, 16);
        ctrl.target.set(0, 0, 0);
        break;
    }
    ctrl.update();
  };

  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'WARNING':
        return 'bg-grid-yellow/20 border-grid-yellow text-grid-yellow';
      case 'HIGH_STRESS':
        return 'bg-grid-amber/20 border-grid-amber text-grid-amber';
      case 'OVERLOAD':
      case 'FAULT':
        return 'bg-grid-red/20 border-grid-red text-grid-red animate-pulse';
      default:
        return 'bg-grid-green/20 border-grid-green text-grid-green';
    }
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-3 shadow-md relative overflow-hidden">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-grid-border pb-3 z-10">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-grid-steel" />
          <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            3D DIGITAL TWIN REAL-TIME MODEL — {config.id} ({config.name})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${getBadgeStyle(operatingState)}`}>
            ● STATE: {operatingState}
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative w-full h-[440px] rounded-lg overflow-hidden border border-grid-border bg-grid-bg">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* 3D On-Screen Spatial Component Labels */}
        {showLabels && (
          <div className="absolute inset-0 pointer-events-none text-[10px] font-mono select-none">
            <div className="absolute top-6 left-12 bg-grid-card/90 border border-grid-steel/60 px-2 py-1 rounded text-white shadow-md">
              ▲ HV BUSHINGS (PRIMARY 11 kV)
            </div>

            <div className="absolute top-12 right-16 bg-grid-card/90 border border-grid-steel/60 px-2 py-1 rounded text-white shadow-md">
              ▲ LV BUSHINGS (SECONDARY 0.415 kV)
            </div>

            <div className="absolute bottom-24 left-1/3 bg-grid-card/90 border border-grid-border px-2 py-1 rounded text-grid-muted shadow-md">
              ■ MAGNETIC CORE &amp; WINDINGS
            </div>

            <div className="absolute bottom-16 right-12 bg-grid-card/90 border border-grid-border px-2 py-1 rounded text-grid-muted shadow-md">
              ■ RADIATOR COOLING FINS
            </div>

            <div className="absolute top-4 right-1/3 bg-grid-card/90 border border-grid-border px-2 py-1 rounded text-grid-muted shadow-md">
              ● CONSERVATOR OIL TANK
            </div>
          </div>
        )}

        {/* Bottom-Right Camera Control Bar */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-grid-card/90 border border-grid-border p-1.5 rounded-lg text-[11px] font-mono shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setCameraView('reset')}
            className="px-2 py-1 rounded bg-grid-bg border border-grid-border text-grid-muted hover:text-white hover:border-grid-steel transition-all flex items-center gap-1"
            title="Reset View"
          >
            <RotateCw className="w-3 h-3" />
            RESET
          </button>

          <button
            onClick={() => setCameraView('top')}
            className="px-2 py-1 rounded bg-grid-bg border border-grid-border text-grid-muted hover:text-white hover:border-grid-steel transition-all"
          >
            TOP
          </button>

          <button
            onClick={() => setCameraView('front')}
            className="px-2 py-1 rounded bg-grid-bg border border-grid-border text-grid-muted hover:text-white hover:border-grid-steel transition-all"
          >
            FRONT
          </button>

          <button
            onClick={() => setCameraView('side')}
            className="px-2 py-1 rounded bg-grid-bg border border-grid-border text-grid-muted hover:text-white hover:border-grid-steel transition-all"
          >
            SIDE
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2 py-1 rounded border transition-all flex items-center gap-1 ${
              showLabels
                ? 'bg-grid-steel/30 text-white border-grid-steel'
                : 'bg-grid-bg text-grid-muted border-grid-border'
            }`}
          >
            <Eye className="w-3 h-3" />
            LABELS: {showLabels ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2 py-1 rounded border transition-all flex items-center gap-1 ${
              autoRotate
                ? 'bg-grid-steel/30 text-white border-grid-steel'
                : 'bg-grid-bg text-grid-muted border-grid-border'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
            ORBIT: {autoRotate ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-2.5">
          <Gauge className="w-4 h-4 text-grid-steel shrink-0" />
          <div>
            <div className="text-[10px] text-grid-muted uppercase">LOAD UTILIZATION</div>
            <div className="text-white font-bold">{loadPercent.toFixed(1)} %</div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-2.5">
          <Thermometer className="w-4 h-4 text-grid-steel shrink-0" />
          <div>
            <div className="text-[10px] text-grid-muted uppercase">HOT-SPOT TEMP</div>
            <div className="text-white font-bold">{transformerTemperatureC.toFixed(1)} °C</div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-grid-green shrink-0" />
          <div>
            <div className="text-[10px] text-grid-muted uppercase">HEALTH INDEX</div>
            <div className="text-grid-green font-bold">{healthIndex.toFixed(1)} %</div>
          </div>
        </div>
      </div>
    </div>
  );
};
