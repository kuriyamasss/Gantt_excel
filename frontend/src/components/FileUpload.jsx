import React from 'react'
import axios from 'axios'
export default function FileUpload({onUploaded}) {
  async function onChange(e){
    const f = e.target.files[0]
    if(!f) return
    const fd = new FormData()
    fd.append('file', f)
    const res = await axios.post('/api/upload', fd)
    onUploaded(res.data.url)
  }
  return <input type="file" onChange={onChange} />
}
