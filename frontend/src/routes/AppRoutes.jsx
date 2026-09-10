import { Routes, Route } from "react-router-dom";

import Layout from "../components/Layout";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import Flashcards from "../pages/Flashcards";
import Quiz from "../pages/Quiz";
import AssignmentTracker from "../pages/AssignmentTracker";
import VisualGenerator from "../pages/VisualGenerator";
import Summarization from "../pages/Summarization";
import TextbookHub from "../pages/TextbookHub";
import NotFound from "../pages/NotFound";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/assignments" element={<AssignmentTracker />} />
        <Route path="/visual-generator" element={<VisualGenerator />} />
        <Route path="/summarization" element={<Summarization />} />
        <Route path="/textbooks" element={<TextbookHub />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
