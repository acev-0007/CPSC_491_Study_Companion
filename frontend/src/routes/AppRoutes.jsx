import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
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
      {/* Public routes */}
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
            <ProtectedRoute>
              <>
                <title>Dashboard | AI Study Companion</title>
                <Dashboard />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <>
                <title>Flashcards | AI Study Companion</title>
                <Flashcards />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <>
                <title>Quiz Generator | AI Study Companion</title>
                <Quiz />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <>
                <title>Assignment Tracker | AI Study Companion</title>
                <AssignmentTracker />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/visual-generator"
          element={
            <ProtectedRoute>
              <>
                <title>Visual Generator | AI Study Companion</title>
                <VisualGenerator />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/summarization"
          element={
            <ProtectedRoute>
              <>
                <title>Summarization | AI Study Companion</title>
                <Summarization />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/textbooks"
          element={
            <ProtectedRoute>
              <>
                <title>Textbook Hub | AI Study Companion</title>
                <TextbookHub />
              </>
            </ProtectedRoute>
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
