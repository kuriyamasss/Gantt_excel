# app.py
import os
import uuid
from datetime import datetime, date, timedelta
from collections import defaultdict, deque

from flask import Flask, jsonify, request, send_from_directory, abort, send_file
from flask_cors import CORS

from sqlalchemy import create_engine, Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import NoResultFound

# --- config ---
DB_FILE = "data.db"
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Flask init
app = Flask(__name__, static_folder="frontend/dist", static_url_path="/")
CORS(app)

# SQLAlchemy init
engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# --- models ---
class Task(Base):
    __tablename__ = "tasks"
    TaskID = Column(Integer, primary_key=True, autoincrement=True)
    ProjectID = Column(String(64), nullable=True)
    ParentTaskID = Column(Integer, nullable=True)
    TaskName = Column(String(255), nullable=False)
    Start = Column(Date, nullable=True)
    End = Column(Date, nullable=True)
    Assignee = Column(String(128), nullable=True)
    NoteID = Column(String(64), nullable=True)

class Note(Base):
    __tablename__ = "notes"
    NoteID = Column(String(32), primary_key=True)
    NoteText = Column(Text, nullable=True)
    attachments_str = Column(Text, nullable=True)
    attachments = relationship("Attachment", back_populates="note", cascade="all, delete-orphan")

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String(32), ForeignKey("notes.NoteID"))
    filename = Column(String(255))
    url = Column(String(1024))
    note = relationship("Note", back_populates="attachments")

class Dependency(Base):
    __tablename__ = "dependencies"
    DepID = Column(Integer, primary_key=True, autoincrement=True)
    TaskID = Column(Integer, nullable=False)       # successor
    PreTaskID = Column(Integer, nullable=False)    # predecessor
    Type = Column(String(8), default="FS")         # FS, SS, FF, SF
    Lag = Column(Integer, default=0)               # days

class Connection(Base):
    __tablename__ = "connections"
    ConnID = Column(String(32), primary_key=True)
    FromID = Column(String(64))
    ToID = Column(String(64))
    Color = Column(String(32), default="#2b7cff")
    Style = Column(String(16), default="solid")
    Label = Column(String(255), default="")
    FromAnchor = Column(String(128), nullable=True)   # store "x,y"
    ToAnchor = Column(String(128), nullable=True)

# --- create / seed db ---
def create_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Task).count() == 0:
            t1 = Task(ProjectID="P1", ParentTaskID=None, TaskName="项目启动",
                      Start=date(2025,12,2), End=date(2025,12,5), Assignee="小王", NoteID="N1")
            db.add(t1); db.flush()
            t2 = Task(ProjectID="P1", ParentTaskID=t1.TaskID, TaskName="需求确认",
                      Start=date(2025,12,4), End=date(2025,12,10), Assignee="小李", NoteID="N2")
            db.add(t2)
            n1 = Note(NoteID="N1", NoteText="负责人：小王\n说明：负责需求收集", attachments_str="")
            n2 = Note(NoteID="N2", NoteText="负责人：小李\n说明：整理需求文档", attachments_str="")
            db.add_all([n1, n2])
            db.commit()
    finally:
        db.close()

create_db()

# --- helpers ---
def task_to_dict(t: Task):
    return {
        "TaskID": int(t.TaskID),
        "ProjectID": t.ProjectID,
        "ParentTaskID": int(t.ParentTaskID) if t.ParentTaskID is not None else None,
        "TaskName": t.TaskName,
        "Start": t.Start.isoformat() if t.Start else None,
        "End": t.End.isoformat() if t.End else None,
        "Assignee": t.Assignee,
        "NoteID": t.NoteID
    }

def note_to_dict(n: Note):
    attachments = []
    if n.attachments:
        for a in n.attachments:
            attachments.append({"filename": a.filename, "url": a.url})
    # legacy attachments_str (semicolon separated filenames)
    if n.attachments_str:
        for s in str(n.attachments_str).split(";"):
            if not s: 
                continue
            # avoid duplicates
            if not any(a["filename"] == s or a["url"].endswith(s) for a in attachments):
                attachments.append({"filename": s, "url": f"/uploads/{s}"})
    return {"NoteID": n.NoteID, "NoteText": n.NoteText or "", "Attachments": attachments}

