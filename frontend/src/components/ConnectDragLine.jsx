// frontend/src/components/ConnectDragLine.jsx
import React from "react";

/**
 * ConnectDragLine - temporary line while dragging to create a connection
 * props: from {x,y}, to {x,y}
 */
export default function ConnectDragLine({ from, to }) {
  if (!from || !to) return null;
  const dx = Math.max(30, Math.abs(to.x - from.x) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
  return (
    <g>
      <path d={path} stroke="#333" strokeWidth={2} strokeDasharray="4 4" fill="none" />
    </g>
  );
}
