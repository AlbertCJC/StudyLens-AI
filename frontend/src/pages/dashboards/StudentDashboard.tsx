import React, { useState } from "react";
import {
  BookOpen, Award, TrendingUp, Activity, Clock,
  Brain, Layers, Zap, CheckCircle2, Flame, Gift,
  RotateCcw, ArrowRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ConfettiEffect } from "../../components/ConfettiEffect";

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();

  // Gamification & Entertainment State
  const [userXp, setUserXp] = useState(850);
  const [userLevel, setUserLevel] = useState(5);
  const [showConfetti, setShowConfetti] = useState(false);
  const [boosterAnswered, setBoosterAnswered] = useState(false);
  const [selectedBoosterOpt, setSelectedBoosterOpt] = useState<number | null>(null);
  const [boosterFeedback, setBoosterFeedback] = useState<string | null>(null);

  // In-Progress Quiz State initialized lazily from localStorage
  const [savedQuizInfo] = useState<{
    quizTitle: string;
    subjectName: string;
    currentQIndex: number;
    totalQuestions: number;
    userAnswersCount: number;
    targetEndTime?: number;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const userId = currentUser?.id || "guest";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`studylens_quiz_progress_${userId}_`)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            return {
              quizTitle: parsed.quizTitle || "In Progress Assessment",
              subjectName: parsed.subjectName || "Subject",
              currentQIndex: parsed.currentQIndex || 0,
              totalQuestions: parsed.totalQuestions || 10,
              userAnswersCount: Object.keys(parsed.userAnswers || {}).length,
              targetEndTime: parsed.targetEndTime,
            };
          }
        } catch (e) {
          console.error("Error parsing saved quiz in StudentDashboard:", e);
        }
      }
    }
    return null;
  });

  const dailyQuestions = [
    {
      q: "Which data structure follows the LIFO (Last In, First Out) principle?",
      opts: ["Queue", "Stack", "Array", "Linked List"],
      correct: 1,
      exp: "A Stack pushes and pops elements from the top, making the last inserted item the first one removed!",
    },
  ];

  const currentDailyQ = dailyQuestions[0];

  const handleAnswerBooster = (index: number) => {
    if (boosterAnswered) return;
    setSelectedBoosterOpt(index);
    setBoosterAnswered(true);

    if (index === currentDailyQ.correct) {
      setBoosterFeedback("Excellent! Correct answer! +50 XP Earned!");
      setUserXp((prev) => {
        const nextXp = prev + 50;
        if (nextXp >= 1000) {
          setUserLevel((l) => l + 1);
        }
        return nextXp;
      });
      setShowConfetti(true);
    } else {
      setBoosterFeedback("Nice try! " + currentDailyQ.exp);
    }
  };

  const studentName = currentUser?.name ? currentUser.name.split(" ")[0] : "John";

  return (
    <div className="space-y-6 pb-6">
      <ConfettiEffect trigger={showConfetti} />

      {/* Top Welcome Title & Gamification Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back, {studentName}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your learning today.
          </p>
        </div>

        {/* Level, XP & Streak Pill */}
        <div className="flex flex-wrap items-center gap-2.5 bg-card border border-border p-2 px-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
              L{userLevel}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Level {userLevel} Scholar</p>
              <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden mt-0.5">
                <div
                  className="bg-amber-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, ((userXp % 1000) / 1000) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500 animate-pulse" />
            <span>7-Day Streak</span>
          </div>

          <button
            onClick={() => {
              setUserXp((prev) => prev + 25);
              setShowConfetti(true);
            }}
            className="px-2.5 py-1 rounded-xl bg-[#5b51d8]/10 hover:bg-[#5b51d8]/20 text-[#5b51d8] dark:text-[#818cf8] text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>+25 XP</span>
          </button>
        </div>
      </div>

      {/* Active Saved Quiz Banner if user exited mid-quiz */}
      {savedQuizInfo && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider">
                  Resume Ongoing Quiz
                </span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded border border-amber-500/30 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Active Practice Session</span>
                </span>
              </div>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {savedQuizInfo.quizTitle} ({savedQuizInfo.subjectName})
              </p>
              <p className="text-xs text-muted-foreground">
                Question {savedQuizInfo.currentQIndex + 1} of {savedQuizInfo.totalQuestions} ({savedQuizInfo.userAnswersCount} answered) • Resume practice anytime
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate("assessments")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm self-start sm:self-center cursor-pointer transition-all"
          >
            <span>Continue Quiz</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Row 1: 4 Metric Cards matching the reference image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Subjects */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Total Subjects</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">8</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>↑ 2 new</span>
            </p>
          </div>
          <div className="p-3 bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] rounded-2xl shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Completed Quizzes */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Completed Quizzes</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">45</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>↑ 12 this week</span>
            </p>
          </div>
          <div className="p-3 bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] rounded-2xl shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Study Progress */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Study Progress</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">78%</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>↑ 5% increase</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-2xl shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Average Score */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Average Score</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">92%</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>↑ 3% increase</span>
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 rounded-2xl shrink-0">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Row 2: 2 Column Layout (Recent Activities & Subject Progress) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Activities (7 cols) */}
        <div className="lg:col-span-7 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Recent Activities</h2>
            <button
              onClick={() => onNavigate("analytics")}
              className="text-xs font-semibold text-foreground hover:text-[#5b51d8] dark:hover:text-[#818cf8] transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="space-y-4">
            {/* Activity 1 */}
            <div className="flex items-start space-x-3.5 pb-4 border-b border-border/60 last:border-0 last:pb-0">
              <div className="p-2.5 rounded-full bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] mt-0.5 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-extrabold text-foreground leading-snug">
                  Completed Mathematics Quiz
                </h3>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="px-2.5 py-0.5 bg-[#5b51d8] text-white text-[11px] font-bold rounded-md">
                    Mathematics
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Score: 95%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">2 hours ago</p>
              </div>
            </div>

            {/* Activity 2 */}
            <div className="flex items-start space-x-3.5 pb-4 border-b border-border/60 last:border-0 last:pb-0">
              <div className="p-2.5 rounded-full bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] mt-0.5 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-extrabold text-foreground leading-snug">
                  Reviewed Physics Flashcards
                </h3>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="px-2.5 py-0.5 bg-[#5b51d8] text-white text-[11px] font-bold rounded-md">
                    Physics
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    25 cards
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">5 hours ago</p>
              </div>
            </div>

            {/* Activity 3 */}
            <div className="flex items-start space-x-3.5 pb-4 border-b border-border/60 last:border-0 last:pb-0">
              <div className="p-2.5 rounded-full bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] mt-0.5 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-extrabold text-foreground leading-snug">
                  Submitted Chemistry Lab Assessment
                </h3>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="px-2.5 py-0.5 bg-[#5b51d8] text-white text-[11px] font-bold rounded-md">
                    Chemistry
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Grade: 90%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Yesterday</p>
              </div>
            </div>

            {/* Activity 4 */}
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-full bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] mt-0.5 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-extrabold text-foreground leading-snug">
                  Asked AI Study Assistant 3 Questions
                </h3>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="px-2.5 py-0.5 bg-[#5b51d8] text-white text-[11px] font-bold rounded-md">
                    Computer Science
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Binary Search Trees
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">2 days ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Subject Progress (5 cols) */}
        <div className="lg:col-span-5 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
          <h2 className="text-lg font-extrabold text-foreground">Subject Progress</h2>

          <div className="space-y-5">
            {/* Mathematics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-foreground">
                <span>Mathematics</span>
                <span className="text-muted-foreground font-semibold">85%</span>
              </div>
              <div className="h-2.5 w-full bg-[#5b51d8]/15 dark:bg-slate-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#5b51d8] rounded-full transition-all duration-500" style={{ width: "85%" }} />
              </div>
            </div>

            {/* Physics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-foreground">
                <span>Physics</span>
                <span className="text-muted-foreground font-semibold">72%</span>
              </div>
              <div className="h-2.5 w-full bg-[#5b51d8]/15 dark:bg-slate-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#5b51d8] rounded-full transition-all duration-500" style={{ width: "72%" }} />
              </div>
            </div>

            {/* Chemistry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-foreground">
                <span>Chemistry</span>
                <span className="text-muted-foreground font-semibold">65%</span>
              </div>
              <div className="h-2.5 w-full bg-[#5b51d8]/15 dark:bg-slate-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#5b51d8] rounded-full transition-all duration-500" style={{ width: "65%" }} />
              </div>
            </div>

            {/* English */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-foreground">
                <span>English</span>
                <span className="text-muted-foreground font-semibold">90%</span>
              </div>
              <div className="h-2.5 w-full bg-[#5b51d8]/15 dark:bg-slate-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#5b51d8] rounded-full transition-all duration-500" style={{ width: "90%" }} />
              </div>
            </div>

            {/* Computer Science */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-foreground">
                <span>Computer Science</span>
                <span className="text-muted-foreground font-semibold">94%</span>
              </div>
              <div className="h-2.5 w-full bg-[#5b51d8]/15 dark:bg-slate-700/80 rounded-full overflow-hidden">
                <div className="h-full bg-[#5b51d8] rounded-full transition-all duration-500" style={{ width: "94%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Quick Tools & Daily Brain Booster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Brain Booster Challenge */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-[#5b51d8] text-white rounded-xl shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Daily Brain Booster Challenge
                </h3>
                <p className="text-xs text-muted-foreground">
                  Answer today's quick question to earn +50 XP & keep your streak!
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-700 dark:text-amber-300 font-extrabold text-xs rounded-full">
              +50 XP
            </span>
          </div>

          <div className="p-4 bg-card border border-border rounded-xl space-y-3">
            <p className="text-xs font-bold text-foreground leading-snug">
              {currentDailyQ.q}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentDailyQ.opts.map((opt, idx) => {
                const isSelected = selectedBoosterOpt === idx;
                const isCorrectOpt = idx === currentDailyQ.correct;

                let optClass = "bg-muted/40 hover:bg-muted border-border text-foreground";
                if (boosterAnswered) {
                  if (isSelected && isCorrectOpt) {
                    optClass = "bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold";
                  } else if (isSelected && !isCorrectOpt) {
                    optClass = "bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-300 font-bold";
                  } else if (isCorrectOpt) {
                    optClass = "bg-emerald-500/10 border-emerald-400 text-emerald-700 dark:text-emerald-400 font-bold";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerBooster(idx)}
                    disabled={boosterAnswered}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${optClass}`}
                  >
                    <span>{opt}</span>
                    {boosterAnswered && isCorrectOpt && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {boosterFeedback && (
              <div className="p-2.5 bg-[#5b51d8]/10 border border-[#5b51d8]/20 rounded-xl text-xs font-semibold text-[#5b51d8] dark:text-[#818cf8]">
                {boosterFeedback}
              </div>
            )}
          </div>
        </div>

        {/* Quick AI Shortcuts */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 bg-[#5b51d8]/10 text-[#5b51d8] dark:bg-[#5b51d8]/20 dark:text-[#818cf8] rounded-xl">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Quick AI Generator</h3>
                <p className="text-[11px] text-muted-foreground">Instant study materials</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate Bloom's taxonomy quizzes, interactive flashcards, or exam summaries in seconds.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onNavigate("ai-assistant")}
              className="w-full py-2 bg-[#5b51d8] hover:bg-[#4f46e5] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Launch AI Study Assistant</span>
            </button>
            <button
              onClick={() => onNavigate("flashcards")}
              className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Open Flashcards Deck</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
