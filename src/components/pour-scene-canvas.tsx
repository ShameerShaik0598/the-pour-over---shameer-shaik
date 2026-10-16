"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Group } from "three";

function Stream({ color, x, count }: { color: string; x: number; count: number }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = x + Math.sin(index * 7.13) * 0.16;
      positions[index * 3 + 1] = ((index / count) * 2.8) - 1.15;
      positions[index * 3 + 2] = Math.cos(index * 2.1) * 0.08;
    }
    result.setAttribute("position", new BufferAttribute(positions, 3));
    return result;
  }, [count, x]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const positions = position.array as Float32Array;
    for (let index = 0; index < count; index += 1) {
      const yIndex = index * 3 + 1;
      positions[yIndex] -= delta * 0.18;
      if (positions[yIndex] < -1.45) positions[yIndex] = 1.38;
    }
    position.needsUpdate = true;
  });
  return <points ref={group} geometry={geometry}><pointsMaterial color={color} size={0.035} transparent opacity={0.72} sizeAttenuation /></points>;
}

function PourComposition({ active }: { active: boolean }) {
  const group = useRef<Group>(null);
  const { pointer } = useThree();
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  const streamCount = mobile ? 34 : 80;
  useFrame((_, delta) => {
    if (!group.current || !active) return;
    group.current.position.x += (pointer.x * 0.035 - group.current.position.x) * Math.min(delta * 2, 1);
    group.current.position.y += (pointer.y * 0.025 - group.current.position.y) * Math.min(delta * 2, 1);
  });
  return <group ref={group}>
    <Stream color="#D9694B" x={-0.65} count={streamCount} /><Stream color="#2F5D6B" x={0} count={streamCount} /><Stream color="#C2993A" x={0.65} count={streamCount} />
    <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.82, 0.24, 0.92, 16, 1, true]} /><meshBasicMaterial color="#877764" wireframe transparent opacity={0.24} /></mesh>
    <mesh position={[0, -0.95, 0]}><cylinderGeometry args={[0.6, 0.45, 0.7, 28, 1, true]} /><meshBasicMaterial color="#6D5948" wireframe transparent opacity={0.36} /></mesh>
    <mesh position={[0, -1.31, 0]}><torusGeometry args={[0.51, 0.018, 5, 32]} /><meshBasicMaterial color="#D9694B" transparent opacity={0.55} /></mesh>
    <mesh position={[0.78, -1.04, 0]}><torusGeometry args={[0.22, 0.035, 6, 24, Math.PI]} /><meshBasicMaterial color="#6D5948" wireframe transparent opacity={0.42} /></mesh>
  </group>;
}

export default function PourSceneCanvas({ active }: { active: boolean }) {
  return <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.5]} camera={{ position: [0, 0, 4.2], fov: 43 }} gl={{ alpha: true, antialias: true }}>
    <PourComposition active={active} />
  </Canvas>;
}
