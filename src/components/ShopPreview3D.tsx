import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AssetLibrary3D, ThiefRig } from '../game/models3d';
import { CharacterId, OutfitId } from '../game/shop';

interface ShopPreview3DProps {
  characterId: CharacterId;
  outfitId: OutfitId;
}

function detectSoftwareWebGL(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const ShopPreview3D: React.FC<ShopPreview3DProps> = ({ characterId, outfitId }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<ThiefRig | null>(null);
  const assetsRef = useRef<AssetLibrary3D | null>(null);
  const pedestalRef = useRef<THREE.Group | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; rotOffset: number }>({
    active: false,
    lastX: 0,
    rotOffset: Math.PI, // Face camera (-Z local rotated to +Z)
  });
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.35));

    const width = Math.max(240, mount.clientWidth || 320);
    const height = Math.max(180, mount.clientHeight || 220);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16100d);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 30);
    camera.position.set(0, 1.45, 3.6);
    camera.lookAt(0, 0.95, 0);

    // Warm Key + Cool Fill + Rim Light
    const hemi = new THREE.HemisphereLight(0xfde68a, 0x291d16, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.65);
    keyLight.position.set(2.5, 4.5, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf97316, 0.95);
    rimLight.position.set(-2.5, 2.5, -3.0);
    scene.add(rimLight);

    const assets = new AssetLibrary3D(Math.min(4, renderer.capabilities.getMaxAnisotropy()));
    assetsRef.current = assets;

    const pedestal = new THREE.Group();
    const baseDisc = new THREE.Mesh(
      assets.trackGeo(new THREE.CylinderGeometry(0.92, 1.05, 0.14, 20)),
      assets.mat(0x271e1a, 0.55, 0.25)
    );
    baseDisc.position.y = -0.07;
    pedestal.add(baseDisc);

    const goldRing = new THREE.Mesh(
      assets.trackGeo(new THREE.TorusGeometry(0.93, 0.035, 8, 24)),
      assets.mat(0xfbbf24, 0.22, 0.88)
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0;
    pedestal.add(goldRing);
    scene.add(pedestal);
    pedestalRef.current = pedestal;

    const rig = assets.createThief(characterId, outfitId);
    rig.root.rotation.y = dragRef.current.rotOffset;
    pedestal.add(rig.root);
    rigRef.current = rig;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(160, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(mount);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let animPhase = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      animPhase += dt * 3.4;

      if (!dragRef.current.active) {
        dragRef.current.rotOffset += dt * 1.15;
      }

      const activeRig = rigRef.current;
      if (activeRig) {
        activeRig.root.rotation.y = dragRef.current.rotOffset;
        // Gentle confident stance animation
        const swing = Math.sin(animPhase) * 0.25;
        activeRig.leftArm.rotation.x = -swing;
        activeRig.rightArm.rotation.x = swing;
        activeRig.leftForearm.rotation.x = -0.32 - Math.max(0, -swing) * 0.25;
        activeRig.rightForearm.rotation.x = -0.32 - Math.max(0, swing) * 0.25;
        activeRig.leftLeg.rotation.x = swing * 0.45;
        activeRig.rightLeg.rotation.x = -swing * 0.45;
        activeRig.leftKnee.rotation.x = Math.max(0.04, -swing * 0.35 + 0.08);
        activeRig.rightKnee.rotation.x = Math.max(0.04, swing * 0.35 + 0.08);
        activeRig.bodyGroup.position.y = 0.92 + Math.abs(Math.cos(animPhase)) * 0.03;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      assets.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      rigRef.current = null;
      assetsRef.current = null;
      pedestalRef.current = null;
    };
  }, []);

  // Swap character/outfit immediately without tearing down WebGL context
  useEffect(() => {
    const pedestal = pedestalRef.current;
    const assets = assetsRef.current;
    if (!pedestal || !assets) return;

    if (rigRef.current) {
      rigRef.current.disposeUnique?.();
      pedestal.remove(rigRef.current.root);
    }
    const nextRig = assets.createThief(characterId, outfitId);
    nextRig.root.rotation.y = dragRef.current.rotOffset;
    pedestal.add(nextRig.root);
    rigRef.current = nextRig;
  }, [characterId, outfitId]);

  return (
    <div
      className="relative h-52 sm:h-60 w-full overflow-hidden rounded-xl border border-amber-500/30 bg-[#16100D] cursor-grab active:cursor-grabbing touch-pan-y select-none"
      onPointerDown={(e) => {
        dragRef.current.active = true;
        dragRef.current.lastX = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.lastX;
        dragRef.current.lastX = e.clientX;
        dragRef.current.rotOffset += dx * 0.015;
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
      }}
      aria-label="Aperçu 3D rotatif"
    >
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] font-medium text-[#D6CBC0]/80">
        Glisser pour tourner
      </div>
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#16100D]/95 text-xs text-amber-400">
          Rechargement aperçu 3D…
        </div>
      )}
    </div>
  );
};
