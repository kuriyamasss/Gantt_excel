// frontend/src/components/Annotation.jsx
import React, { useEffect, useState } from "react";

/**
 * Annotation - draggable note inside SVG via foreignObject
 * props: id,x,y,text,onMove,idDelete
 */
export default function Annotation({ id, x=100, y=100, text="", onMove, onDelete }) {
  const [pos, setPos] = useState({ x, y });

  useEffect(()=> setPos({ x, y }), [x, y]);

  useEffect(()=> {
    if (onMove) onMove(id, pos);
  }, [pos]); // eslint-disable-line

  function handlePointerDown(e) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const base = { ...pos };
    function onMove(ev) {
      setPos({ x: base.x + (ev.clientX - sx), y: base.y + (ev.clientY - sy) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <foreignObject x={pos.x} y={pos.y} width={220} height={120} style={{ overflow: "visible" }}>
      <div style={{ width:220, background:"#fff", border:"1px solid #ddd", padding:8, borderRadius:6, boxShadow:"0 4px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <strong>注释</strong>
          <div>
            <button onClick={() => onDelete && onDelete(id)} style={{ marginRight:8 }}>删除</button>
            <button onPointerDown={handlePointerDown}>拖拽</button>
          </div>
        </div>
        <div style={{ marginTop:8, whiteSpace:"pre-wrap" }}>{text}</div>
      </div>
    </foreignObject>
  );
}
