# app.py
import os
import uuid
import json
from datetime import datetime, date
from flask import Flask, jsonify, request, send_from_directory, abort, send_file
import pandas as pd
from filelock import FileLock

DATA_XLSX = "data.xlsx"
UPLOAD_DIR = "uploads"
LOCKFILE = DATA_XLSX + ".lock"

# Ensure dirs
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, static_folder="static", static_url_path="/static")

# Utilities for Excel storage
def ensure_workbook():
    """
    If data.xlsx doesn't exist, create with sample Tasks and Notes sheets.
    """
    if not os.path.exists(DATA_XLSX):
        tasks = pd.DataFrame([
            {"TaskID": 1, "ProjectID": "P1", "ParentTaskID": None, "TaskName": "项目启动", "Start": "2025-12-02", "End": "2025-12-05", "Assignee": "小王", "NoteID": "N1"},
            {"TaskID": 2, "ProjectID": "P1", "ParentTaskID": 1, "TaskName": "需求确认", "Start": "2025-12-04", "End": "2025-12-10", "Assignee": "小李", "NoteID": "N2"},
            {"TaskID": 3, "ProjectID": "P1", "ParentTaskID": None, "TaskName": "开发", "Start": "2025-12-07", "End": "2025-12-20", "Assignee": "小张", "NoteID": "N3"},
        ])
        notes = pd.DataFrame([
            {"NoteID": "N1", "NoteText": "负责人：小王\n说明：负责需求收集\n附件:"},
            {"NoteID": "N2", "NoteText": "负责人：小李\n说明：整理需求文档\n附件:"},
            {"NoteID": "N3", "NoteText": "负责人：小张\n说明：开发主任务\n附件:"},
        ])
        with FileLock(LOCKFILE):
            with pd.ExcelWriter(DATA_XLSX, engine="openpyxl") as writer:
                tasks.to_excel(writer, sheet_name="Tasks", index=False)
                notes.to_excel(writer, sheet_name="Notes", index=False)

def read_dataframes():
    ensure_workbook()
    with FileLock(LOCKFILE):
        df_tasks = pd.read_excel(DATA_XLSX, sheet_name="Tasks", engine="openpyxl")
        df_notes = pd.read_excel(DATA_XLSX, sheet_name="Notes", engine="openpyxl")
    # Normalize dates to ISO strings
    df_tasks['Start'] = pd.to_datetime(df_tasks['Start']).dt.date
    df_tasks['End'] = pd.to_datetime(df_tasks['End']).dt.date
    return df_tasks, df_notes

def write_dataframes(df_tasks, df_notes):
    with FileLock(LOCKFILE):
        with pd.ExcelWriter(DATA_XLSX, engine="openpyxl", mode="w") as writer:
            df_tasks.to_excel(writer, sheet_name="Tasks", index=False)
            df_notes.to_excel(writer, sheet_name="Notes", index=False)

# APIs

@app.route("/api/tasks", methods=["GET"])
def api_get_tasks():
    df_tasks, df_notes = read_dataframes()
    tasks = []
    for _, r in df_tasks.iterrows():
        tasks.append({
            "TaskID": int(r["TaskID"]),
            "ProjectID": r.get("ProjectID", None),
            "ParentTaskID": int(r["ParentTaskID"]) if pd.notna(r.get("ParentTaskID", None)) else None,
            "TaskName": r.get("TaskName", ""),
            "Start": r["Start"].isoformat() if not pd.isna(r["Start"]) else None,
            "End": r["End"].isoformat() if not pd.isna(r["End"]) else None,
            "Assignee": r.get("Assignee", ""),
            "NoteID": r.get("NoteID", "")
        })
    # also return min/max dates for rendering range
    dates = []
    for t in tasks:
        if t["Start"]: dates.append(date.fromisoformat(t["Start"]))
        if t["End"]: dates.append(date.fromisoformat(t["End"]))
    min_date = min(dates).isoformat() if dates else None
    max_date = max(dates).isoformat() if dates else None
    return jsonify({"tasks": tasks, "min_date": min_date, "max_date": max_date})