# --- routes: tasks ---
@app.route('/api/tasks', methods=['GET'])
def api_get_tasks():
    db = SessionLocal()
    try:
        rows = db.query(Task).order_by(Task.TaskID).all()
        tasks = [task_to_dict(r) for r in rows]
        dates = []
        for t in tasks:
            if t["Start"]: dates.append(date.fromisoformat(t["Start"]))
            if t["End"]: dates.append(date.fromisoformat(t["End"]))
        min_date = min(dates).isoformat() if dates else None
        max_date = max(dates).isoformat() if dates else None
        return jsonify({"tasks": tasks, "min_date": min_date, "max_date": max_date})
    finally:
        db.close()

@app.route('/api/tasks', methods=['POST'])
def api_create_or_update_task():
    data = request.get_json()
    if not data:
        return jsonify({"error":"no json"}), 400
    db = SessionLocal()
    try:
        if "TaskID" in data and data.get("TaskID"):
            tid = int(data["TaskID"])
            try:
                t = db.query(Task).filter(Task.TaskID==tid).one()
            except NoResultFound:
                return jsonify({"error":"TaskID not found"}), 404
            for col in ["ProjectID","ParentTaskID","TaskName","Start","End","Assignee","NoteID"]:
                if col in data:
                    val = data[col]
                    if col in ["Start","End"] and val:
                        val = date.fromisoformat(val)
                    setattr(t, col, val)
            db.commit()
            return jsonify({"ok":True}), 200
        else:
            new_task = Task(
                ProjectID = data.get("ProjectID"),
                ParentTaskID = data.get("ParentTaskID"),
                TaskName = data.get("TaskName") or "新任务",
                Start = date.fromisoformat(data["Start"]) if data.get("Start") else None,
                End = date.fromisoformat(data["End"]) if data.get("End") else None,
                Assignee = data.get("Assignee"),
                NoteID = data.get("NoteID"),
            )
            db.add(new_task)
            db.commit()
            return jsonify({"ok":True, "TaskID": new_task.TaskID}), 200
    finally:
        db.close()

@app.route('/api/tasks/<int:taskid>', methods=['PATCH'])
def api_patch_task(taskid):
    payload = request.get_json()
    if not payload:
        return jsonify({"error":"no json"}), 400
    db = SessionLocal()
    try:
        try:
            t = db.query(Task).filter(Task.TaskID==taskid).one()
        except NoResultFound:
            return jsonify({"error":"not found"}), 404
        if "Start" in payload:
            t.Start = date.fromisoformat(payload["Start"]) if payload["Start"] else None
        if "End" in payload:
            t.End = date.fromisoformat(payload["End"]) if payload["End"] else None
        db.commit()
        return jsonify({"ok": True}), 200
    finally:
        db.close()

# --- routes: notes ---
@app.route('/api/notes/<noteid>', methods=['GET'])
def api_get_note(noteid):
    db = SessionLocal()
    try:
        n = db.query(Note).filter(Note.NoteID==noteid).first()
        if not n:
            return jsonify({"error":"not found"}), 404
        return jsonify(note_to_dict(n))
    finally:
        db.close()

@app.route('/api/notes', methods=['POST'])
def api_create_or_update_note():
    data = request.get_json()
    if not data:
        return jsonify({"error":"no json"}), 400
    db = SessionLocal()
    try:
        attachments = data.get("Attachments", [])
        if "NoteID" in data and data.get("NoteID"):
            nid = data["NoteID"]
            n = db.query(Note).filter(Note.NoteID==nid).first()
            if n:
                n.NoteText = data.get("NoteText", n.NoteText)
                if attachments is not None:
                    n.attachments = []
                    for a in attachments:
                        if isinstance(a, dict):
                            url = a.get("url"); filename = a.get("filename") or (url.split("/")[-1] if url else "")
                        else:
                            url = str(a); filename = url.split("/")[-1]
                        n.attachments.append(Attachment(filename=filename, url=url))
                db.commit()
                return jsonify({"ok":True}), 200
            else:
                new = Note(NoteID=nid, NoteText=data.get("NoteText",""))
                for a in attachments or []:
                    if isinstance(a, dict):
                        url = a.get("url"); filename = a.get("filename") or (url.split("/")[-1] if url else "")
                    else:
                        url = str(a); filename = url.split("/")[-1]
                    new.attachments.append(Attachment(filename=filename, url=url))
                db.add(new); db.commit()
                return jsonify({"ok":True, "NoteID": nid}), 200
        else:
            new_nid = "N" + uuid.uuid4().hex[:8]
            new = Note(NoteID=new_nid, NoteText=data.get("NoteText",""))
            for a in attachments or []:
                if isinstance(a, dict):
                    url = a.get("url"); filename = a.get("filename") or (url.split("/")[-1] if url else "")
                else:
                    url = str(a); filename = url.split("/")[-1]
                new.attachments.append(Attachment(filename=filename, url=url))
            db.add(new); db.commit()
            return jsonify({"ok":True, "NoteID": new_nid}), 200
    finally:
        db.close()

