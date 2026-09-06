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

- **Frontend (Web)**: React 18, Vite, Tailwind CSS, Lucide React Icons, Recharts, Motion
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
   JWT_SECRET=studylens_ai_jwt_secret_key_2026
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

Copy `backend/.env.example` to `backend/.env` and add your Groq key (see *Environment Setup* above). MySQL is optional — the app auto-falls back to SQLite if MySQL is unreachable.

> **First-time MySQL setup (optional):** if an older/imported `studylens_db` schema already exists, the app detects the mismatch and prints an instruction. Rebuild it once with:
> ```bash
> python backend/scripts/reset_db.py --yes
> ```
> *(This drops and recreates all tables in the configured database, then re-seeds the capstone demo data.)*

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

---

## 👤 Capstone Project Team & Pre-configured Accounts

> **Institution**: University of Cebu – Main Campus, College of Computer Studies (UC CCS)  
> **Degree**: Bachelor of Science in Information Technology (BSIT)

### 🔑 Demo Credentials

The system ships with two seeded demo accounts (a teacher and an administrator) for local development only. Students and additional teachers can **self-register** from the sign-up form. Portal switching / 1-click quick logins were removed for security — **sign in normally** (web or mobile).

> Note: Seeded demo account passwords are **not published** and are generated/configured at deploy time. Demo seeding is disabled outside development environments.

> After **5 consecutive failed login attempts**, an account is temporarily locked for **5 minutes**. Forgot-password uses a 6-digit one-time code (see *OTP delivery* below).

### OTP delivery for password reset

There is no SMTP mail service wired up. When a reset code is requested:
- The 6-digit code is **printed to the backend console** (`[Auth] Password reset OTP for <email>: <code>`).
- With `OTP_DEV_REVEAL=true` (default in `backend/.env`), the code is also returned as `devCode` in the API response so the web/mobile forgot-password modal can show it as a hint. Set `OTP_DEV_REVEAL=false` in production and connect a real mailer.

### Seed Accounts (seeded profiles)

> The seeded teacher and admin accounts are provisioned for the demo. Student accounts are **not seeded** — they are created by signing up through the registration form.

| Role | Name | Capstone Designation | Email | Permissions & Workflows |
|---|---|---|---|---|
| **Teacher** | Christian C. Barral, MIT | Capstone Adviser | `teacher@studylens.edu` | Subject roster management, quiz builder, grading queue, and material uploads. |
| **Admin** | Neil A. Basabe, DIT | College Dean | `admin@studylens.edu` | Account directory, security audit trail, system metrics, and MySQL database monitoring. |

---

## 📄 License

This project is licensed under the **MIT License**.