@app.route("/api/tasks", methods=["POST"])
def api_create_or_update_task():
    data = request.get_json()
    if not data:
        return jsonify({"error":"no json"}), 400
    df_tasks, df_notes = read_dataframes()
    # Expect TaskID for update; if not present -> create new ID
    if "TaskID" in data and data["TaskID"] is not None:
        # update existing
        tid = int(data["TaskID"])
        if tid in df_tasks['TaskID'].values:
            idx = df_tasks.index[df_tasks['TaskID'] == tid][0]
            # update fields
            for col in ["ProjectID","ParentTaskID","TaskName","Start","End","Assignee","NoteID"]:
                if col in data:
                    df_tasks.at[idx, col] = data[col]
        else:
            return jsonify({"error":"TaskID not found"}), 404
    else:
        # create new ID
        new_id = int(df_tasks['TaskID'].max()) + 1 if not df_tasks.empty else 1
        entry = {
            "TaskID": new_id,
            "ProjectID": data.get("ProjectID"),
            "ParentTaskID": data.get("ParentTaskID"),
            "TaskName": data.get("TaskName"),
            "Start": data.get("Start"),
            "End": data.get("End"),
            "Assignee": data.get("Assignee"),
            "NoteID": data.get("NoteID"),
        }
        df_tasks = pd.concat([df_tasks, pd.DataFrame([entry])], ignore_index=True)
    write_dataframes(df_tasks, df_notes)
    return jsonify({"ok": True}), 200

@app.route("/api/tasks/<int:taskid>", methods=["DELETE"])
def api_delete_task(taskid):
    df_tasks, df_notes = read_dataframes()
    if taskid not in df_tasks['TaskID'].values:
        return jsonify({"error":"not found"}), 404
    df_tasks = df_tasks[df_tasks['TaskID'] != taskid]
    write_dataframes(df_tasks, df_notes)
    return jsonify({"ok": True})

@app.route("/api/notes/<noteid>", methods=["GET"])
def api_get_note(noteid):
    _, df_notes = read_dataframes()
    sel = df_notes[df_notes['NoteID'] == noteid]
    if sel.empty:
        return jsonify({"error":"not found"}), 404
    row = sel.iloc[0]
    attachments = []
    att_field = row.get("Attachments", "")
    if isinstance(att_field, str) and att_field.strip():
        attachments = [a for a in att_field.split(";") if a]
    return jsonify({"NoteID": row["NoteID"], "NoteText": row.get("NoteText", ""), "Attachments": attachments})

@app.route("/api/notes", methods=["POST"])
def api_create_or_update_note():
    data = request.get_json()
    if not data:
        return jsonify({"error":"no json"}), 400
    df_tasks, df_notes = read_dataframes()
    if "NoteID" in data and data["NoteID"]:
        nid = data["NoteID"]
        if nid in df_notes['NoteID'].values:
            idx = df_notes.index[df_notes['NoteID'] == nid][0]
            df_notes.at[idx, 'NoteText'] = data.get("NoteText", df_notes.at[idx,'NoteText'])
            df_notes.at[idx, 'Attachments'] = data.get("Attachments", df_notes.at[idx,'Attachments'])
        else:
            # create with provided NoteID
            entry = {"NoteID": nid, "NoteText": data.get("NoteText", ""), "Attachments": data.get("Attachments","")}
            df_notes = pd.concat([df_notes, pd.DataFrame([entry])], ignore_index=True)
    else:
        # create new NoteID
        new_nid = "N" + str(uuid.uuid4())[:8]
        entry = {"NoteID": new_nid, "NoteText": data.get("NoteText", ""), "Attachments": data.get("Attachments","")}
        df_notes = pd.concat([df_notes, pd.DataFrame([entry])], ignore_index=True)
    write_dataframes(df_tasks, df_notes)
    return jsonify({"ok": True}), 200

@app.route("/api/upload", methods=["POST"])
def api_upload():
    """
    Accept file upload in form-data under 'file'; save to uploads/ and return file URL.
    """
    if 'file' not in request.files:
        return jsonify({"error":"no file part"}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({"error":"empty filename"}), 400
    # sanitize filename by prefixing uuid
    fn = f"{uuid.uuid4().hex[:8]}_{f.filename}"
    dest = os.path.join(UPLOAD_DIR, fn)
    f.save(dest)
    # Return URL to fetch file
    url = f"/uploads/{fn}"
    return jsonify({"url": url, "filename": fn})

@app.route("/uploads/<path:fname>")
def uploaded_file(fname):
    path = os.path.join(UPLOAD_DIR, fname)
    if os.path.exists(path):
        # send as attachment or inline depending on type
        return send_from_directory(UPLOAD_DIR, fname)
    else:
        abort(404)

@app.route("/download_excel")
def download_excel():
    ensure_workbook()
    return send_file(DATA_XLSX, as_attachment=True)

# Serve frontend entry
@app.route("/")
def index():
    return app.send_static_file("index.html")

if __name__ == "__main__":
    ensure_workbook()
    app.run(debug=True, port=6666)
