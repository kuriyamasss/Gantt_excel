# 轻量化项目管理系统（Flask + Excel + 前端甘特图）

本项目是一个 **轻量级项目管理工具**，使用 **Flask 后端 + Excel 数据存储 + 前端 SVG 甘特图渲染** 的方式，让你可以：

- 在浏览器中查看项目任务的甘特图  
- 点击任务条即可查看说明节点（负责人、说明、附件等）  
- 上传附件并自动保存到 uploads 文件夹中  
- 使用 Excel 文件作为存储，不需要数据库  
- 无需安装客户端，直接在浏览器访问即可  

适合个人或小团队快速构建一个直观的项目可视化工具。

---

# 功能特性

### ✔ 甘特图交互显示

- 自动根据任务开始/结束日期渲染甘特条  
- 支持水平滚动、按任务列表定位甘特条  
- 可扩展缩放、颜色分类、子任务折叠等

### ✔ 点击任务显示说明节点

- 显示负责人、备注说明  
- 显示附件列表  
- 支持上传并在线预览附件

### ✔ 数据存储在 Excel（data.xlsx）

后端使用 `openpyxl`+`pandas` 操作 Excel，无需数据库。  
首次运行自动生成示例数据。

### ✔ REST API

前端通过 API 与后端通信，包括：

- `/api/tasks` 读取任务  
- `/api/notes/<NoteID>` 读取说明节点  
- `/api/upload` 上传附件  
- `/download_excel` 下载当前 Excel 数据

---

# 项目结构

```
gantt_flask/
├─ app.py                  # Flask 主程序
├─ requirements.txt        # Python 依赖包列表
├─ data.xlsx               # 自动生成的 Excel 数据文件
├─ uploads/                # 附件存放目录
└─ static/
   ├─ index.html           # 主页面
   ├─ app.js               # 前端逻辑（甘特图渲染、API 请求）
   └─ styles.css           # 页面样式
```

---

# 环境要求

- Python 3.8+
- pip 可用
- Windows / macOS / Linux 均可运行

---

# 安装与运行

## 1. 克隆项目

```
git clone https://github.com/kuriyamasss/Gantt_excel.git
cd Gantt_excel
```

## 2. 可选：使用venv虚拟环境运行项目

```
python -m venv venv
# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate
```

## 3. 安装依赖

```
pip install -r requirements.txt
```

## 4. 运行程序

```
python app.py
```

访问：

```
http://127.0.0.1:6666/
```

---

# 使用方法

### 查看任务甘特图

打开首页即可看到可视化甘特视图。

### 点击任务查看说明

点击任意任务条，会弹出说明节点（负责人、备注、附件等）。

### 上传附件

附件会保存到 `uploads/` 文件夹，并显示在说明节点中。

### 下载 Excel 数据

点击“下载 Excel”即可导出当前系统数据。

---

# 数据存储说明

系统使用一个 `data.xlsx` 文件存储全部数据：

### Sheet1：Tasks

| TaskID | ProjectID | ParentTaskID | TaskName | Start | End | Assignee | NoteID |

### Sheet2：Notes

| NoteID | NoteText | Attachments |

---

# 可扩展方向

- 添加拖拽甘特条调整时间  
- 添加任务依赖关系线  
- 用户登录与权限  
- 使用 SQLite/PostgreSQL 替代 Excel  
- 导出 PDF 甘特图  
- 多项目仪表盘

---

# 许可证

自由使用、修改、商用。
