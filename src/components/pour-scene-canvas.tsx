"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";

type Point = [number, number, number];

const bodyTufts: Array<{ position: Point; size: number }> = [
  { position: [-0.52, 0.02, 0.35], size: 0.28 }, { position: [-0.15, 0.35, 0.43], size: 0.27 },
  { position: [0.25, 0.27, 0.4], size: 0.3 }, { position: [0.56, 0.02, 0.28], size: 0.27 },
  { position: [-0.62, -0.34, 0.27], size: 0.27 }, { position: [-0.24, -0.48, 0.43], size: 0.28 },
  { position: [0.2, -0.46, 0.38], size: 0.29 }, { position: [0.55, -0.3, 0.27], size: 0.27 },
  { position: [-0.4, 0.36, 0.05], size: 0.28 }, { position: [0.08, 0.43, 0.07], size: 0.29 },
  { position: [0.46, 0.28, 0.04], size: 0.28 }, { position: [0, -0.1, 0.5], size: 0.26 },
];

function Wool({ position, size }: { position: Point; size: number }) {
  return <mesh position={position} scale={[size, size, size * 0.86]}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#f4eee4" roughness={0.94} /></mesh>;
}

function SteamWisp({ x, delay }: { x: number; delay: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const phase = clock.elapsedTime * 1.2 + delay;
    ref.current.position.y = 0.16 + ((phase % 1.6) / 1.6) * 0.56;
    ref.current.position.x = x + Math.sin(phase * 2.2) * 0.045;
    ref.current.scale.setScalar(0.72 + Math.sin(phase * 2) * 0.12);
  });
  return <group ref={ref} position={[x, -0.38, 1.14]}><mesh><sphereGeometry args={[0.035, 10, 10]} /><meshBasicMaterial color="#a99c8d" transparent opacity={0.45} /></mesh></group>;
}

function NewspaperPage({ side }: { side: "left" | "right" }) {
  const right = side === "right";
  const x = right ? 0.34 : -0.34;
  return <group position={[x, -0.18, 0.99]} rotation={[0, 0, right ? -0.04 : 0.04]}>
    <mesh><planeGeometry args={[0.69, 0.56]} /><meshStandardMaterial color="#fffdf8" roughness={1} side={2} /></mesh>
    <mesh position={[0, 0.2, 0.012]}><planeGeometry args={[0.5, 0.045]} /><meshBasicMaterial color="#292620" /></mesh>
    <mesh position={[0, 0.12, 0.012]}><planeGeometry args={[0.56, 0.014]} /><meshBasicMaterial color="#a43c26" /></mesh>
    {[-0.03, -0.1, -0.17, -0.24].map((y, index) => <mesh key={index} position={[0, y, 0.012]}><planeGeometry args={[index % 2 ? 0.51 : 0.57, 0.012]} /><meshBasicMaterial color="#888178" transparent opacity={0.68} /></mesh>)}
  </group>;
}

function CoffeeCup() {
  return <group position={[0.92, -0.99, 0.96]}>
    <mesh><cylinderGeometry args={[0.15, 0.12, 0.27, 28]} /><meshStandardMaterial color="#b8462b" roughness={0.4} /></mesh>
    <mesh position={[0, 0.137, 0]}><cylinderGeometry args={[0.132, 0.132, 0.014, 28]} /><meshStandardMaterial color="#3e281d" roughness={0.3} /></mesh>
    <mesh position={[0.17, 0.01, 0]}><torusGeometry args={[0.105, 0.025, 10, 24]} /><meshStandardMaterial color="#b8462b" roughness={0.4} /></mesh>
    <SteamWisp x={-0.045} delay={0} /><SteamWisp x={0.035} delay={0.75} />
  </group>;
}

