// frontend/src/components/GanttView.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Connector from "./Connector";
import Annotation from "./Annotation";
import TaskBar from "./TaskBar";
import ConnectDragLine from "./ConnectDragLine";
import useConnections from "../hooks/useConnections";
import useZoom from "../hooks/useZoom";
import useGanttCoords from "../hooks/useGanttCoords";
import "../styles.css";

/**
 * GanttView - 完整版
 * props:
 *  - tasks, minDate, maxDate
 *  - onTaskUpdate() - reload
 *  - criticalIds: []
 */
export default function GanttView({
  tasks = [],
  minDate,
  maxDate,
  onTaskUpdate,
  criticalIds = [],
}) {
  const svgRef = useRef(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [annotations, setAnnotations] = useState([]); // {id,text,x,y}
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [dragLine, setDragLine] = useState(null); // {x1,y1,x2,y2,fromId}
  const { connections, loadConnections, createConnection, deleteConnection } =
    useConnections();
  const { viewBox, zoomIn, zoomOut, resetZoom, screenToSvg, svgToScreen } =
    useZoom(svgRef);
  const { dateToX, daysBetween, xToDate } = useGanttCoords({ minDate, maxDate });

  // refs for bars to compute anchors
  const barsRef = useRef({});

  useEffect(() => {
    loadConnections();
  }, []);

  // compute anchors from barsRef
  function computeAnchor(taskID, side = "right") {
    const el = barsRef.current[taskID];
    if (!el) return null;
    try {
      const box = el.getBBox();
      if (side === "right") return { x: box.x + box.width, y: box.y + box.height / 2 };
      if (side === "left") return { x: box.x, y: box.y + box.height / 2 };
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    } catch (e) {
      return null;
    }
  }

  // parse backend anchor "x,y"
  function parseAnchor(s) {
    if (!s) return null;
    const [a, b] = s.split(",").map(Number);
    if (isNaN(a) || isNaN(b)) return null;
    return { x: a, y: b };
  }

  // handle creating connection (mouse up on a target)
  async function finishCreateConnection(toId, toAnchor) {
    if (!dragLine || !dragLine.fromId) return cancelCreateConnection();
    const fromId = dragLine.fromId;
    const fromAnchorStr = `${dragLine.x1},${dragLine.y1}`;
    const toAnchorStr = toAnchor ? `${toAnchor.x},${toAnchor.y}` : `${dragLine.x2},${dragLine.y2}`;
    const payload = {
      FromID: String(fromId),
      ToID: String(toId),
      FromAnchor: fromAnchorStr,
      ToAnchor: toAnchorStr,
      Color: "#2b7cff",
      Style: "solid",
      Label: ""
    };
    await createConnection(payload);
    await loadConnections();
    setDragLine(null);
    setIsCreatingConnection(false);
  }

  function cancelCreateConnection() {
    setDragLine(null);
    setIsCreatingConnection(false);
  }

  // start create: get anchor and set dragLine
  function startCreateConnection(fromId, fromAnchor) {
    setIsCreatingConnection(true);
    setDragLine({
      fromId,
      x1: fromAnchor.x,
      y1: fromAnchor.y,
      x2: fromAnchor.x,
      y2: fromAnchor.y,
    });
  }

  // mouse move while creating dragLine
  function onMouseMoveCreate(e) {
    if (!isCreatingConnection || !dragLine) return;
    const p = screenToSvg(e.clientX, e.clientY);
    setDragLine({ ...dragLine, x2: p.x, y2: p.y });
  }

  // create annotation
  function createAnnotationAt(x, y) {
    const id = "A" + Date.now().toString(16);
    const newNote = { id, text: "新注释", x, y };
    setAnnotations((s) => [...s, newNote]);
  }

  // save annotation pos
  function onAnnotationMove(id, pos) {
    setAnnotations((s) => s.map((a) => (a.id === id ? { ...a, ...pos } : a)));
  }

  function onAnnotationDelete(id) {
    setAnnotations((s) => s.filter((a) => a.id !== id));
  }

  // handle task drag updates from TaskBar (called with newStartDate/newEndDate)
  async function onTaskDatesUpdated(taskID, newStartISO, newEndISO) {
    try {
      await axios.patch(`/api/tasks/${taskID}`, { Start: newStartISO, End: newEndISO });
      if (typeof onTaskUpdate === "function") await onTaskUpdate();
    } catch (err) {
      console.error("update task error", err);
    }
  }

  // helper to compute anchor for connection item (prefer stored anchors)
  function anchorForConnectionSide(conn, side) {
    if (side === "from") {
      if (conn.FromAnchor) {
        const p = parseAnchor(conn.FromAnchor);
        if (p) return p;
      }
      return computeAnchor(conn.FromID, "right");
    } else {
      if (conn.ToAnchor) {
        const p = parseAnchor(conn.ToAnchor);
        if (p) return p;
      }
      return computeAnchor(conn.ToID, "left");
    }
  }

  // zoom UI handlers will be rendered
  return (
    <div
      className="gantt-container"
      onPointerMove={onMouseMoveCreate}
      style={{ position: "relative", flex: 1 }}
    >
      <div className="gantt-toolbar" style={{ padding: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => zoomIn()}>放大</button>
        <button onClick={() => zoomOut()}>缩小</button>
        <button onClick={() => resetZoom()}>重置缩放</button>
        <button onClick={() => {
          // create annotation at center of svg view
          const vb = viewBox();
          createAnnotationAt(vb.x + vb.width/3, vb.y + 80);
        }}>新增注释</button>
        <div style={{ marginLeft: "auto", color: "#666" }}>
          connections: {connections.length}
        </div>
      </div>

      <svg ref={svgRef} className="gantt-svg" style={{ width: "100%", height: "calc(100vh - 140px)" }} viewBox={`${viewBox().x} ${viewBox().y} ${viewBox().width} ${viewBox().height}`}>
        {/* background grid / header */}
        <rect x={viewBox().x} y={viewBox().y} width={viewBox().width} height={viewBox().height} fill="#fff" />

        {/* timeline labels - simple daily marks using dateToX */}
        {minDate && maxDate && (() => {
          const days = daysBetween(minDate, maxDate);
          const marks = [];
          for (let i = 0; i <= days; i++) {
            const dateX = dateToX(minDate, i);
            if (!isFinite(dateX)) continue;
            marks.push(
              <g key={"m"+i}>
                <line x1={dateX} x2={dateX} y1={viewBox().y+40} y2={viewBox().y + viewBox().height - 20} stroke="#f0f0f0"/>
                {i % Math.max(1, Math.ceil(days/20)) === 0 ? (
                  <text x={dateX+2} y={viewBox().y+28} fontSize={12} fill="#333">{xToDate(dateX)}</text>
                ) : null}
              </g>
            )
          }
          return marks;
        })()}

        {/* task bars */}
        <g className="task-layer">
          {tasks.map((t, i) => {
            const y = 60 + i * 40;
            const x1 = t.Start ? dateToX(t.Start) : dateToX(minDate);
            const x2 = t.End ? dateToX(t.End) : (x1 + 24);
            return (
              <TaskBar
                key={t.TaskID}
                task={t}
                x={x1}
                y={y}
                width={Math.max(20, x2 - x1)}
                height={20}
                ref={(el) => (barsRef.current[t.TaskID] = el)}
                onStartCreateConnection={(anchor) => startCreateConnection(t.TaskID, anchor)}
                onDatesChanged={(newStartISO, newEndISO) => onTaskDatesUpdated(t.TaskID, newStartISO, newEndISO)}
                critical={criticalIds.includes(Number(t.TaskID))}
                dateToX={dateToX}
              />
            );
          })}
        </g>

        {/* connections from backend */}
        <g className="connection-layer">
          {connections.map((c) => {
            const from = anchorForConnectionSide(c, "from");
            const to = anchorForConnectionSide(c, "to");
            if (!from || !to) return null;
            return (
              <Connector
                key={c.ConnID}
                from={from}
                to={to}
                style={c.Style}
                color={c.Color}
                label={c.Label}
                onDelete={() => { deleteConnection(c.ConnID).then(loadConnections); }}
              />
            );
          })}
        </g>

        {/* drag line while creating connection */}
        {isCreatingConnection && dragLine ? (
          <ConnectDragLine from={{x:dragLine.x1,y:dragLine.y1}} to={{x:dragLine.x2,y:dragLine.y2}} />
        ) : null}

        {/* annotations (rendered via foreignObject) */}
        <g className="annotation-layer">
          {annotations.map((a) => (
            <Annotation
              key={a.id}
              id={a.id}
              x={a.x}
              y={a.y}
              text={a.text}
              onMove={(id,pos)=>onAnnotationMove(id,pos)}
              onDelete={(id)=>onAnnotationDelete(id)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
