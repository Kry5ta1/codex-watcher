"use client";

import { useEffect, useRef, useState } from "react";
import { fitContentScale } from "../../lib/widget-layout.js";

export default function useWidgetLayout() {
  const shellRef = useRef(null);
  const [layout, setLayout] = useState({ width: 440, scale: 1 });
  const [fitScale, setFitScale] = useState(1);
  const [isDesktop, setIsDesktop] = useState(false);
  const cardRef = useRef(null);
  const lastRegion = useRef("");
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    let active = true;
    let frame;
    let lastMeasurement = "";
    const native = window.codexWidget;
    setIsDesktop(Boolean(native));
    let nativeRevision = 0;
    const applyLayout = (next) => {
      if (!active || !next || !Number.isFinite(next.width) || next.width < 420 ||
          !Number.isFinite(next.scale) || next.scale <= 0 || next.scale > 1) return;
      setLayout((current) => current.width === next.width && current.scale === next.scale
        ? current : { width: next.width, scale: next.scale });
      scheduleMeasure();
    };
    function measure() {
      if (!active || !shellRef.current) return;
      const width = shellRef.current.offsetWidth;
      const height = shellRef.current.offsetHeight;
      setFitScale(fitContentScale(width, height, window.innerWidth, window.innerHeight, layoutRef.current.scale));
      reportCardRegion(native, cardRef.current, lastRegion);
      const key = `${width}:${height}`;
      if (key === lastMeasurement) return;
      lastMeasurement = key;
      native?.reportContentSize?.({ width, height })?.catch?.(() => {
        // The local fit still keeps every section visible if IPC is unavailable.
        lastMeasurement = "";
      });
    }
    function scheduleMeasure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const stopListening = native?.onLayoutChanged?.((next) => {
      nativeRevision += 1;
      applyLayout(next);
    });
    const initialRevision = nativeRevision;
    native?.getLayout?.().then((next) => {
      if (nativeRevision === initialRevision) applyLayout(next);
    }).catch(() => {});
    const observer = new ResizeObserver(scheduleMeasure);
    if (shellRef.current) observer.observe(shellRef.current);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("focus", scheduleMeasure);
    document.fonts?.ready.then(() => { if (active) scheduleMeasure(); });
    scheduleMeasure();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      stopListening?.();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("focus", scheduleMeasure);
    };
  }, []);

  // A native width change reflows content and is measured before the next report.
  useEffect(() => {
    const shell = shellRef.current;
    if (shell) setFitScale(fitContentScale(shell.offsetWidth, shell.offsetHeight,
      window.innerWidth, window.innerHeight, layout.scale));
  }, [layout]);

  useEffect(() => {
    reportCardRegion(window.codexWidget, cardRef.current, lastRegion);
  }, [fitScale, layout, isDesktop]);

  return { cardRef, isDesktop, shellRef, shellStyle: { width: layout.width, transform: `scale(${fitScale})` } };
}

function reportCardRegion(native, card, lastRegion) {
  if (!native?.reportCardRegion || !card) return;
  const { x, y, width, height } = card.getBoundingClientRect();
  const key = `${x}:${y}:${width}:${height}:${window.innerWidth}:${window.innerHeight}:${window.devicePixelRatio}`;
  if (key === lastRegion.current) return;
  lastRegion.current = key;
  const retry = () => { if (lastRegion.current === key) lastRegion.current = ""; };
  native.reportCardRegion({ x, y, width, height }).then((applied) => {
    if (!applied) retry();
  }, retry);
}
