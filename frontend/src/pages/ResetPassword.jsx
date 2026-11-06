import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { completePasswordReset, validatePasswordRecovery } from "../api/auth";

// Read the one-time recovery callback once, then promptly remove credentials
// from the address bar and browser history. Never persist them in storage.
function readRecoveryCallback() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const query = url.searchParams;
  const error = hash.get("error_code") || query.get("error_code") || hash.get("error") || query.get("error");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const type = hash.get("type");
  if (url.hash || url.search) {
    window.history.replaceState(window.history.state, "", url.pathname);
  }
  if (error) return { error: true };
  if (type !== "recovery" || !accessToken || !refreshToken) return { error: true };
  return { accessToken, refreshToken };
}

function ResetPassword() {
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(null);
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const callbackRef = useRef(null);

  useEffect(() => {
    // Keep one validation promise across React StrictMode effect replays.
    if (!callbackRef.current) {
      const callback = readRecoveryCallback();
      callbackRef.current = {
        callback,
        promise: callback.error ? Promise.resolve(false) : validatePasswordRecovery(callback),
      };
    }
    let active = true;
    const { callback, promise } = callbackRef.current;
    if (!callback.error) setRecovery(callback);
    promise.then((valid) => {
      if (active) setStatus(valid ? "ready" : "invalid");
    }).catch((issue) => {
      if (active) setStatus(issue.status === 429 ? "limited" : issue.status === 503 ? "service-error" : "invalid");
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (status !== "ready") return;
    setError("");
    if (password.length < 8 || password.length > 128) {
      setError("Your password must be between 8 and 128 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setStatus("saving");
    try {
      await completePasswordReset({ ...recovery, password });
      setPassword("");
      setConfirmation("");
      setRecovery(null);
      callbackRef.current = null;
      // A recovery link is one-time-use. Replace this history entry so
      // Back does not revisit a consumed token and show an invalid-link screen.
      navigate("/login", { replace: true, state: { passwordResetComplete: true } });
    } catch (issue) {
      if (issue.code === "same_password") {
        setStatus("ready");
        setError("Choose a password different from your current password.");
      } else if (issue.status === 400) {
        setStatus("ready");
        setError("Password does not meet the account requirements. Please choose another password.");
      } else if (issue.status === 401 || issue.status === 403) {
        setStatus("invalid");
      } else if (issue.status === 429) {
        setStatus("ready");
        setError("Too many attempts. Please try again later.");
      } else {
        setStatus("ready");
        setError("We couldn't update your password. Please try again.");
      }
    }
  }

  const unavailable = ["invalid", "limited", "service-error"].includes(status);
  return (
    <div className="auth-page recovery-page">
      <header className="recovery-header">
        <div className="recovery-header-inner">
          <Link className="recovery-brand" to="/" aria-label="AI Study Companion home">
            <span className="recovery-brand-mark" aria-hidden="true">✦</span>
            <span>AI Study Companion</span>
          </Link>
          <Link className="recovery-header-login" to="/login">Log In</Link>
        </div>
      </header>
      <main className="recovery-main">
        <section className="auth-panel recovery-panel" aria-labelledby="reset-heading">
          <div className="auth-intro recovery-intro">
            <p className="recovery-eyebrow"><span aria-hidden="true">✦</span> ACCOUNT RECOVERY</p>
            <h1 className="auth-heading" id="reset-heading">
              {status === "success" ? "Password updated" : unavailable ? "Recovery link unavailable" : "Create a new password"}
            </h1>
            <p className="auth-subtitle">
              {status === "success" ? "Your password has been changed. You can now log in with your new password."
                : status === "invalid" ? "This password-reset link is invalid or has expired. Request a new link to continue."
                : status === "limited" ? "Too many requests. Please try again later or request a new recovery link."
                : status === "service-error" ? "We couldn't verify your recovery link right now. Please request a new one later."
                : "Choose a secure password for your account."}
            </p>
          </div>
          {status === "checking" && <p className="recovery-confirmation" role="status">Checking your recovery link…</p>}
          {status === "success" && <Link className="auth-button recovery-primary-link" to="/login">Go to Log In</Link>}
          {unavailable && <Link className="auth-button recovery-primary-link" to="/forgot-password">Request a new link</Link>}
          {(status === "ready" || status === "saving") && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="reset-password">New Password</label>
                <div className="password-field">
                  <input id="reset-password" autoComplete="new-password" type={showPassword ? "text" : "password"}
                    value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128}
                    aria-describedby="reset-password-help" disabled={status === "saving"} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="recovery-help" id="reset-password-help">Use 8–128 characters.</p>
              </div>
              <div className="form-group">
                <label htmlFor="reset-confirm-password">Confirm Password</label>
                <input id="reset-confirm-password" autoComplete="new-password" type="password" value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)} disabled={status === "saving"} required />
              </div>
              {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
              <button className="auth-button" type="submit" disabled={status === "saving"} aria-busy={status === "saving"}>
                {status === "saving" ? "Updating password…" : "Update Password"}
              </button>
            </form>
          )}
          <div className="recovery-footer"><Link to="/login"><span aria-hidden="true">←</span> Back to Login</Link></div>
        </section>
      </main>
    </div>
  );
}
export default ResetPassword;
