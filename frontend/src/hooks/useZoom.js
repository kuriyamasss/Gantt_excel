// frontend/src/hooks/useZoom.js
import { useRef, useCallback } from "react";

/**
 * useZoom(svgRef) - simple viewBox based zoom controller
 * Provides: viewBox(), zoomIn(), zoomOut(), resetZoom(), screenToSvg(clientX,clientY)
 */
export default function useZoom(svgRef) {
  const state = useRef({
    x: 0, y: 0, width: 1400, height: 700, scale: 1
  });

  function viewBox() {
    return { x: state.current.x, y: state.current.y, width: state.current.width, height: state.current.height };
  }

  function applyViewBox() {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setAttribute("viewBox", `${state.current.x} ${state.current.y} ${state.current.width} ${state.current.height}`);
  }

  function zoom(factor = 1.2) {
    const vb = state.current;
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    vb.width = vb.width / factor;
    vb.height = vb.height / factor;
    vb.x = cx - vb.width / 2;
    vb.y = cy - vb.height / 2;
    state.current = vb;
    applyViewBox();
  }

  const zoomIn = useCallback(() => zoom(1.2), []);
  const zoomOut = useCallback(() => zoom(1/1.2), []);
  const resetZoom = useCallback(() => {
    state.current = { x: 0, y: 0, width: 1400, height: 700, scale: 1 };
    applyViewBox();
  }, []);

  function screenToSvg(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM().inverse();
    const sp = pt.matrixTransform(ctm);
    return { x: sp.x, y: sp.y };
  }

  function svgToScreen(x, y) {
    const svg = svgRef.current;
    if (!svg) return { x, y };
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const ctm = svg.getScreenCTM();
    const sp = pt.matrixTransform(ctm);
    return { x: sp.x, y: sp.y };
  }

  return { viewBox, zoomIn, zoomOut, resetZoom, screenToSvg, svgToScreen };
}
