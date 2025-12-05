// frontend/src/components/Sidebar.jsx
import React from "react";

export default function Sidebar({ tasks }) {
  // 保护性处理：确保 tasks 始终是数组
  const list = Array.isArray(tasks) ? tasks : [];

  return (
    <aside className="sidebar">
      <h3>任务</h3>

      {list.length === 0 ? (
        <div style={{ padding: 10, color: "#666" }}>目前没有任务或正在载入中</div>
      ) : (
        <div className="task-list">
          {list.map((t) => (
            <div key={t.TaskID} className="task-item">
              <div style={{ fontWeight: 600 }}>{t.TaskName}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {t.Assignee || "未指派"}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
