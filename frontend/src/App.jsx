// frontend/src/App.jsx
import React, { useEffect, useReducer } from 'react'
import axios from 'axios'           // <-- 只导入一次
import GanttView from './components/GanttView'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import './styles.css'

// 在最开始设置 axios 默认 baseURL（开发时指向 Flask 后端）
axios.defaults.baseURL = 'http://127.0.0.1:6868'

function reducer(state, action){
  switch(action.type){
    case 'setTasks': return {...state, tasks: action.tasks}
    case 'setRange': return {...state, minDate: action.minDate, maxDate: action.maxDate}
    default: return state
  }
}

export default function App(){
  const [state, dispatch] = useReducer(reducer, {tasks: [], minDate: null, maxDate: null})

  useEffect(()=>{ loadTasks() }, [])

  async function loadTasks(){
    try{
      const res = await axios.get('/api/tasks')
      dispatch({type:'setTasks', tasks: res.data.tasks})
      dispatch({type:'setRange', minDate: res.data.min_date, maxDate: res.data.max_date})
    }catch(err){
      console.error('loadTasks error', err)
    }
  }

  return (
    <div className="app-root">
      <Header onRefresh={loadTasks} />
      <div className="layout">
        <Sidebar tasks={state.tasks} />
        <GanttView tasks={state.tasks} minDate={state.minDate} maxDate={state.maxDate} onTaskUpdate={loadTasks} />
      </div>
    </div>
  )
}