# --- routes: connections ---
@app.route('/api/connections', methods=['GET'])
def api_get_connections():
    db = SessionLocal()
    try:
        rows = db.query(Connection).all()
        conns = []
        for r in rows:
            conns.append({
                "ConnID": r.ConnID,
                "FromID": r.FromID,
                "ToID": r.ToID,
                "Color": r.Color,
                "Style": r.Style,
                "Label": r.Label,
                "FromAnchor": r.FromAnchor,
                "ToAnchor": r.ToAnchor
            })
        return jsonify({"connections": conns})
    finally:
        db.close()

@app.route('/api/connections', methods=['POST'])
def api_create_connection():
    data = request.get_json()
    if not data:
        return jsonify({'error':'no json'}), 400
    db = SessionLocal()
    try:
        new_id = "C" + uuid.uuid4().hex[:8]
        entry = Connection(
            ConnID=new_id,
            FromID = data.get('FromID'),
            ToID = data.get('ToID'),
            Color = data.get('Color', '#2b7cff'),
            Style = data.get('Style', 'solid'),
            Label = data.get('Label', ''),
            FromAnchor = data.get('FromAnchor', None),
            ToAnchor = data.get('ToAnchor', None)
        )
        db.add(entry); db.commit()
        return jsonify({'ok':True, 'ConnID': new_id}), 200
    finally:
        db.close()

@app.route('/api/connections/<connid>', methods=['DELETE'])
def api_delete_connection(connid):
    db = SessionLocal()
    try:
        r = db.query(Connection).filter(Connection.ConnID==connid).first()
        if not r:
            return jsonify({"error":"not found"}), 404
        db.delete(r); db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()

# --- routes: dependencies (CRUD) ---
@app.route('/api/dependencies', methods=['GET'])
def api_get_dependencies():
    t = request.args.get('task')
    db = SessionLocal()
    try:
        q = db.query(Dependency)
        if t:
            q = q.filter((Dependency.TaskID==int(t)) | (Dependency.PreTaskID==int(t)))
        rows = q.all()
        out = []
        for r in rows:
            out.append({"DepID": r.DepID, "TaskID": r.TaskID, "PreTaskID": r.PreTaskID, "Type": r.Type, "Lag": r.Lag})
        return jsonify({"dependencies": out})
    finally:
        db.close()

@app.route('/api/dependencies', methods=['POST'])
def api_create_dependency():
    data = request.get_json()
    if not data: return jsonify({"error":"no json"}), 400
    db = SessionLocal()
    try:
        dep = Dependency(TaskID=int(data["TaskID"]), PreTaskID=int(data["PreTaskID"]),
                         Type=data.get("Type","FS"), Lag=int(data.get("Lag",0)))
        db.add(dep); db.commit()
        return jsonify({"ok":True, "DepID": dep.DepID})
    finally:
        db.close()

@app.route('/api/dependencies/<int:depid>', methods=['DELETE'])
def api_delete_dependency(depid):
    db = SessionLocal()
    try:
        r = db.query(Dependency).filter(Dependency.DepID==depid).first()
        if not r: return jsonify({"error":"not found"}), 404
        db.delete(r); db.commit()
        return jsonify({"ok":True})
    finally:
        db.close()

