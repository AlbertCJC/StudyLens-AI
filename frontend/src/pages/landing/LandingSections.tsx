import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Moon,
  PieChart,
  Sparkles,
  Star,
  Sun,
  Users,
} from "lucide-react";
import MobileAppBanner from "../../components/MobileAppBanner";
import type { LandingAuthController } from "./useLandingAuth";

export function LandingSections({ auth }: { auth: LandingAuthController }) {
  const {
    activeTab,
    darkMode,
    setDarkMode,
    setAuthModal,
    openRegisterModal,
    scrollToSection,
    handleFeatureCardClick,
  } = auth;

  return (
    <div className={`min-h-screen font-sans ${darkMode ? "dark bg-[#0b132b] text-slate-100" : "bg-[#f5f6fc] text-slate-900"}`}>
      <MobileAppBanner darkMode={darkMode} />
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0e1628] border-b border-slate-200/80 dark:border-slate-800/80 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-2xs transition-colors">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection("home")}>
          <img
            src="/studylens.png"
            alt="StudyLens AI"
            className="h-10 w-10 rounded-xl object-cover shadow-sm"
          />
          <span className="font-extrabold text-xl text-[#5b51d8] dark:text-white tracking-tight">
            StudyLens AI
          </span>
        </div>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold">
          {(["home", "features", "about", "contact"] as const).map((id) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`transition-colors cursor-pointer capitalize ${
                activeTab === id ? "text-[#5b51d8] dark:text-[#818cf8] font-bold" : "text-slate-700 dark:text-white hover:text-[#5b51d8]"
              }`}
            >
              {id === "home" ? "Home" : id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setAuthModal("login")}
            className="text-sm font-semibold text-slate-700 dark:text-white hover:text-[#5b51d8] px-2 py-1 transition-colors cursor-pointer"
          >
            Login
          </button>

          <button
            onClick={openRegisterModal}
            className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
          >
            Register
          </button>
        </div>
      </header>

      <section id="home" className="px-6 sm:px-12 lg:px-20 py-12 lg:py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 text-[#5b51d8] dark:text-indigo-300 text-xs font-bold border border-indigo-200/50 dark:border-indigo-800/60">
              <Sparkles className="w-4 h-4 text-[#5b51d8] dark:text-indigo-400" />
              <span>AI-Powered Learning</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
              Transform Your Learning <br className="hidden sm:inline" />
              with <span className="text-[#5b51d8] dark:text-[#818cf8]">AI Technology</span>
            </h1>

            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
              StudyLens AI is an adaptive learning and automated assessment generation platform that personalizes your educational journey with intelligent quizzes, flashcards, and progress tracking.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={openRegisterModal}
                className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => scrollToSection("features")}
                className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer"
              >
                Learn More
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 max-w-lg border-t border-slate-200/60 dark:border-slate-800/80">
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">AI-Powered</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Learning Platform</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">Smart</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Flashcard Creation</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">Adaptive</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Progress Tracking</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="bg-[#e0e3f8] dark:bg-[#131b30] border border-indigo-200/50 dark:border-slate-800/80 p-6 sm:p-8 rounded-[32px] shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { title: "AI Quiz", subtitle: "Auto-generated assessments", Icon: Brain },
                  { title: "Flashcards", subtitle: "Smart study cards", Icon: BookOpen },
                  { title: "Progress", subtitle: "Track your growth", Icon: PieChart },
                  { title: "Community", subtitle: "Learn together", Icon: Users },
                ].map(({ title, subtitle, Icon }) => (
                  <div
                    key={title}
                    onClick={handleFeatureCardClick}
                    className="bg-white dark:bg-[#182238] p-5 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                  >
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8] group-hover:scale-105 transition-transform">
                      <Icon className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#e8ebfb] dark:bg-[#0f172a] py-20 px-6 sm:px-12 lg:px-20 border-y border-indigo-100 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Powerful Features for Modern Learning
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              Everything you need to excel in your studies, powered by artificial intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "AI Quiz Generator", copy: "Automatically generate customized quizzes from your study materials using advanced AI", Icon: Brain },
              { title: "AI Flashcard Generator", copy: "Create interactive flashcards instantly from PDFs and learning materials", Icon: BookOpen },
              { title: "Learning Progress Tracking", copy: "Monitor your performance with detailed analytics and insights", Icon: PieChart },
              { title: "Personalized Recommendations", copy: "Get AI-powered suggestions tailored to your learning style and goals", Icon: Star },
            ].map(({ title, copy, Icon }) => (
              <div key={title} className="bg-[#f5f6fc] dark:bg-[#151d34] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-all">
                <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8]">
                  <Icon className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              About StudyLens AI
            </h2>

            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              StudyLens AI is designed to revolutionize the way students learn and teachers assess. Our platform leverages cutting-edge artificial intelligence to create personalized learning experiences that adapt to each student's unique needs.
            </p>

            <ul className="space-y-3.5 pt-2">
              {[
                "Adaptive learning algorithms",
                "Automated assessment generation",
                "Real-time progress tracking",
                "Collaborative learning tools",
                "Multi-format content support",
              ].map((item, idx) => (
                <li key={idx} className="flex items-center space-x-3 text-slate-800 dark:text-slate-200 text-sm font-semibold">
                  <div className="p-1 bg-[#5b51d8]/10 text-[#5b51d8] dark:text-[#818cf8] rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 bg-[#e0e3f8] dark:bg-[#131b30] border border-indigo-200/50 dark:border-slate-800 p-8 rounded-[32px] shadow-sm space-y-6">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Why Choose Us?</h3>

            <div className="space-y-5">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Students</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Personalized learning paths, instant feedback, and comprehensive progress tracking to help you achieve your academic goals.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Teachers</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Save time with automated assessment generation, gain insights into student performance, and focus on what matters most - teaching.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Administrators</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Comprehensive analytics, user management, and system monitoring to ensure optimal learning outcomes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#e8ebfb] dark:bg-[#0f172a] py-20 px-6 sm:px-12 text-center border-t border-indigo-100 dark:border-slate-800/80 transition-colors">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ready to Get Started?
          </h2>

          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Join thousands of students and educators already using StudyLens AI to transform their learning experience.
          </p>

          <div className="pt-4">
            <button
              onClick={() => setAuthModal("register")}
              className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-md transition-all inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>Start Learning Today</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-[#f8fafc] dark:bg-[#0b132b] border-t border-slate-200/80 dark:border-slate-800/80 py-12 px-6 sm:px-12 lg:px-20 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-[#5b51d8] text-white flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base text-[#5b51d8] dark:text-[#818cf8]">StudyLens AI</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              Adaptive Learning and Automated Assessment Generation Platform
            </p>
          </div>

          {[
            { heading: "Product", links: [["#features", "Features"], ["#pricing", "Pricing"], ["#faq", "FAQ"]] },
            { heading: "Company", links: [["#about", "About Us"], ["#blog", "Blog"], ["#careers", "Careers"]] },
            { heading: "Support", links: [["#contact", "Contact"], ["#help", "Help Center"], ["#privacy", "Privacy Policy"]] },
          ].map(({ heading, links }) => (
            <div key={heading} className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{heading}</h4>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-[#5b51d8] transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-200 dark:border-slate-800/80 text-center text-slate-400 text-xs">
          © 2026 StudyLens AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
