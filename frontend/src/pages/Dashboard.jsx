import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <Link to="/flashcards">Study Flashcards</Link>
    </div>
  );
}

export default Dashboard;