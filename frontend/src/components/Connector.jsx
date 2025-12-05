// frontend/src/components/Connector.jsx
import React from "react";

/**
 * Connector: bezier curve with arrow
 * props: from {x,y}, to {x,y}, color, style('solid'|'dashed'), label, onDelete
 */
export default function Connector({ from, to, color = "#2b7cff", style = "solid", label = "", onDelete }) {
  if (!from || !to) return null;
  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
  const dash = style === "dashed" ? "6 6" : "none";

  return (
    <g className="connector">
      <defs>
        <marker id="connector-arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color}></path>
        </marker>
      </defs>
      <path d={path} stroke={color} strokeWidth={2} fill="none" strokeDasharray={dash} markerEnd="url(#connector-arrow)"/>
      {label ? <text x={(from.x + to.x)/2} y={(from.y + to.y)/2 - 8} fontSize={12} fill={color} textAnchor="middle">{label}</text> : null}
      {onDelete ? (
        <rect x={(from.x+to.x)/2 - 20} y={(from.y+to.y)/2 - 24} width={40} height={16} rx={4} fill="#fff" stroke="#ccc" onClick={onDelete} style={{cursor:"pointer"}} />
      ) : null}
    </g>
  );
}
