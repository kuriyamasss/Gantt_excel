// frontend/src/components/TaskBar.jsx
import React, { forwardRef, useRef } from "react";

/**
 * TaskBar - 单条任务显示与局部拖拽（左/center/right）
 * props:
 *   task, x,y,width,height, onStartCreateConnection(anchor), onDatesChanged(newStart,newEnd), critical, dateToX
 *
 * forwardRef => rect element is assigned to ref for anchor computation
 */
const TaskBar = forwardRef(({ task, x, y, width, height, onStartCreateConnection, onDatesChanged, critical, dateToX }, ref) => {
  const rectRef = useRef(null);

  // drag move whole bar (translate X) -> convert dx -> days -> patch
  function onPointerDownMove(e) {
    e.preventDefault();
    const startX = e.clientX;
    const origX = x;
    function move(ev) {
      const dx = ev.clientX - startX;
      const svg = rectRef.current && rectRef.current.ownerSVGElement;
      // convert dx pixels to days using approximate scale via dateToX
      if (!svg) return;
      // get day per pixel by comparing two dateToX points
      const p1 = dateToX(task.Start);
      const p2 = dateToX(task.Start);
      const dayPerPixel = 1 / Math.max(1, Math.abs((dateToX(task.End) - dateToX(task.Start)) / Math.max(1,( (new Date(task.End) - new Date(task.Start))/(1000*3600*24) ))));
      // fallback: count days by shifting x by dx and compute date by xToDate in parent - we don't have xToDate here; instead approximate days shift:
      // simple approach: calculate pixel->day using width vs duration
      let durationDays = Math.max(1, Math.round((new Date(task.End) - new Date(task.Start)) / (24*3600*1000)) + 1);
      const pxPerDay = width / Math.max(1,durationDays);
      const shiftDays = Math.round(dx / pxPerDay);
      // compute new dates
      const newStart = new Date(task.Start);
      newStart.setDate(newStart.getDate() + shiftDays);
      const newEnd = new Date(task.End);
      newEnd.setDate(newEnd.getDate() + shiftDays);
      // show live move by updating element translate via attribute (not persisting)
      if (rectRef.current) rectRef.current.setAttribute("x", origX + shiftDays * pxPerDay);
    }
    function up(ev) {
      // finalize: compute shiftDays and call onDatesChanged
      const dx = ev.clientX - startX;
      const durationDays = Math.max(1, Math.round((new Date(task.End) - new Date(task.Start)) / (24*3600*1000)) + 1);
      const pxPerDay = width / Math.max(1,durationDays);
      const shiftDays = Math.round(dx / pxPerDay);
      const newStart = new Date(task.Start); newStart.setDate(newStart.getDate() + shiftDays);
      const newEnd = new Date(task.End); newEnd.setDate(newEnd.getDate() + shiftDays);
      if (onDatesChanged) onDatesChanged(newStart.toISOString().slice(0,10), newEnd.toISOString().slice(0,10));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // start connection from right anchor
  function onStartConnect(e) {
    e.stopPropagation();
    const svg = rectRef.current && rectRef.current.ownerSVGElement;
    if (!svg) return;
    const box = rectRef.current.getBBox();
    const anchor = { x: box.x + box.width, y: box.y + box.height/2 };
    if (onStartCreateConnection) onStartCreateConnection(anchor);
  }

  return (
    <g>
      <rect ref={(el)=>{ rectRef.current = el; if (ref) ref(el); }}
            x={x} y={y} width={width} height={height}
            rx={4} fill={critical ? "#ff4d4f" : "#4da6ff"} stroke={critical ? "#a8071a" : "#1d39c4"} strokeWidth={critical ? 2 : 1}
            style={{cursor:"grab"}}
            onPointerDown={onPointerDownMove}
      />
      {/* small connector handle on right */}
      <rect x={x + width - 8} y={y + height/2 - 6} width={12} height={12} rx={2} fill="#fff" stroke="#999" onPointerDown={onStartConnect} style={{cursor:"crosshair"}} />
      <text x={x - 6} y={y + height - 4} fontSize={12} textAnchor="end">{task.TaskName}</text>
    </g>
  );
});

export default TaskBar;
