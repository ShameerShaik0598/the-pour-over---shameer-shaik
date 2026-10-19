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
  return <svg viewBox="0 0 440 420" className="h-full w-full" aria-hidden="true">
    <circle cx="215" cy="204" r="184" fill="#f0e8dc" />
    <ellipse cx="218" cy="375" rx="150" ry="17" fill="#d9cdbd" />
    <g fill="#f4eee4" stroke="#dfd6ca" strokeWidth="1">
      <ellipse cx="211" cy="278" rx="103" ry="76" />
      <circle cx="138" cy="260" r="39" /><circle cx="164" cy="220" r="41" /><circle cx="207" cy="209" r="44" />
      <circle cx="251" cy="222" r="42" /><circle cx="281" cy="258" r="38" /><circle cx="149" cy="293" r="39" />
      <circle cx="188" cy="313" r="38" /><circle cx="232" cy="312" r="39" /><circle cx="270" cy="291" r="38" />
      <circle cx="192" cy="153" r="40" /><circle cx="222" cy="130" r="42" /><circle cx="250" cy="155" r="39" />
    </g>
    <g fill="#f4eee4"><ellipse cx="165" cy="151" rx="34" ry="15" transform="rotate(-22 165 151)"/><ellipse cx="278" cy="151" rx="34" ry="15" transform="rotate(22 278 151)"/></g>
    <g fill="#c98478"><ellipse cx="166" cy="151" rx="20" ry="6" transform="rotate(-22 166 151)"/><ellipse cx="277" cy="151" rx="20" ry="6" transform="rotate(22 277 151)"/></g>
    <ellipse cx="222" cy="188" rx="41" ry="54" fill="#e9d5bd" />
    <circle cx="207" cy="177" r="4" fill="#211c19"/><circle cx="237" cy="177" r="4" fill="#211c19"/>
    <ellipse cx="222" cy="209" rx="15" ry="10" fill="#c98478"/><path d="M215 219 Q222 226 229 219" fill="none" stroke="#76584b" strokeWidth="2" strokeLinecap="round"/>
    <path d="M161 275 Q152 319 143 342 M275 274 Q286 316 298 342" fill="none" stroke="#f4eee4" strokeWidth="25" strokeLinecap="round"/>
    <path d="M140 334 v28 M298 334 v28" fill="none" stroke="#514239" strokeWidth="18" strokeLinecap="round"/>
    <path d="M160 274 Q182 292 202 296 M278 274 Q256 292 238 296" fill="none" stroke="#514239" strokeWidth="13" strokeLinecap="round"/>
    <path d="M133 285 Q183 270 220 292 L217 350 Q178 341 140 353 Z" fill="#fffdf8" stroke="#aaa095" strokeWidth="2"/>
    <path d="M220 292 Q260 270 307 285 L300 353 Q262 341 217 350 Z" fill="#fffdf8" stroke="#aaa095" strokeWidth="2"/>
    <path d="M151 300 H199 M150 311 H204 M149 322 H198 M235 300 H289 M233 311 H293 M232 322 H286 M165 335 H197 M249 335 H283" stroke="#8b8379" strokeWidth="2"/>
    <path d="M156 294 H195 M237 294 H284" stroke="#a43c26" strokeWidth="3"/>
    <path d="M325 332 h54 l-6 37 h-42 z" fill="#b8462b"/><ellipse cx="352" cy="332" rx="27" ry="6" fill="#3e281d"/><path d="M379 340 q24 -4 18 16 q-3 10 -22 7" fill="none" stroke="#b8462b" strokeWidth="6"/>
    <path d="M338 316 q-10 -12 0 -23 M356 315 q-9 -15 1 -28 M372 315 q-8 -12 2 -22" fill="none" stroke="#a99c8d" strokeWidth="3" strokeLinecap="round"/>
    <text x="220" y="389" textAnchor="middle" fill="#625d56" fontFamily="monospace" fontSize="9" letterSpacing="2">THE MORNING FOLD · VOL. IX</text>
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
  return <div ref={container} className="pour-scene relative aspect-square w-full max-w-[440px]" role="img" aria-label="A woolly sheep reads the morning newspaper beside a steaming cup of coffee">
    {fallback ? <StaticPour /> : <SceneCanvas active={visible} />}
  </div>;
}
