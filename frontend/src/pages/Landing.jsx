import { useState } from "react";
import { Link } from "react-router-dom";
import "./Landing.css";

const studyTools = [
  "Flashcards", "Quiz Generator", "Summarization",
  "Visual Generator", "Assignment Tracker", "Textbook Hub",
];

const features = [
  {
    number: "01", title: "Study with purpose",
    description: "Review concepts with flashcards, practice with quizzes, and condense notes into focused summaries.",
    tools: "Flashcards · Quizzes · Summarization",
  },
  {
    number: "02", title: "Stay on top of coursework",
    description: "Keep assignments and deadlines organized alongside your study resources.",
    tools: "Assignment Tracker · Textbook Hub",
  },
  {
    number: "03", title: "See ideas differently",
    description: "Use visual study tools to explore concepts from another perspective.",
    tools: "Visual Generator",
  },
];

function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link className="landing-brand" to="/" onClick={closeMenu} aria-label="AI Study Companion home">
          <span className="landing-brand-mark" aria-hidden="true">✦</span>
          <span>AI Study Companion</span>
        </Link>
        <button className="landing-menu-toggle" type="button" aria-expanded={menuOpen}
          aria-controls="landing-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((value) => !value)}>
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>
        <nav id="landing-navigation" className={`landing-nav${menuOpen ? " landing-nav-open" : ""}`} aria-label="Main navigation">
          <div className="landing-nav-links">
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" onClick={closeMenu}>Log In</Link>
            <Link to="/register" className="landing-button landing-button-primary landing-button-small" onClick={closeMenu}>Sign Up Free</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="landing-preview" role="img" aria-label="Illustration of the AI Study Companion dashboard with six study tools">
      <div className="landing-preview-topbar" aria-hidden="true">
        <span className="landing-window-dots"><i /><i /><i /></span>
        <span>AI Study Companion / Dashboard</span>
        <span className="landing-preview-topbar-spacer" />
      </div>
      <div className="landing-preview-body" aria-hidden="true">
        <aside className="landing-preview-sidebar">
          <div className="landing-preview-sidebar-title">Workspace</div>
          <div className="landing-preview-sidebar-active">▦ <span>Dashboard</span></div>
          <div>▤ <span>Flashcards</span></div>
          <div>◈ <span>Quizzes</span></div>
          <div>▧ <span>Assignments</span></div>
          <div>✧ <span>Visual Generator</span></div>
        </aside>
        <div className="landing-preview-content">
          <span className="landing-preview-eyebrow">OVERVIEW</span>
          <h3>Dashboard</h3>
          <p>Choose a study tool or continue where you left off.</p>
          <div className="landing-preview-companion"><span className="landing-preview-companion-icon">✦</span><span><strong>Your study companion</strong><small>Find the right tool for what you are learning.</small></span></div>
          <div className="landing-preview-heading">Study Tools</div>
          <div className="landing-preview-grid">
            {studyTools.map((tool, index) => <div className="landing-preview-tile" key={tool}><span className="landing-preview-tile-icon">{["▤", "◈", "≡", "✧", "▧", "▣"][index]}</span><span>{tool}</span><span className="landing-preview-chevron">↗</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">Skip to main content</a>
      <LandingHeader />
      <main id="landing-main">
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <p className="landing-eyebrow"><span aria-hidden="true">✦</span> YOUR AI-POWERED STUDY WORKSPACE</p>
          <h1 id="landing-title">Study smarter.<br /><span>Stay organized.</span></h1>
          <p className="landing-hero-description">Bring your coursework together in one place. Create study materials, organize assignments, and explore complex topics with AI Study Companion.</p>
          <div className="landing-hero-actions">
            <Link className="landing-button landing-button-primary" to="/register">Get Started <span aria-hidden="true">↗</span></Link>
            <Link className="landing-button landing-button-secondary" to="/login">Log In</Link>
          </div>
          <div className="landing-hero-preview"><ProductPreview /></div>
        </section>
        <section id="features" className="landing-section landing-container" aria-labelledby="landing-features-title">
          <p className="landing-section-kicker">THE TOOLS</p>
          <h2 id="landing-features-title">Everything you need to study, in one workspace.</h2>
          <p className="landing-section-intro">Move from notes to understanding without juggling multiple study tools.</p>
          <div className="landing-feature-grid">{features.map((feature) => <article className="landing-feature" key={feature.number}><span className="landing-feature-number">{feature.number}</span><h3>{feature.title}</h3><p>{feature.description}</p><small>{feature.tools}</small></article>)}</div>
        </section>
        <section id="how-it-works" className="landing-section landing-how" aria-labelledby="landing-how-title">
          <div className="landing-container">
            <p className="landing-section-kicker">HOW IT WORKS</p>
            <h2 id="landing-how-title">From coursework to clarity.</h2>
            <div className="landing-steps">
              <div><span>01</span><h3>Add your material</h3><p>Start with your notes, topics, or coursework.</p></div>
              <div><span>02</span><h3>Choose how to study</h3><p>Explore flashcards, quizzes, summaries, and visual study tools.</p></div>
              <div><span>03</span><h3>Stay organized</h3><p>Keep your assignments and study resources together.</p></div>
            </div>
          </div>
        </section>
        <section className="landing-final-cta landing-container" aria-labelledby="landing-cta-title">
          <div className="landing-cta-panel"><p className="landing-section-kicker">READY WHEN YOU ARE</p><h2 id="landing-cta-title">Make more of your study time.</h2><p>Get started with a more organized way to learn.</p><Link className="landing-button landing-button-primary" to="/register">Sign Up Free <span aria-hidden="true">↗</span></Link></div>
        </section>
      </main>
      <footer className="landing-footer"><div className="landing-container landing-footer-inner"><span>© {new Date().getFullYear()} AI Study Companion</span><nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#how-it-works">How It Works</a><Link to="/login">Log In</Link></nav></div></footer>
    </div>
  );
}

export default Landing;
