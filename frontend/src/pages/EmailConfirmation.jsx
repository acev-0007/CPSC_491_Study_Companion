import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import "../styles/EmailConfirmation.css";

function EmailConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = typeof location.state?.email === "string" ? location.state.email : "";
  const email = initialEmail;
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  const cleanCode = (value) => value.replace(/\D/g, "").slice(0, 8);

  const handleVerify = async (event) => {
    event.preventDefault();
    if (code.length !== 8 || !email.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      await verifyEmail({ email: email.trim(), code });
      setCode("");
      setStatus("success");
      navigate("/dashboard", { replace: true });
    } catch (issue) {
      setStatus("idle");
      setCode("");
      setError(issue.message || "We couldn't verify that code. Please try again.");
      inputRef.current?.focus();
    }
  };


  return (
    <div className="auth-page">
      <header className="auth-brand">
        <div className="auth-brand-mark" aria-hidden="true">✦</div>
        <div className="auth-brand-copy">
          <p className="auth-brand-name">AI Study Companion</p>
          <p className="auth-brand-tagline">Your personalized AI learning workspace.</p>
        </div>
      </header>
      <main className="auth-shell">
        <section className="auth-panel auth-panel-success email-verify-panel" aria-labelledby="verify-heading">
          <div className="email-verify-icon" aria-hidden="true">✉</div>
          <div className="auth-intro">
            <h1 id="verify-heading" className="auth-heading">{status === "success" ? "Email verified" : "Verify your email"}</h1>
            <p className="auth-subtitle">{status === "success"
              ? "Your account is ready. Redirecting to your dashboard…"
              : "Enter the eight-digit code we sent to your email to finish creating your account."}</p>
          </div>
          {status !== "success" && !email.trim() && (
            <p role="alert" className="auth-message auth-message-error">
              Your registration email is unavailable. Please return to registration to start verification again.
            </p>
          )}
          {status !== "success" && Boolean(email.trim()) && (
            <form className="auth-form" onSubmit={handleVerify}>
              <div className="email-code-field">
                <label htmlFor="email-code">Verification code</label>
                <div className="email-code-control" onClick={() => inputRef.current?.focus()}>
                  <input ref={inputRef} id="email-code" className="email-code-input"
                    type="text" inputMode="numeric" pattern="[0-9]{8}" autoComplete="one-time-code"
                    maxLength={8} required aria-describedby="email-code-help" aria-invalid={Boolean(error)}
                    value={code} onChange={(event) => { setCode(cleanCode(event.target.value)); setError(""); }} />
                  <div className="email-code-slots" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, index) => (
                      <span key={index} className={`email-code-slot${index === code.length && code.length < 8 ? " is-next" : ""}`}>
                        {code[index] || ""}
                      </span>
                    ))}
                  </div>
                </div>
                <p id="email-code-help" className="email-code-help">Type or paste the code from your email.</p>
              </div>
              {error && <p role="alert" className="auth-message auth-message-error">{error}</p>}
              <button type="submit" className="auth-button" disabled={code.length !== 8 || !email.trim() || status === "loading"} aria-busy={status === "loading"}>
                {status === "loading" ? "Verifying…" : "Verify Email"}
              </button>
            </form>
          )}
          <p className="email-verify-back">
            <Link to={email.trim() ? "/login" : "/register"}>
              {email.trim() ? "Back to Log In" : "Back to Register"}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

export default EmailConfirmation;
