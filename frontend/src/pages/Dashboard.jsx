import AICompanionPanel from "../components/AICompanionPanel/AICompanionPanel";
import EmptyState from "../components/EmptyState/EmptyState";
import ToolLink from "../components/ToolLink/ToolLink";
import "../styles/dashboard.css";

const studyTools = [
  {
    title: "Flashcards",
    description: "Review concepts with generated study cards.",
    to: "/flashcards",
  },
  {
    title: "Quiz",
    description: "Practice with questions created from your study topics.",
    to: "/quiz",
  },
  {
    title: "Summarization",
    description: "Condense notes and readings into focused study summaries.",
    to: "/summarization",
  },
  {
    title: "Visual Generator",
    description: "Turn study material into visual explanations.",
    to: "/visual-generator",
  },
  {
    title: "Assignment Tracker",
    description: "Organize coursework, due dates, and task status.",
    to: "/assignments",
  },
  {
    title: "Textbook Hub",
    description: "Access the study documents and textbook resources available to you.",
    to: "/textbooks",
  },
];

function Dashboard() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <p className="dashboard-eyebrow">Overview</p>
        <h1>Dashboard</h1>
        <p>Choose a study tool or continue where you left off.</p>
      </header>

      <AICompanionPanel />

      <section
        className="dashboard-section"
        id="study-tools"
        aria-labelledby="study-tools-heading"
      >
        <div className="dashboard-section-heading">
          <div>
            <h2 id="study-tools-heading">Study Tools</h2>
            <p>Open the tool that fits what you are working on.</p>
          </div>
        </div>

        <div className="study-tools-grid">
          {studyTools.map((tool) => (
            <ToolLink key={tool.to} {...tool} />
          ))}
        </div>
      </section>

      <section
        className="dashboard-section"
        aria-labelledby="continue-studying-heading"
      >
        <div className="dashboard-section-heading">
          <div>
            <h2 id="continue-studying-heading">Continue Studying</h2>
            <p>Return to recent study sessions when activity is available.</p>
          </div>
        </div>

        <EmptyState
          title="Nothing to continue yet"
          description="Recent study sessions will appear here after you begin using the study tools."
          action={<a href="#study-tools">Explore study tools</a>}
        />
      </section>
    </div>
  );
}

export default Dashboard;
