import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendVerificationEmail, verifyEmail } from "../api/auth";
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
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState("");

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const handleResend = async () => {
    if (!email || resendSeconds > 0 || resending) return;
    setResending(true);
    setResendFeedback("");
    setError("");
    try {
      const result = await resendVerificationEmail({ email });
      setResendSeconds(result.retryAfterSeconds || 60);
      setResendFeedback("If your account still needs verification, a new code is on its way.");
    } catch (issue) {
      if (issue.status === 429) {
        setResendSeconds(issue.retryAfterSeconds || 60);
        setResendFeedback("Please wait before requesting another code.");
      } else {
        setError("We couldn't request a new code right now. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

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
      <header>
        <Link to="/" className="auth-brand" aria-label="AI Study Companion home">
        <div className="auth-brand-mark" aria-hidden="true">✦</div>
        <div className="auth-brand-copy">
          <p className="auth-brand-name">AI Study Companion</p>
          <p className="auth-brand-tagline">Your personalized AI learning workspace.</p>
        </div>
      </Link>
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
              Your verification session has ended. Log in to resume verifying your email.
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
              <div className="email-verify-resend">
                <button type="button" className="email-resend-button"
                  onClick={handleResend} disabled={resendSeconds > 0 || resending || status === "loading"}>
                  {resending ? "Sending…" : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
                </button>
                {resendFeedback && <p role="status" className="email-code-help">{resendFeedback}</p>}
              </div>
              <button type="submit" className="auth-button" disabled={code.length !== 8 || !email.trim() || status === "loading"} aria-busy={status === "loading"}>
                {status === "loading" ? "Verifying…" : "Verify Email"}
              </button>
            </form>
          )}
          <p className="email-verify-back">
            <Link to="/login">
              {email.trim() ? "Back to Log In" : "Go to Log In"}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

export default EmailConfirmation;
