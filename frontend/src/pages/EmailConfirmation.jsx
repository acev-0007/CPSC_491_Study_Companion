import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendConfirmationEmail, verifyEmail } from "../api/auth";
import "../styles/EmailConfirmation.css";

function EmailConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = typeof location.state?.email === "string" ? location.state.email : "";
  const email = initialEmail;
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("idle");
  const [resendMessage, setResendMessage] = useState("");
  // Registration already sent the first code. Begin its cooldown immediately.
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    (typeof location.state?.confirmationSentAt === "number"
      ? location.state.confirmationSentAt
      : Date.now()) + 60_000
  );
  const [cooldown, setCooldown] = useState(() =>
    Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000))
  );
  const resendPending = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const updateCountdown = () => {
      setCooldown(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  const handleResend = async () => {
    if (!email.trim() || cooldown > 0 || resendPending.current) return;
    resendPending.current = true;
    setResendStatus("loading");
    setResendMessage("");
    try {
      await resendConfirmationEmail({ email: email.trim() });
      setResendStatus("success");
      setResendMessage("Check your inbox for a new verification code.");
      setResendAvailableAt(Date.now() + 60_000);
      setCooldown(60);
    } catch (issue) {
      setResendStatus("error");
      setResendMessage(issue.status === 429
        ? "Please wait before requesting another code."
        : "We couldn't request a new code. Please try again.");
      if (issue.status === 429) {
        setResendAvailableAt(Date.now() + 60_000);
        setCooldown(60);
      }
    } finally {
      resendPending.current = false;
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
              <div className="email-resend">
                <p>Didn't receive your code?</p>
                <button type="button" className="email-resend-button" onClick={handleResend}
                  disabled={resendStatus === "loading" || cooldown > 0}
                  aria-busy={resendStatus === "loading"}>
                  {resendStatus === "loading" ? "Sending…" : cooldown > 0
                    ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
                </button>
                {resendMessage && <p role="status" className={`email-resend-message${resendStatus === "error" ? " email-resend-error" : ""}`}>{resendMessage}</p>}
              </div>
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
