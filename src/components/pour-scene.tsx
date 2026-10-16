"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useSyncExternalStore } from "react";

const SceneCanvas = dynamic(() => import("@/components/pour-scene-canvas"), { ssr: false, loading: () => <StaticPour /> });

let sceneVisible = false;
const visibilityListeners = new Set<() => void>();
function subscribeVisibility(listener: () => void) { visibilityListeners.add(listener); return () => { visibilityListeners.delete(listener); }; }
function readVisibility() { return sceneVisible; }
function setVisibility(value: boolean) { sceneVisible = value; for (const listener of visibilityListeners) listener(); }
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function needsStaticFallback() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  const canvas = document.createElement("canvas");
  try { return !Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")); }
  catch { return true; }
}
function serverFallback() { return true; }
function serverVisibility() { return false; }

export function StaticPour() {
  return <svg viewBox="0 0 440 420" className="h-full w-full" role="img" aria-label="Three streams of reader activity pour through a filter into one cup">
    <path d="M130 55 L210 240 L285 55 M155 120 H260 M170 158 H245 M183 193 H230" fill="none" stroke="#9A8975" strokeOpacity=".42" strokeWidth="1"/>
    <path d="M145 58 C145 120 190 140 206 235 M220 45 C220 115 220 145 220 237 M295 55 C295 115 247 150 234 237" fill="none" stroke="#D9694B" strokeOpacity=".65" strokeWidth="2" strokeDasharray="2 8"/>
    <path d="M160 278 Q220 253 280 278 L264 356 Q220 380 176 356 Z" fill="#F3EBDD" stroke="#6D5948" strokeWidth="2"/>
    <path d="M280 291 Q330 283 320 322 Q315 343 268 335" fill="none" stroke="#6D5948" strokeWidth="2"/>
    <ellipse cx="220" cy="278" rx="60" ry="13" fill="none" stroke="#6D5948" strokeWidth="2"/>
    <circle cx="151" cy="88" r="3" fill="#D9694B"/><circle cx="218" cy="118" r="3" fill="#2F5D6B"/><circle cx="285" cy="94" r="3" fill="#C2993A"/>
  </svg>;
}

export function PourScene() {
  const container = useRef<HTMLDivElement>(null);
  const fallback = useSyncExternalStore(subscribeMotion, needsStaticFallback, serverFallback);
  const visible = useSyncExternalStore(subscribeVisibility, readVisibility, serverVisibility);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisibility(Boolean(entry?.isIntersecting)));
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); setVisibility(false); };
  }, []);
  return <div ref={container} className="pour-scene relative aspect-square w-full max-w-[440px]" aria-hidden="true">
    {fallback ? <StaticPour /> : <SceneCanvas active={visible} />}
  </div>;
}
