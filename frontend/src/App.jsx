// frontend/src/App.jsx
import React, { useEffect, useReducer, useState } from "react";
import axios from "axios";
import GanttView from "./components/GanttView";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import "./styles.css";

axios.defaults.baseURL = "http://127.0.0.1:6868";

function reducer(state, action) {
  switch(action.type) {
    case "setTasks": return { ...state, tasks: action.tasks };
    case "setRange": return { ...state, minDate: action.minDate, maxDate: action.maxDate };
    default: return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { tasks: [], minDate: null, maxDate: null });
  const [criticalIds, setCriticalIds] = useState([]);

  useEffect(()=>{ loadTasks(); }, []);

  async function loadTasks() {
    try {
      const res = await axios.get("/api/tasks");
      dispatch({ type: "setTasks", tasks: res.data.tasks || [] });
      dispatch({ type: "setRange", minDate: res.data.min_date, maxDate: res.data.max_date });
    } catch (err) {
      console.error(err);
    }
  }

  async function runSchedule() {
    try {
      const res = await axios.post("/api/schedule/run");
      if (res.data && res.data.result) {
        const critical = [];
        for (const k of Object.keys(res.data.result || {})) {
          if (res.data.result[k].Critical) critical.push(Number(k));
        }
        setCriticalIds(critical);
        await loadTasks();
      }
    } catch (err) {
      console.error(err);
      alert("运行调度失败");
    }
  }

  return (
    <div className="app-root">
      <Header onRefresh={loadTasks} />
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid #eee" }}>
        <button onClick={runSchedule}>运行自动调度</button>
        <button onClick={loadTasks}>刷新</button>
      </div>
      <div className="layout" style={{ height: "calc(100vh - 96px)" }}>
        <Sidebar tasks={state.tasks} />
        <GanttView
          tasks={state.tasks}
          minDate={state.minDate}
          maxDate={state.maxDate}
          onTaskUpdate={loadTasks}
          criticalIds={criticalIds}
        />
      </div>
    </div>
  );
}