function Sheep() {
  const head = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (head.current) head.current.rotation.z = Math.sin(clock.elapsedTime * 0.45) * 0.018;
  });
  return <group>
    <mesh position={[0, 0.05, -1.05]}><circleGeometry args={[1.86, 64]} /><meshBasicMaterial color="#f0e8dc" /></mesh>
    <mesh position={[0, -1.27, 0.16]} scale={[1.75, 0.055, 0.18]}><sphereGeometry args={[1, 32, 16]} /><meshStandardMaterial color="#d9cdbd" roughness={1} /></mesh>
    <group position={[0, -0.17, 0]}>
      <mesh position={[0, -0.06, 0]} scale={[0.78, 0.67, 0.53]}><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#f4eee4" roughness={0.95} /></mesh>
      {bodyTufts.map((tuft, index) => <Wool key={index} position={tuft.position} size={tuft.size} />)}
      {[-0.42, 0.42].map((x) => <group key={x} position={[x, -0.72, 0.03]} rotation={[0, 0, x < 0 ? -0.08 : 0.08]}>
        <mesh><cylinderGeometry args={[0.13, 0.105, 0.48, 16]} /><meshStandardMaterial color="#eee8de" roughness={0.95} /></mesh>
        <mesh position={[0, -0.26, 0.02]}><cylinderGeometry args={[0.12, 0.13, 0.16, 16]} /><meshStandardMaterial color="#514239" roughness={0.7} /></mesh>
      </group>)}
      <group ref={head} position={[0, 0.72, 0.23]}>
        <mesh scale={[0.48, 0.52, 0.42]}><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#f4eee4" roughness={0.95} /></mesh>
        {[-0.25, 0, 0.25].map((x) => <Wool key={x} position={[x, 0.39 + (x === 0 ? 0.04 : 0), 0.2]} size={0.2} />)}
        {[-1, 1].map((sign) => <group key={sign} position={[sign * 0.43, 0.11, 0.02]} rotation={[0, 0, sign * -0.32]}>
          <mesh scale={[0.27, 0.13, 0.09]}><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color="#f4eee4" roughness={0.9} /></mesh>
          <mesh position={[0, 0, 0.07]} scale={[0.17, 0.055, 0.025]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#c98478" roughness={0.85} /></mesh>
        </group>)}
        <mesh position={[0, -0.08, 0.35]} scale={[0.31, 0.42, 0.19]}><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#e9d5bd" roughness={0.9} /></mesh>
        {[-0.115, 0.115].map((x) => <group key={x}>
          <mesh position={[x, 0.01, 0.516]}><sphereGeometry args={[0.035, 16, 16]} /><meshStandardMaterial color="#211c19" roughness={0.45} /></mesh>
          <mesh position={[x * 0.55, -0.22, 0.526]}><sphereGeometry args={[0.018, 12, 12]} /><meshStandardMaterial color="#574337" roughness={0.8} /></mesh>
        </group>)}
        <mesh position={[0, -0.18, 0.49]} scale={[0.105, 0.075, 0.06]}><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color="#c98478" roughness={0.8} /></mesh>
      </group>
      <group position={[-0.48, 0.04, 0.59]} rotation={[0, 0, -0.46]}>
        <mesh><cylinderGeometry args={[0.085, 0.09, 0.52, 16]} /><meshStandardMaterial color="#f4eee4" roughness={0.95} /></mesh>
        <mesh position={[0, -0.28, 0.02]}><sphereGeometry args={[0.105, 16, 16]} /><meshStandardMaterial color="#514239" /></mesh>
      </group>
      <group position={[0.58, 0.0, 0.62]} rotation={[0, 0, 0.52]}>
        <mesh><cylinderGeometry args={[0.085, 0.09, 0.52, 16]} /><meshStandardMaterial color="#f4eee4" roughness={0.95} /></mesh>
        <mesh position={[0, -0.27, 0.02]}><sphereGeometry args={[0.105, 16, 16]} /><meshStandardMaterial color="#514239" /></mesh>
      </group>
      <NewspaperPage side="left" /><NewspaperPage side="right" />
    </group>
    <CoffeeCup />
  </group>;
}

function SceneComposition({ active }: { active: boolean }) {
  const group = useRef<Group>(null);
  const { pointer } = useThree();
  useFrame((_, delta) => {
    if (!group.current || !active) return;
    group.current.position.x += (pointer.x * 0.045 - group.current.position.x) * Math.min(delta * 1.5, 1);
    group.current.position.y += (pointer.y * 0.025 - group.current.position.y) * Math.min(delta * 1.5, 1);
  });
  return <group ref={group}><Sheep /></group>;
}

export default function PourSceneCanvas({ active }: { active: boolean }) {
  const camera = useMemo(() => ({ position: [0, 0, 5.1] as Point, fov: 40 }), []);
  return <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.5]} camera={camera} gl={{ alpha: true, antialias: true }}>
    <ambientLight intensity={1.1} /><directionalLight position={[-3, 4, 5]} intensity={2.2} /><directionalLight position={[3, 1, -1]} intensity={0.65} />
    <SceneComposition active={active} />
  </Canvas>;
}
