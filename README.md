# StudyLens AI: An Adaptive Learning and Automated Assessment Generation Platform

> **UN Sustainable Development Goals (SDGs):**
> - 🎓 **SDG 4: Quality Education**
> - 💡 **SDG 9: Industry, Innovation, and Infrastructure**

---

## 📖 Project Overview

**StudyLens AI** is an adaptive web and mobile learning support platform engineered for students and teachers. It leverages artificial intelligence powered by **Groq Inference** to automatically transform uploaded lecture notes, PDFs, DOCX documents, or textbook images into interactive Bloom's taxonomy quizzes, executive summaries, comprehensive study reviewers, and active recall flashcard decks. 

The platform adapts dynamically to student performance trends, providing personalized topic recommendations for review. Teachers can auto-generate exams with answer keys, edit generated questions, manage course subjects, track class performance, and export assessment formats (PDF/DOCX).

---

## 🛠️ Technology Stack (per Specification)

- **Frontend (Web)**: React 19, Vite 7, Tailwind CSS 4, Lucide React Icons, Recharts, Motion
- **Mobile App**: React-Native (Mobile learning mode for on-the-go study)
- **Backend API**: Python - Flask (`backend/app.py`, REST API framework)
- **Database**: MySQL (via Flask-SQLAlchemy ORM with SQLite fallback support)
- **Authentication**: JSON Web Token (JWT) with Role-Based Access Control (`Student`, `Teacher`, `Administrator`)
- **Cloud Storage**: Cloudinary & Firebase Storage (for uploaded PDFs, DOCX, and lecture modules)
- **AI Integration**: Groq Inference (official `openai` SDK pointed at Groq's OpenAI-compatible endpoint, GPT-OSS-120B with Llama-3.3-70b fallback)

---

## 📁 Project Structure

```
StudyLens-AI/
├─ backend/            Python Flask REST API (app.py, Groq AI, cloud storage, DB)
├─ frontend/           React web app (Vite build: src/, server.ts, configs, node_modules)
├─ mobile/             React-Native mobile app (Expo: App.tsx, src/)
├─ scripts/            Dev orchestrator (scripts/dev.js starts Flask + Vite)
├─ package.json        Root orchestration scripts (npm run dev / build / lint)
├─ README.md
└─ .gitignore
```

---

## ✨ System Functionalities & Workflows

### 🎓 For Students
1. **AI-Powered Quiz Generator**: Automatically creates adaptive quizzes from uploaded lecture files.
2. **AI-Generated Summaries & Reviewers**: Synthesizes key takeaways, topic summaries, and study guides.
3. **Automatic Flashcard Creation**: Generates 3D active-recall flashcard decks with self-rated difficulty.
4. **Personalized Learning Path Recommendation**: Recommends review topics based on weak performance areas.
5. **Performance Analytics Dashboard**: Tracks accuracy across Bloom's Taxonomy cognitive levels.
6. **Save & Organize Study Materials**: Organizes course and personal study resources.
7. **Mobile Learning Mode**: React-Native mobile interface for on-the-go study.

### 👩‍🏫 For Teachers
1. **Upload Lecture Materials**: Uploads lecture slides and notes for AI processing.
2. **Auto-Generation of Quizzes/Exams**: Creates structured assessments complete with answer keys.
3. **Class Performance Overview**: Evaluates student test submissions and score distributions.
4. **Manual Editing**: Refines AI-generated quiz questions before distribution.
5. **Quiz Distribution**: Publishes quizzes and flashcards directly to enrolled class rosters.
6. **Exportable Formats**: Exports tests to printable PDF/DOCX formats.

### 🛡️ For Administrators
1. **Manage Student & Teacher Accounts**: User directory management, credential reset, and status control.
2. **Monitor Usage Statistics & Activity**: Executive system metrics and real-time security audit trails.
3. **Content Moderation**: Oversees institutional announcements and uploaded materials.
4. **Server & Database Monitoring**: Tracks server uptime, MySQL database connectivity, and API response latencies.

---

## 📋 Prerequisites

- **Python**: v3.10 or higher
- **Node.js**: v18.x or higher
- **npm** or **bun**
- **MySQL Database Server**: (Optional; SQLite file fallback is enabled out-of-the-box)
- **Groq Inference API Key**: Get a free API key at [Groq Console](https://console.groq.com/keys/)

---

## ⚙️ Environment Setup

1. Copy `backend/.env.example` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Configure your environment variables in `backend/.env`:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
   MYSQL_DATABASE_URL=mysql+pymysql://root:password@localhost:3306/studylens_db
   FLASK_PORT=5000
   ```

---

## 🚀 How to Run the System

### 1. Install Dependencies

**Python Backend Dependencies:**
```bash
pip install -r backend/requirements.txt
```

**Web Frontend Dependencies:**
```bash
cd frontend
npm install
```

### 2. Configure Environment

Copy `backend/.env.example` to `backend/.env` and add your Groq key (see *Environment Setup* above). MySQL is optional — the app falls back to SQLite only in development.

> **First-time MySQL setup (optional):** if an older/imported `studylens_db` schema already exists, the app detects the mismatch and prints an instruction. Rebuild it once with:
> ```bash
> python backend/scripts/reset_db.py --yes
> ```
> *(This drops and recreates all tables in the configured database. It does **not** seed demo accounts.)*

**Demo data is never seeded automatically.** To provision the demo accounts locally, set `SEED_DEMO_DATA=true` and both strong values for `DEMO_TEACHER_PASSWORD` / `DEMO_ADMIN_PASSWORD` in `backend/.env`, then run:
```bash
python backend/scripts/seed_dev.py
```
Production (`FLASK_ENV=production`) refuses demo seeding.

### 3. Start the Full Stack (Backend + Frontend Together)

From the repo root:
```bash
npm run dev
```
The dev runner boots the Python Flask backend first, waits for it on port `5000`, then starts the React web frontend on `http://localhost:3000`.

Alternatively, run them in separate terminals:
- Backend only: `python backend/app.py` (or `npm run dev:api`)
- Frontend only: `cd frontend && npm run dev` (or `npm run dev:web` from the root)

### 4. Start the React-Native Mobile App (Mobile Mode)

In a separate terminal:
```bash
cd mobile
npm start
```

### 5. Run the Test Suites

```bash
cd backend && python -m pytest -q
cd frontend && npm test
cd mobile && npm test
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and the production build on every push and pull request to `main`.

---

## ☁️ Deploying the Web App + API to Vercel

The manuscript describes a three-tier client-server system (Flask API, MySQL, cloud storage, AI inference). Vercel hosts the **web SPA and the Flask API**; MySQL, file storage, and AI remain managed external services.

### Architecture

```
Browser / Mobile
      │
      ▼
Vercel: studylens-web  (root = frontend/)
      │  /api/* and /uploads/* proxied (same-origin cookies)
      ▼
Vercel: studylens-api  (root = backend/, Flask)
      ├── TiDB Cloud Starter (MySQL)   ← required
      ├── Cloudinary                   ← required for durable uploads
      ├── Groq API                     ← GROQ_API_KEY
      ├── Upstash Redis (optional)     ← shared rate limiting
      └── Gmail SMTP                   ← OTP email
```

### 1. Provision external services

1. **TiDB Cloud Starter (MySQL-compatible)** — create a Starter instance in **AWS Singapore (`aws-ap-southeast-1`)** and set the **spending limit to $0** (quota exhaustion refuses new connections instead of billing). In **Connect**, generate the password and download the **CA certificate** to `backend/certs/tidb-ca.pem` (CA certificates are public and safe to commit). Note the host, port (`4000`), user (`<prefix>.root`), and database (`test`). TiDB requires TLS; use the component variables below so the backend URL-encodes the password safely. Free tier: 5 GiB row storage + 50M RU/month.
2. **Cloudinary** — copy `CLOUDINARY_URL` (`cloudinary://<key>:<secret>@<cloud>`). Materials use private/authenticated resources; avatars are public images.
3. **Upstash Redis (recommended)** — copy the `rediss://` connection string.
4. **Gmail** — enable 2-Step Verification, create an App Password, and keep `GMAIL_SENDER` + `GMAIL_APP_PASSWORD` ready.
5. **Groq** — create an API key at <https://console.groq.com/keys>.

### 2. Deploy the API (`studylens-api`)

Import this repository, then configure the project:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Framework Preset | Flask |
| Python version | 3.13 (`.python-version`) |
| Function region | `sin1` (`vercel.json`) |
| Max duration | 300 s (`vercel.json`) |

Add these environment variables (Production):

```env
FLASK_ENV=production
JWT_SECRET=<output of: python -c "import secrets; print(secrets.token_hex(32))">
OTP_PEPPER=<another random 64-hex value>
GROQ_API_KEY=gsk_...
MYSQL_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
MYSQL_PORT=4000
MYSQL_USER=<prefix>.root
MYSQL_PASSWORD=<tidb password>
MYSQL_DB=test
MYSQL_SSL_CA=certs/tidb-ca.pem
DB_POOL_RECYCLE=300
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
ALLOWED_ORIGINS=https://<web-project>.vercel.app
AUTH_COOKIE_SECURE=true
REFRESH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=Lax
REFRESH_COOKIE_SAMESITE=Lax
MAX_UPLOAD_MB=4
RUN_STARTUP_REPAIRS=true
RATE_LIMIT_BACKEND=redis
REDIS_URL=rediss://default:<pw>@<host>:6379
GMAIL_SENDER=<gmail address>
GMAIL_APP_PASSWORD=<16-character app password>
SEED_DEMO_DATA=false
OTP_DEV_REVEAL=false
FLASK_DEBUG=false
ALLOW_SQLITE_FALLBACK=false
ALLOW_LOCAL_FALLBACK=false
LOG_FORMAT=json
```

> Do **not** set `MYSQL_DATABASE_URL` on Vercel when using the component variables above; it overrides them. If you prefer a full URL, change the scheme to `mysql+pymysql`, URL-encode the password, and remove TiDB's `ssl-mode=...` parameter (the backend strips it as a safety net, but PyMySQL rejects it).

Deploy, then poll `https://<api-project>.vercel.app/api/health` until it returns `{"status":"ok","databaseBackend":"mysql","databaseReady":true}`. The first request runs the startup repairs and creates the schema if it does not already exist.

**Create the teacher/admin accounts** (production refuses demo seeding). Run locally against the hosted TiDB database. The backend loads `backend/.env`, so keep the `MYSQL_*` component variables there and switch only `FLASK_ENV` for the seed:

```powershell
$env:FLASK_ENV="development"; $env:SEED_DEMO_DATA="true"
$env:DEMO_TEACHER_PASSWORD="<strong password>"; $env:DEMO_ADMIN_PASSWORD="<strong password>"
python backend/scripts/seed_dev.py
```

Seeding is blocked when `FLASK_ENV=production`, so use `development` locally even though the database is hosted. The script runs `db.create_all()` and migrations; if TiDB rejects a DDL/FK statement, stop and fix the schema rather than deploying a broken API. After the schema exists you can set `RUN_STARTUP_REPAIRS=false` on Vercel to speed up cold starts.

### 3. Deploy the web app (`studylens-web`)

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm ci && npm run build` |
| Output Directory | `dist` |

`frontend/vercel.json` proxies `/api/*` and `/uploads/*` to the API project so cookies, CSRF, and CSP remain same-origin. **Replace `https://studylens-api.vercel.app` with your API project's real domain** before deploying. After the web app is live, set `ALLOWED_ORIGINS` on the API project to that domain and redeploy the API.

### 4. Verify

- `/api/health` reports `databaseReady: true`
- Register a student, sign in, and reload (session cookie)
- Upload a file under 4 MB and open/download it
- Generate a quiz, flashcards, and a summary
- Request a password reset and receive the OTP email
- Mobile: set the server URL on the login screen to `https://<api-project>.vercel.app/api`

### Vercel limitations to know

- **4.5 MB request-body limit.** Keep `MAX_UPLOAD_MB=4`; the UI blocks larger files before upload. Direct-to-Cloudinary uploads are required for larger files.
- **No persistent disk.** Local `uploads/` is ephemeral; production requires Cloudinary (uploads raise a clear error if no cloud target is configured). In development, an unwritable path falls back to the OS temp directory automatically.
- **No MySQL.** Use a managed provider; TiDB Cloud Starter is the documented option.
- **TiDB idle connections.** Starter closes idle connections after 5 minutes; `DB_POOL_RECYCLE=300` and `pool_pre_ping` handle reconnects.
- **TiDB compatibility.** TiDB is MySQL-compatible, not Oracle MySQL. The `seed_dev.py` schema pass is the compatibility check for this app's DDL/FK usage.
- **Multiple instances.** Use `RATE_LIMIT_BACKEND=redis` so rate-limit counters are shared; account lockouts live in the database.
- **Long AI calls.** Vercel Hobby allows up to 300 s per invocation; Groq requests time out at 45 s and degrade gracefully.

---

## 👤 Capstone Project Team & Pre-configured Accounts

> **Institution**: University of Cebu – Main Campus, College of Computer Studies (UC CCS)  
> **Degree**: Bachelor of Science in Information Technology (BSIT)

### 🔑 Demo Credentials

The system can provision two demo accounts (a teacher and an administrator) for local development only, via the explicit seed command described above. Students and additional teachers can **self-register** from the sign-up form. Portal switching / 1-click quick logins were removed for security — **sign in normally** (web or mobile).

> Note: Demo account passwords are **not published**, have no defaults in code, and are configured by the operator. Demo seeding is opt-in and disabled outside development environments.

> After **5 consecutive failed login attempts**, an account is temporarily locked for **5 minutes**. Forgot-password uses a 6-digit one-time code (see *OTP delivery* below).

### OTP delivery for email verification, password reset, and 2FA

One-time codes (email verification, password reset, and staff 2FA) are delivered depending on configuration:

- **Production (email enabled):** set `GMAIL_SENDER` and `GMAIL_APP_PASSWORD` in `backend/.env` — codes are emailed through Gmail SMTP (`smtp.gmail.com`), from your Gmail address to any recipient, and are **never** returned in API responses. Requires 2-Step Verification + an App Password on the sending account.
- **Development (no mailer):** explicitly set `OTP_DEV_REVEAL=true` and join OTPs from the backend console (`[Auth] ... OTP for <email>: <code>`) or the `devCode` response field. This flag is **off by default** and is ignored outside development; production refuses to start with it enabled.

### Seed Accounts (seeded profiles)

> The seeded teacher and admin accounts are provisioned for the demo. Student accounts are **not seeded** — they are created by signing up through the registration form.

| Role | Name | Capstone Designation | Email | Permissions & Workflows |
|---|---|---|---|---|
| **Teacher** | Christian C. Barral, MIT | Capstone Adviser | `teacher@studylens.edu` | Subject roster management, quiz builder, grading queue, and material uploads. |
| **Admin** | Neil A. Basabe, DIT | College Dean | `admin@studylens.edu` | Account directory, security audit trail, system metrics, and MySQL database monitoring. |

---

## 📄 License

This project is licensed under the **MIT License**.
