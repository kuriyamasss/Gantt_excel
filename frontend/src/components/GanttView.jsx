// frontend/src/components/GanttView.jsx
import React, { useRef, useEffect } from "react";
import axios from "axios";

/**
 * GanttView - 更健壮的甘特视图组件
 * props:
 *  - tasks: array of task objects
 *  - minDate: ISO date string (yyyy-mm-dd) 或 null
 *  - maxDate: ISO date string 或 null
 *  - onTaskUpdate: function called after PATCH update
 */
export default function GanttView({ tasks, minDate, maxDate, onTaskUpdate }) {
  const svgRef = useRef(null);

  useEffect(() => {
    renderGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, minDate, maxDate]);

  // 防护：确保 tasks 是数组
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // helper: days difference
  const MS_PER_DAY = 24 * 3600 * 1000;
  function dateToDays(d, base) {
    return Math.round((new Date(d).getTime() - new Date(base).getTime()) / MS_PER_DAY);
  }

  // 渲染甘特（在 SVG 中）
  function renderGantt() {
    const svg = svgRef.current;
    if (!svg) return;

    // 清空
    svg.innerHTML = "";

    // 基本布局参数（可调）
    const left = 180;
    const pxPerDay = 18;
    const rowH = 34;

    // 如果没有任务，显示空占位（不绘制 SVG 内容）
    if (safeTasks.length === 0) {
      // 设置一个最小画布，避免 SVG 尺寸为 0
      svg.setAttribute("viewBox", `0 0 800 200`);
      const ns = "http://www.w3.org/2000/svg";
      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", 20);
      txt.setAttribute("y", 40);
      txt.setAttribute("fill", "#666");
      txt.setAttribute("font-size", 14);
      txt.textContent = "当前无任务或正在载入...";
      svg.appendChild(txt);
      return;
    }

    // 处理日期边界：若后端未提供min/max，则从任务中推断
    let minD = null,
      maxD = null;
    if (minDate) minD = new Date(minDate);
    if (maxDate) maxD = new Date(maxDate);

    if (!minD || !maxD) {
      const dates = [];
      safeTasks.forEach((t) => {
        if (t.Start) dates.push(new Date(t.Start));
        if (t.End) dates.push(new Date(t.End));
      });
      if (dates.length === 0) {
        // 无日期数据，使用今天为基准
        minD = new Date();
        maxD = new Date(minD.getTime() + 7 * MS_PER_DAY);
      } else {
        const minTime = Math.min(...dates.map((d) => d.getTime()));
        const maxTime = Math.max(...dates.map((d) => d.getTime()));
        minD = minD || new Date(minTime);
        maxD = maxD || new Date(maxTime);
      }
    }

    // 增加左右边距
    const marginDays = 2;
    const startD = new Date(minD.getTime() - marginDays * MS_PER_DAY);
    const endD = new Date(maxD.getTime() + marginDays * MS_PER_DAY);
    const totalDays = Math.ceil((endD - startD) / MS_PER_DAY) + 1;

    const totalW = left + totalDays * pxPerDay + 80;
    const totalH = Math.max(400, (safeTasks.length + 2) * rowH + 100);

    svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);

    const ns = "http://www.w3.org/2000/svg";

    // grid layer
    const grid = document.createElementNS(ns, "g");
    svg.appendChild(grid);

    // 日期竖线和标签（简化）
    for (let d = 0; d < totalDays; d++) {
      const x = left + d * pxPerDay;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", x);
      line.setAttribute("y2", totalH);
      line.setAttribute("stroke", "#eee");
      grid.appendChild(line);

      if (d % 3 === 0) {
        const date = new Date(startD.getTime() + d * MS_PER_DAY);
        const txt = document.createElementNS(ns, "text");
        txt.setAttribute("x", x + 2);
        txt.setAttribute("y", 16);
        txt.setAttribute("font-size", 10);
        txt.setAttribute("fill", "#333");
        txt.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
        grid.appendChild(txt);
      }
    }

    // bars layer
    const bars = document.createElementNS(ns, "g");
    svg.appendChild(bars);

    safeTasks.forEach((t, i) => {
      // 检查 Start/End 是否存在
      if (!t.Start || !t.End) return;

      const sx = left + dateToDays(t.Start, startD) * pxPerDay;
      const ex = left + dateToDays(t.End, startD) * pxPerDay + pxPerDay;
      const w = Math.max(6, ex - sx);
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", sx);
      rect.setAttribute("y", 60 + i * rowH);
      rect.setAttribute("width", w);
      rect.setAttribute("height", rowH - 10);
      rect.setAttribute("rx", 6);
      rect.setAttribute("fill", "#7fb3ff");
      rect.setAttribute("data-id", t.TaskID);

      // attach drag handlers only if function provided
      if (typeof attachDrag === "function") {
        attachDrag(rect, t, startD, pxPerDay, left);
      }

      bars.appendChild(rect);

      // left label
      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", 8);
      txt.setAttribute("y", 60 + i * rowH + 14);
      txt.setAttribute("font-size", 12);
      txt.setAttribute("fill", "#111");
      txt.textContent = `${t.TaskID} ${t.TaskName}`;
      svg.appendChild(txt);
    });
  }

  // 拖拽逻辑：更新位置后向后端 PATCH
  function attachDrag(rect, task, minD, pxPerDay, left) {
    let dragging = null;

    rect.addEventListener("pointerdown", (e) => {
      rect.setPointerCapture(e.pointerId);
      const box = rect.getBBox();
      dragging = { startX: e.clientX, origX: box.x, origW: box.width };
    });

    rect.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      rect.setAttribute("x", dragging.origX + dx);
    });

    rect.addEventListener("pointerup", async (e) => {
      if (!dragging) return;
      const newX = parseFloat(rect.getAttribute("x"));
      const width = parseFloat(rect.getAttribute("width"));
      const newStartDays = Math.round((newX - left) / pxPerDay);
      const newEndDays = Math.round((newX + width - left - pxPerDay) / pxPerDay);
      const newStart = new Date(minD.getTime() + newStartDays * MS_PER_DAY);
      const newEnd = new Date(minD.getTime() + newEndDays * MS_PER_DAY);

      try {
        await axios.patch(`/api/tasks/${task.TaskID}`, {
          Start: newStart.toISOString().slice(0, 10),
          End: newEnd.toISOString().slice(0, 10),
        });
        if (typeof onTaskUpdate === "function") onTaskUpdate();
      } catch (err) {
        console.error("更新任务日期失败", err);
      } finally {
        dragging = null;
      }
    });

    // allow pointercancel / leave to stop dragging
    rect.addEventListener("pointercancel", () => (dragging = null));
    rect.addEventListener("mouseleave", () => (dragging = null));
  }

  return (
    <div className="gantt-view">
      <svg ref={svgRef} style={{ width: "100%", height: 600 }} />
    </div>
  );
}
