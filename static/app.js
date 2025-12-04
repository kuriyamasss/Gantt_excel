// static/app.js
const API = {
  tasks: "/api/tasks",
  notes: (nid) => `/api/notes/${nid}`,
  upload: "/api/upload",
  downloadXlsx: "/download_excel"
};

const svg = document.getElementById("ganttSvg");
const taskListEl = document.getElementById("taskList");
const refreshBtn = document.getElementById("refreshBtn");
const downloadXlsxBtn = document.getElementById("downloadXlsx");
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const noteText = document.getElementById("noteText");
const attachmentsEl = document.getElementById("attachments");

refreshBtn.addEventListener("click", loadAndRender);
downloadXlsxBtn.addEventListener("click", () => window.location.href = API.downloadXlsx);
closeModal.addEventListener("click", () => modal.classList.add("hidden"));

async function loadAndRender(){
  const res = await fetch(API.tasks);
  const data = await res.json();
  const tasks = data.tasks;
  // parse dates
  tasks.forEach(t => {
    t.StartDate = t.Start ? new Date(t.Start) : null;
    t.EndDate = t.End ? new Date(t.End) : null;
  });

  // compute range
  let minDate = data.min_date ? new Date(data.min_date) : null;
  let maxDate = data.max_date ? new Date(data.max_date) : null;
  if(!minDate || !maxDate){
    // fallback
    minDate = new Date();
    maxDate = new Date();
  }

  renderTaskList(tasks);
  renderGantt(tasks, minDate, maxDate);
}

function renderTaskList(tasks){
  taskListEl.innerHTML = "";
  tasks.forEach(t => {
    const div = document.createElement("div");
    div.className = "task-item";
    div.textContent = `${t.TaskID} ${t.TaskName} (${t.Assignee || "-"})`;
    div.onclick = () => {
      // center scroll to corresponding bar (if exists)
      const bar = document.getElementById(`bar-${t.TaskID}`);
      if(bar){
        bar.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
        bar.classList.add("highlight");
        setTimeout(()=>bar.classList.remove("highlight"), 1500);
      }
    };
    taskListEl.appendChild(div);
  });
}

function dateToX(d, minDate, pxPerDay){
  const diff = Math.floor((d - minDate) / (24*3600*1000));
  return diff * pxPerDay;
}

function renderGantt(tasks, minDate, maxDate){
  // add 1-2 days margin
  const msPerDay = 24*3600*1000;
  minDate = new Date(minDate.getTime() - msPerDay*2);
  maxDate = new Date(maxDate.getTime() + msPerDay*2);

  const totalDays = Math.ceil((maxDate - minDate) / msPerDay) + 1;
  const pxPerDay = 18; // width per day
  const leftColWidth = 260;
  const rowHeight = 28;
  const svgW = leftColWidth + totalDays * pxPerDay + 40;
  const svgH = (tasks.length + 2) * rowHeight + 40;

  svg.setAttribute("width", svgW);
  svg.setAttribute("height", svgH);
  svg.innerHTML = "";

  // header: dates
  // draw grid & date labels
  const headerY = 30;
  // left header
  const leftRect = createSVG("rect",{x:0,y:0,width:leftColWidth,height:svgH,fill:"#fafafa",stroke:"#ddd"});
  svg.appendChild(leftRect);

  // vertical lines per day
  for(let d=0; d<totalDays; d++){
    const x = leftColWidth + d*pxPerDay;
    svg.appendChild(createSVG("line",{x1:x,y1:0,x2:x,y2:svgH,stroke:"#eee"}));
    // label every 3 or 7 days to avoid clutter
    if(d % 3 === 0){
      const date = new Date(minDate.getTime() + d*msPerDay);
      const txt = createSVG("text",{x:x+2,y:16,"font-size":10,fill:"#333"});
      txt.textContent = `${date.getMonth()+1}/${date.getDate()}`;
      svg.appendChild(txt);
    }
  }

  // draw rows
  tasks.forEach((t, i) => {
    const y = headerY + i * rowHeight;
    // left side: task name, assignee
    const text = createSVG("text",{x:8,y:y+18,"font-size":12,fill:"#111"});
    text.textContent = `${t.TaskID} ${t.TaskName}`;
    svg.appendChild(text);
    // assignee smaller
    const assignee = createSVG("text",{x:8,y:y+30,"font-size":10,fill:"#666"});
    assignee.textContent = `${t.Assignee || ""}`;
    svg.appendChild(assignee);

    // draw gantt bar
    if(t.StartDate && t.EndDate){
      const x = leftColWidth + dateToX(t.StartDate, minDate, pxPerDay);
      const w = Math.max(6, dateToX(t.EndDate, minDate, pxPerDay) - dateToX(t.StartDate, minDate, pxPerDay) + pxPerDay);
      const bar = createSVG("rect",{x:x+2,y:y+6,width:w-4,height:rowHeight-12,rx:4,ry:4,fill:"#7fb3ff",id:`bar-${t.TaskID}`,cursor:"pointer"});
      bar.addEventListener("click", ()=>onBarClick(t));
      svg.appendChild(bar);
    }
  });

  // make svg horizontally scrollable container
  const container = document.getElementById("ganttContainer");
  container.scrollLeft = 0;
}

// helper
function createSVG(tag, attrs){
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for(const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

async function onBarClick(task){
  if(!task.NoteID){
    noteText.textContent = "无说明";
    attachmentsEl.innerHTML = "";
    modal.classList.remove("hidden");
    return;
  }
  const res = await fetch(`/api/notes/${task.NoteID}`);
  if(res.status !== 200){
    noteText.textContent = "未找到说明";
    attachmentsEl.innerHTML = "";
    modal.classList.remove("hidden");
    return;
  }
  const body = await res.json();
  noteText.textContent = body.NoteText || "";
  attachmentsEl.innerHTML = "";
  if(body.Attachments && body.Attachments.length){
    body.Attachments.forEach(a=>{
      const aEl = document.createElement("a");
      aEl.href = a;
      aEl.textContent = a;
      aEl.target = "_blank";
      const div = document.createElement("div");
      div.appendChild(aEl);
      attachmentsEl.appendChild(div);
    });
  }
  modal.classList.remove("hidden");
}

// initial load
loadAndRender();
