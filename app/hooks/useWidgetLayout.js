"use client";

import { useEffect, useRef, useState } from "react";
import { fitContentScale } from "../../lib/widget-layout.js";

export default function useWidgetLayout() {
  const shellRef = useRef(null);
  const [layout, setLayout] = useState({ width: 440, scale: 1 });
  const [fitScale, setFitScale] = useState(1);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    let active = true;
    let frame;
    let lastMeasurement = "";
    const native = window.codexWidget;
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
    window.addEventListener("resize", scheduleMeasure);
    document.fonts?.ready.then(() => { if (active) scheduleMeasure(); });
    scheduleMeasure();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      stopListening?.();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  // A native width change reflows content and is measured before the next report.
  useEffect(() => {
    const shell = shellRef.current;
    if (shell) setFitScale(fitContentScale(shell.offsetWidth, shell.offsetHeight,
      window.innerWidth, window.innerHeight, layout.scale));
  }, [layout]);

  return { shellRef, shellStyle: { width: layout.width, transform: `scale(${fitScale})` } };
}
