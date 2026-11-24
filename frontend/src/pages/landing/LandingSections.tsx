import { ArrowRight, BookOpen, Brain, CheckCircle2, Moon, PieChart, Sparkles, Star, Sun, Users } from "lucide-react";
import MobileAppBanner from "../../components/MobileAppBanner";
import { Button } from "../../components/ui/button";
import type { LandingAuthController } from "./useLandingAuth";

const FEATURES = [
  { title: "AI quiz generator", copy: "Turn your study materials into customized quizzes in seconds.", Icon: Brain },
  { title: "AI flashcards", copy: "Create interactive flashcards from PDFs and slides.", Icon: BookOpen },
  { title: "Progress tracking", copy: "See scores, streaks and weak topics at a glance.", Icon: PieChart },
  { title: "Recommendations", copy: "Suggestions tailored to your goals and pace.", Icon: Star },
];

const AUDIENCES = [
  { title: "For students", copy: "Personal learning paths, instant feedback and clear progress toward your goals." },
  { title: "For teachers", copy: "Generate assessments automatically and see exactly where students need help." },
  { title: "For administrators", copy: "Analytics, user management and monitoring in one place." },
];

function Logo({ size = "h-10 w-10" }: { size?: string }) {
  return <img src="/studylens.png" alt="StudyLens AI" className={`${size} rounded-xl object-cover shadow-sm`} />;
}

export function LandingSections({ auth }: { auth: LandingAuthController }) {
  const { activeTab, darkMode, setDarkMode, setAuthModal, openRegisterModal, scrollToSection, handleFeatureCardClick } = auth;

  return (
    <div className={`min-h-screen font-sans bg-background text-foreground ${darkMode ? "dark" : ""}`}>
      <MobileAppBanner darkMode={darkMode} />

      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur border-b border-border px-5 sm:px-10 py-3 flex items-center justify-between">
        <button className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection("home")}>
          <Logo />
          <span className="font-bold text-lg text-structure-foreground dark:text-white tracking-tight">StudyLens AI</span>
        </button>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium" aria-label="Sections">
          {(["home", "features", "about", "contact"] as const).map((id) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              aria-current={activeTab === id ? "true" : undefined}
              className={`px-3 py-2 rounded-lg capitalize transition-colors cursor-pointer ${
                activeTab === id ? "bg-structure text-structure-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAuthModal("login")}>Log in</Button>
          <Button variant="secondary" size="sm" onClick={openRegisterModal}>Sign up</Button>
        </div>
      </header>

      <section id="home" className="px-5 sm:px-10 lg:px-20 py-14 lg:py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-structure text-structure-foreground text-xs font-semibold">
              <Sparkles className="w-4 h-4" aria-hidden /> AI-powered study platform
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Study smarter with <span className="text-brand-gradient">focused learning</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl leading-relaxed">
              Materials, quizzes, flashcards and an AI tutor in one place. Teachers see exactly where students need help.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button variant="primary" size="lg" onClick={openRegisterModal}>
                Get started free <ArrowRight className="w-4 h-4" aria-hidden />
              </Button>
              <Button variant="outline" size="lg" onClick={() => scrollToSection("features")}>See how it works</Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-accent" aria-hidden /> For students, teachers and administrators
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-structure rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="bg-card border border-structure-strong rounded-2xl p-4">
                <p className="text-xs text-muted-foreground">Today's goal</p>
                <div className="flex justify-between items-baseline mt-1 mb-2">
                  <span className="font-semibold">Biology review</span>
                  <span className="text-sm text-muted-foreground">7 / 10</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[70%] bg-brand-gradient rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: "AI quiz", Icon: Brain },
                  { title: "Flashcards", Icon: BookOpen },
                  { title: "Progress", Icon: PieChart },
                  { title: "Community", Icon: Users },
                ].map(({ title, Icon }) => (
                  <button
                    key={title}
                    onClick={handleFeatureCardClick}
                    className="bg-card border border-structure-strong rounded-2xl p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
                  >
                    <Icon className="w-6 h-6 text-primary mb-2" aria-hidden />
                    <span className="font-semibold text-sm">{title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-card border-y border-border py-20 px-5 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to learn</h2>
            <p className="text-muted-foreground">One place for studying, practicing and tracking progress.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ title, copy, Icon }) => (
              <div key={title} className="bg-background border border-border rounded-2xl p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-structure text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-5 sm:px-10 lg:px-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">About StudyLens AI</h2>
            <p className="text-muted-foreground leading-relaxed">
              StudyLens AI adapts to each student and automates assessment work for teachers, so everyone spends more time learning.
            </p>
            <ul className="space-y-3">
              {["Adaptive learning", "Automated assessment generation", "Real-time progress tracking", "Collaborative learning tools", "PDF, slides and document support"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-accent shrink-0" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5 bg-structure rounded-3xl p-7 space-y-5">
            <h3 className="text-xl font-bold text-structure-foreground dark:text-white">Built for everyone in class</h3>
            {AUDIENCES.map(({ title, copy }) => (
              <div key={title} className="bg-card border border-structure-strong rounded-2xl p-4">
                <h4 className="font-semibold">{title}</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 sm:px-10 lg:px-20 pb-20">
        <div className="max-w-7xl mx-auto rounded-3xl bg-[#312e81] text-white p-8 sm:p-12 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to start?</h2>
            <p className="text-indigo-200 mt-1">Join your class in under a minute.</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => setAuthModal("register")}>
            Create account <ArrowRight className="w-4 h-4" aria-hidden />
          </Button>
        </div>
      </section>

      <footer className="bg-card border-t border-border py-12 px-5 sm:px-10 lg:px-20 text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Logo size="h-8 w-8" />
              <span className="font-bold text-foreground">StudyLens AI</span>
            </div>
            <p className="max-w-xs leading-relaxed">Adaptive learning and automated assessment generation.</p>
          </div>
          {[
            { heading: "Product", links: [["#features", "Features"], ["#pricing", "Pricing"], ["#faq", "FAQ"]] },
            { heading: "Company", links: [["#about", "About us"], ["#blog", "Blog"], ["#careers", "Careers"]] },
            { heading: "Support", links: [["#contact", "Contact"], ["#help", "Help center"], ["#privacy", "Privacy policy"]] },
          ].map(({ heading, links }) => (
            <div key={heading} className="space-y-2">
              <h4 className="font-semibold text-foreground">{heading}</h4>
              <ul className="space-y-2">
                {links.map(([href, label]) => (
                  <li key={href}><a href={href} className="hover:text-primary transition-colors">{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-border text-center text-xs">© 2026 StudyLens AI. All rights reserved.</div>
      </footer>
    </div>
  );
}
