# app.py
import os
import uuid
from datetime import datetime, date
from flask import Flask, jsonify, request, send_from_directory, abort, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import NoResultFound

# Config
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

# Models
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
    # attachments are in Attachment table; keep a denormalized attachments_str for backward compatibility if needed
    attachments_str = Column(Text, nullable=True)

    attachments = relationship("Attachment", back_populates="note", cascade="all, delete-orphan")

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String(32), ForeignKey("notes.NoteID"))
    filename = Column(String(255))
    url = Column(String(1024))
    note = relationship("Note", back_populates="attachments")

class Connection(Base):
    __tablename__ = "connections"
    ConnID = Column(String(32), primary_key=True)
    FromID = Column(String(64))
    ToID = Column(String(64))
    Color = Column(String(32), default="#2b7cff")
    Style = Column(String(16), default="solid")
    Label = Column(String(255), default="")

# Create DB / tables
def create_db():
    Base.metadata.create_all(bind=engine)
    # create example data if empty
    db = SessionLocal()
    try:
        tcount = db.query(Task).count()
        if tcount == 0:
            # sample tasks
            t1 = Task(ProjectID="P1", ParentTaskID=None, TaskName="项目启动", Start=date(2025,12,2), End=date(2025,12,5), Assignee="小王", NoteID="N1")
            t2 = Task(ProjectID="P1", ParentTaskID=1, TaskName="需求确认", Start=date(2025,12,4), End=date(2025,12,10), Assignee="小李", NoteID="N2")
            db.add_all([t1, t2])
            # sample notes
            n1 = Note(NoteID="N1", NoteText="负责人：小王\\n说明：负责需求收集", attachments_str="")
            n2 = Note(NoteID="N2", NoteText="负责人：小李\\n说明：整理需求文档", attachments_str="")
            db.add_all([n1, n2])
            db.commit()
    finally:
        db.close()

create_db()

# Helpers
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
    attachments = [ {"filename": a.filename, "url": a.url} for a in n.attachments ] if n.attachments else []
    # also parse attachments_str for backward compat (semicolon separated)
    if n.attachments_str:
        for s in str(n.attachments_str).split(";"):
            if s:
                # if not already present
                if not any(a["url"].endswith(s) or a["filename"] == s for a in attachments):
                    attachments.append({"filename": s, "url": f"/uploads/{s}"})
    return {
        "NoteID": n.NoteID,
        "NoteText": n.NoteText or "",
        "Attachments": attachments
    }

# Routes

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
            # update existing
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
            # create
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
        if isinstance(attachments, list):
            # attachments expected as list of urls or {"url", "filename"}
            pass
        if "NoteID" in data and data.get("NoteID"):
            # update
            nid = data["NoteID"]
            n = db.query(Note).filter(Note.NoteID==nid).first()
            if n:
                n.NoteText = data.get("NoteText", n.NoteText)
                # handle attachments: replace attachments table entries
                if attachments is not None:
                    # clear existing
                    n.attachments = []
                    for a in attachments:
                        if isinstance(a, dict):
                            url = a.get("url")
                            filename = a.get("filename") or (url.split("/")[-1] if url else "")
                        else:
                            url = str(a)
                            filename = url.split("/")[-1]
                        n.attachments.append(Attachment(filename=filename, url=url))
                db.commit()
                return jsonify({"ok":True}), 200
            else:
                # create with specified NoteID
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
            # create new Note with generated ID
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
                "Label": r.Label
            })
        return jsonify({"connections": conns})
    finally:
        db.close()

@app.route('/api/connections', methods=['POST'])
def api_create_connection():
    data = request.get_json()
    if not data:
        return jsonify({"error":"no json"}), 400
    db = SessionLocal()
    try:
        new_id = "C" + uuid.uuid4().hex[:8]
        entry = Connection(
            ConnID=new_id,
            FromID = data.get("FromID"),
            ToID = data.get("ToID"),
            Color = data.get("Color", "#2b7cff"),
            Style = data.get("Style", "solid"),
            Label = data.get("Label", "")
        )
        db.add(entry)
        db.commit()
        return jsonify({"ok": True, "ConnID": new_id}), 200
    finally:
        db.close()

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

@app.route('/download_excel')
def download_excel():
    # For backward compatibility keep endpoint, but we now use SQLite.
    # Offer to download the SQLite DB file (or CSV export). We'll return the SQLite DB.
    if os.path.exists(DB_FILE):
        return send_file(DB_FILE, as_attachment=True)
    else:
        abort(404)

# Serve frontend (if built)
@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    create_db()
    app.run(debug=True, port=6868)