# --- scheduling (CPM) ---
def compute_schedule_and_update(db_session):
    # load tasks
    tasks = {t.TaskID: t for t in db_session.query(Task).all()}
    if not tasks:
        return {"result": {}, "project_finish": 0, "critical": []}

    # durations
    dur = {}
    for tid, t in tasks.items():
        if t.Start and t.End:
            d = (t.End - t.Start).days + 1
            dur[tid] = d if d > 0 else 1
        else:
            dur[tid] = 1

    # build preds/succs
    preds = defaultdict(list)
    succs = defaultdict(list)
    for d in db_session.query(Dependency).all():
        preds[d.TaskID].append((d.PreTaskID, d.Type or "FS", d.Lag or 0))
        succs[d.PreTaskID].append((d.TaskID, d.Type or "FS", d.Lag or 0))

    # topological sort
    indeg = {tid: 0 for tid in tasks}
    for u in tasks:
        for (suc,typ,lag) in succs.get(u,[]):
            indeg[suc] = indeg.get(suc,0) + 1
    q = deque([tid for tid,v in indeg.items() if v==0])
    topo = []
    while q:
        n = q.popleft(); topo.append(n)
        for (suc,typ,lag) in succs.get(n,[]):
            indeg[suc] -= 1
            if indeg[suc]==0: q.append(suc)
    if len(topo) != len(tasks):
        return {"error":"dependency cycle detected"}

    # forward pass ES/EF
    ES = {tid: 0 for tid in tasks}
    EF = {tid: dur[tid] for tid in tasks}
    for n in topo:
        best_es = ES.get(n,0)
        for (p,typ,lag) in preds.get(n,[]):
            if typ == "FS":
                cand = EF[p] + lag
            elif typ == "SS":
                cand = ES[p] + lag
            elif typ == "FF":
                cand = EF[p] + lag - dur[n]
            elif typ == "SF":
                cand = ES[p] + lag - dur[n]
            else:
                cand = EF[p] + lag
            if cand > best_es: best_es = cand
        ES[n] = best_es
        EF[n] = ES[n] + dur[n]

    # backward pass LS/LF
    project_finish = max(EF.values()) if EF else 0
    LF = {tid: project_finish for tid in tasks}
    LS = {tid: LF[tid] - dur[tid] for tid in tasks}
    for n in reversed(topo):
        best_lf = LF.get(n, project_finish)
        for (suc,typ,lag) in succs.get(n,[]):
            if typ == "FS":
                cand = LS[suc] - lag
            elif typ == "SS":
                cand = ES[suc] - lag
            elif typ == "FF":
                cand = LF[suc] - lag
            elif typ == "SF":
                cand = ES[suc] - lag + dur[n]
            else:
                cand = LS[suc] - lag
            if cand < best_lf: best_lf = cand
        LF[n] = best_lf
        LS[n] = LF[n] - dur[n]

    slack = {tid: LS[tid] - ES[tid] for tid in tasks}
    critical = [tid for tid,s in slack.items() if s == 0]

    # baseline date: min existing Start if any, else today
    existing_dates = [t.Start for t in tasks.values() if t.Start]
    baseline = min(existing_dates) if existing_dates else date.today()

    # write back computed schedule (ES -> Start, EF-1 -> End)
    for tid, t in tasks.items():
        new_start = baseline + timedelta(days=ES[tid])
        new_end = baseline + timedelta(days=EF[tid]-1)
        t.Start = new_start
        t.End = new_end
    db_session.commit()

    result = {}
    for tid in tasks:
        result[tid] = {
            "TaskID": tid,
            "Duration": dur[tid],
            "ES": ES[tid],
            "EF": EF[tid],
            "LS": LS[tid],
            "LF": LF[tid],
            "Slack": slack[tid],
            "Critical": tid in critical,
            "Start": (baseline + timedelta(days=ES[tid])).isoformat(),
            "End": (baseline + timedelta(days=EF[tid]-1)).isoformat()
        }
    return {"result": result, "project_finish": project_finish, "critical": critical}

@app.route('/api/schedule/run', methods=['POST'])
def api_run_schedule():
    db = SessionLocal()
    try:
        res = compute_schedule_and_update(db)
        if "error" in res:
            return jsonify(res), 400
        return jsonify(res)
    finally:
        db.close()

# --- upload / static / download ---
@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error':'no file part'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error':'empty filename'}), 400
    fn = f"{uuid.uuid4().hex[:8]}_{f.filename}"
    dest = os.path.join(UPLOAD_DIR, fn)
    f.save(dest)
    url = f"/uploads/{fn}"
    return jsonify({'url': url, 'filename': fn})

@app.route('/uploads/<path:fname>')
def uploaded_file(fname):
    path = os.path.join(UPLOAD_DIR, fname)
    if os.path.exists(path):
        return send_from_directory(UPLOAD_DIR, fname)
    else:
        abort(404)

@app.route('/download_db')
def download_db():
    if os.path.exists(DB_FILE):
        return send_file(DB_FILE, as_attachment=True)
    else:
        abort(404)

# serve frontend (if built)
@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    create_db()
    app.run(debug=True, port=6868)
