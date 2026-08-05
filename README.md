# StudyLens AI: An Adaptive Learning and Automated Assessment Generation Platform

---

## 🌟 Key Features & Role-Based Workflows

### 🎓 Student Learning Hub
- **AI Study Assistant & Resource Generator**: Upload lecture slides, PDF syllabi, DOCX papers, or raw notes to generate customized study reviewers, executive summaries, Bloom's taxonomy quizzes, and interactive flashcards.
- **Active Memory Flashcard Engine**: 3D flip card decks with spacebar/click controls, self-rated recall difficulty ratings (Easy, Good, Hard, Again), and AI-powered term explanations.
- **Adaptive Bloom's Taxonomy Quizzes**: Interactive quiz portal featuring randomized answer orders, real-time timer counters, instant AI hints, explanation accordions, and post-quiz weak-topic recommendations.
- **Learning Progress & Knowledge Analytics**: Recharts visual analytics breaking down cognitive performance across Bloom's levels (*Remembering, Understanding, Applying, Analyzing, Evaluating, Creating*), overall accuracy, and study streak tracking.
- **Personal & Course Learning Repository**: Access official course lecture notes uploaded by faculty while maintaining private personal study notes.
- **Institutional Notification Feed**: Real-time announcement center with unread badges, filter tabs, priority tags, and mark-as-read toggles.

### 👩‍🏫 Faculty & Instructor Portal
- **Course & Subject Management**: Overview of active subjects, enrolled student rosters, and uploaded lecture repositories.
- **AI Assessment Generator**: Convert lecture materials directly into tagged quizzes and flashcard decks.
- **Pending Grading Queue**: Inspect student quiz attempts, review score breakdowns, and issue personalized qualitative feedback.
- **Course Bulletins & Notice Publisher**: Post announcements targeted to specific course subjects or role audiences with priority styling (High/Red, Medium/Amber, Low/Blue).

### 🛡️ Administrator & Governance Operations
- **System Governance Dashboard**: Executive metrics detailing total user counts, active subjects, total quizzes taken, and server uptime.
- **User Directory & Role Control**: Create new accounts, modify roles (*Student, Teacher, Admin*), reset credentials, and toggle account statuses.
- **Real-Time Security Audit Trail**: Comprehensive audit logs capturing logins, administrative changes, document uploads, and AI prompt executions with CSV export functionality.
- **Global Broadcast Center**: Publish institutional announcements across the entire university network.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React Icons, Recharts, Motion (`motion/react`)
- **Backend & Middleware**: Node.js, Express 5, Vite (`middlewareMode`), Multer (File upload handler)
- **Document Processing**: `pdf-parse` (PDF text extraction), `mammoth` (DOCX parsing), `pdfkit` & `jspdf` (PDF generation)
- **AI Engine**: Google GenAI SDK (`@google/genai`) powered by `gemini-3.6-flash`
- **Build System**: Vite 7 & `esbuild` (Bundling `server.ts` into a standalone `dist/server.cjs`)

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher (or **bun**)
- **Google Gemini API Key**: Get a free API key from [Google AI Studio](https://aistudio.google.com/)

---

## ⚙️ Environment Setup

1. Copy the example environment file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Gemini API Key:
   ```env
   # Google Gemini API Key (Server-Side Execution)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Port Configuration
   PORT=3000
   ```

---

## 🚀 How to Run the Application

### 1. Install Dependencies
Run the following command to install all frontend and backend npm packages:
```bash
npm install
```

### 2. Development Mode (Full-Stack Dev Server)
Start the Express backend with embedded Vite dev server and hot reloading:
```bash
npm run dev
```
Navigate to **`http://localhost:3000`** in your browser.

### 3. Production Build
To build the production static assets and bundle the server script:
```bash
npm run build
```

### 4. Production Execution
To start the bundled CommonJS production server:
```bash
npm run start
```

### 5. Linting & Code Verification
To validate TypeScript types and ESLint rules:
```bash
npm run lint
```

---

## 👤 Pre-configured Demo Accounts

StudyLens AI provides built-in demo profiles so you can immediately explore each role-based dashboard:

| Role | Name | Email | Permissions & Access |
|---|---|---|---|
| **Student** | Alex Rivera | `student@studylens.edu` | Full study suite, quizzes, flashcards, progress analytics, and personal notes. |
| **Teacher** | Prof. Maria Santos | `teacher@studylens.edu` | Course subjects roster, quiz builder, grading queue, and course announcements. |
| **Admin** | Dr. Arthur Vance | `admin@studylens.edu` | User directory management, audit trail logs, global notice broadcast, and system metrics. |

---

## 📂 Directory Structure

```
├── server.ts                       # Express backend server (API routes, Gemini AI proxy, file upload handlers)
├── vite.config.ts                  # Vite build and server middleware configuration
├── package.json                    # Project dependencies and script definitions
├── .env.example                    # Environment variables declaration
├── README.md                       # Comprehensive project documentation
└── src/
    ├── main.tsx                    # React client entry point
    ├── App.tsx                     # Main layout router and global state handlers
    ├── types.ts                    # Shared TypeScript interfaces (Users, Quizzes, Flashcards, Logs, Bulletins)
    ├── context/
    │   ├── AuthContext.tsx         # User session, role authentication, and account switching
    │   └── AnnouncementsContext.tsx# Centralized broadcast state, target filtering, and notification feeds
    ├── components/
    │   ├── DashboardLayout.tsx     # Top navigation bar, role badges, theme toggle, sidebar, and notice dropdown
    │   ├── AnnouncementsModal.tsx  # Broadcast publishing modal
    │   └── ProtectedRoute.tsx      # Role authorization guard component
    └── pages/
        ├── ai/                     # AI Assistant & Resource Generator page
        ├── learning/               # Assessment portal, Flashcards deck, and Subjects catalog
        ├── analytics/              # Progress analytics and Bloom's taxonomy charts
        ├── dashboards/             # Student, Teacher, and Admin role dashboards
        └── landing/                # Welcome overview landing page
```

---

## 📄 License

This project is licensed under the **MIT License**.
