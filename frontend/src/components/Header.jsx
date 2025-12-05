import React from 'react'
export default function Header({onRefresh}){
  return (
    <header className="header">
      <h1>轻量甘特（React）</h1>
      <div>
        <button onClick={onRefresh}>刷新</button>
      </div>
    </header>
  )
}
