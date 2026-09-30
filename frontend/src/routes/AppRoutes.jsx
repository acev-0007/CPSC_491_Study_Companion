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
      <Route
        path="/login"
        element={
          <>
            <title>Login | AI Study Companion</title>
            <Login />
          </>
        }
      />

      <Route
        path="/register"
        element={
          <>
            <title>Register | AI Study Companion</title>
            <Register />
          </>
        }
      />

      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <>
              <title>Dashboard | AI Study Companion</title>
              <Dashboard />
            </>
          }
        />

        <Route
          path="/flashcards"
          element={
            <>
              <title>Flashcards | AI Study Companion</title>
              <Flashcards />
            </>
          }
        />

        <Route
          path="/quiz"
          element={
            <>
              <title>Quiz Generator | AI Study Companion</title>
              <Quiz />
            </>
          }
        />

        <Route
          path="/assignments"
          element={
            <>
              <title>Assignment Tracker | AI Study Companion</title>
              <AssignmentTracker />
            </>
          }
        />

        <Route
          path="/visual-generator"
          element={
            <>
              <title>Visual Generator | AI Study Companion</title>
              <VisualGenerator />
            </>
          }
        />

        <Route
          path="/summarization"
          element={
            <>
              <title>Summarization | AI Study Companion</title>
              <Summarization />
            </>
          }
        />

        <Route
          path="/textbooks"
          element={
            <>
              <title>Textbook Hub | AI Study Companion</title>
              <TextbookHub />
            </>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <>
            <title>Page Not Found | AI Study Companion</title>
            <NotFound />
          </>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
