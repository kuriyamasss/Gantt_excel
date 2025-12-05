// frontend/src/components/Connector.jsx
import React from "react";

/**
 * Connector: 绘制从 from -> to 的贝塞尔曲线，带箭头和可选标签
 * props:
 *   from: {x:number, y:number}
 *   to: {x:number, y:number}
 *   style: "solid" | "dashed"
 *   color: string
 *   label: string
 */
export default function Connector({ from, to, style = "solid", color = "#2b7cff", label = "" }) {
  if (!from || !to) return null;

  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
  const dash = style === "dashed" ? "6 6" : "none";

  return (
    <g className="connector">
      <defs>
        <marker id="gantt-arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color}></path>
        </marker>
      </defs>

      <path d={path} stroke={color} strokeWidth="2" fill="none" strokeDasharray={dash} markerEnd="url(#gantt-arrow)" />

      {label ? (
        <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} fontSize="12" fill={color} textAnchor="middle">
          {label}
        </text>
      ) : null}
    </g>
  );
}
