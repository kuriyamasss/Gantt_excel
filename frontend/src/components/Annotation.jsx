// frontend/src/components/Annotation.jsx
import React, { useRef, useState, useEffect } from "react";

/**
 * Annotation: draggable note displayed inside SVG via foreignObject
 * props:
 *   id: unique id
 *   x,y: initial position (numbers)
 *   text: content (string or node)
 *   onMove(id, {x,y}) called while dragging/after move
 *   onDelete(id) optional
 */
export default function Annotation({ id, x = 100, y = 100, text = "", onMove, onDelete }) {
  const [pos, setPos] = useState({ x, y });

  useEffect(() => setPos({ x, y }), [x, y]);

  useEffect(() => {
    if (onMove) onMove(id, pos);
  }, [pos]); // eslint-disable-line

  function startDrag(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...pos };

    function move(ev) {
      setPos({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <foreignObject x={pos.x} y={pos.y} width={240} height={140} style={{ overflow: "visible" }}>
      <div
        style={{
          width: 240,
          minHeight: 80,
          boxSizing: "border-box",
          borderRadius: 6,
          border: "1px solid #ddd",
          background: "#fff",
          padding: 8,
          boxShadow: "0 6px 12px rgba(0,0,0,0.08)",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>注释</strong>
          <div>
            <button onClick={() => onDelete && onDelete(id)} style={{ marginRight: 8 }}>
              删除
            </button>
            <button onPointerDown={startDrag}>拖拽</button>
          </div>
        </div>
        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </foreignObject>
  );
}
