"use client";

import { useEffect, useRef } from "react";

const STEP_LENGTH = 28;
const PRINT_LIFETIME = 760;
const PAW_PAD_PATH = "M10 11.2c-1.4 0-2.6 1.2-3 2.8-.5 2 1 3.1 3 3.1s3.5-1.1 3-3.1c-.4-1.6-1.6-2.8-3-2.8Z";

type Point = { x: number; y: number };

export default function CursorFootprints() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!layer || !finePointer.matches || reducedMotion.matches) return;

    let lastPoint: Point | null = null;
    let distanceSinceLastStep = 0;
    let stepSide = 1;
    const expiryTimers = new Set<number>();

    function placePrint(x: number, y: number, dx: number, dy: number) {
      const layerElement = layerRef.current;
      if (!layerElement) return;

      const distance = Math.hypot(dx, dy) || 1;
      const forwardX = dx / distance;
      const forwardY = dy / distance;
      const side = stepSide * 5;
      const print = document.createElement("span");
      print.className = "cursor-footprint " + (stepSide > 0 ? "cursor-footprint-left" : "cursor-footprint-right");
      print.style.left = String(x - forwardX * 6 - forwardY * side) + "px";
      print.style.top = String(y - forwardY * 6 + forwardX * side) + "px";
      print.style.setProperty("--foot-angle", String(Math.atan2(dy, dx) * (180 / Math.PI) + 90) + "deg");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("aria-hidden", "true");
      const footprint = document.createElementNS("http://www.w3.org/2000/svg", "path");
      footprint.setAttribute("d", PAW_PAD_PATH);
      footprint.setAttribute("class", "footprint-pad");
      svg.append(footprint);
      const toes = [
        { x: 4.1, y: 6.8, rx: 1.7, ry: 2.15, rotate: -28 },
        { x: 8.1, y: 4.1, rx: 1.7, ry: 2.1, rotate: -10 },
        { x: 12, y: 4.1, rx: 1.7, ry: 2.1, rotate: 10 },
        { x: 15.9, y: 6.8, rx: 1.7, ry: 2.15, rotate: 28 },
      ];
      for (const toe of toes) {
        const bean = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        bean.setAttribute("cx", String(toe.x));
        bean.setAttribute("cy", String(toe.y));
        bean.setAttribute("rx", String(toe.rx));
        bean.setAttribute("ry", String(toe.ry));
        bean.setAttribute("transform", `rotate(${toe.rotate} ${toe.x} ${toe.y})`);
        bean.setAttribute("class", "footprint-pad");
        svg.append(bean);
      }
      print.append(svg);
      layerElement.append(print);

      stepSide *= -1;
      const timer = window.setTimeout(() => {
        print.remove();
        expiryTimers.delete(timer);
      }, PRINT_LIFETIME);
      expiryTimers.add(timer);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        lastPoint = null;
        distanceSinceLastStep = 0;
        return;
      }

      const currentPoint = { x: event.clientX, y: event.clientY };
      if (!lastPoint) {
        lastPoint = currentPoint;
        return;
      }

      const dx = currentPoint.x - lastPoint.x;
      const dy = currentPoint.y - lastPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return;

      let traversed = 0;
      while (distanceSinceLastStep + distance - traversed >= STEP_LENGTH) {
        const needed = STEP_LENGTH - distanceSinceLastStep;
        traversed += needed;
        const progress = Math.min(1, traversed / distance);
        placePrint(lastPoint.x + dx * progress, lastPoint.y + dy * progress, dx, dy);
        distanceSinceLastStep = 0;
      }
      distanceSinceLastStep += distance - traversed;
      lastPoint = currentPoint;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      for (const timer of expiryTimers) window.clearTimeout(timer);
      layer.replaceChildren();
    };
  }, []);

  return <div ref={layerRef} className="cursor-footprint-layer" aria-hidden="true" />;
}
