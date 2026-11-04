import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordRecovery } from "../api/auth";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setConfirmation("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      const result = await requestPasswordRecovery({ email: normalizedEmail });
      setConfirmation(result.message);
    } catch (requestError) {
      setError(requestError.status === 429
        ? "Too many recovery requests. Please try again later."
        : requestError.status === 400
          ? "Enter a valid email address."
          : "Unable to request password recovery right now. Please try again later.");
    } finally {
      setPending(false);
    }
  }

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
        <section className="auth-panel recovery-panel" aria-labelledby="recovery-heading">
          <div className="auth-intro recovery-intro">
            <p className="recovery-eyebrow"><span aria-hidden="true">✦</span> ACCOUNT RECOVERY</p>
            <h1 id="recovery-heading" className="auth-heading">Forgot your password?</h1>
            <p className="auth-subtitle">
              Enter your email address and we’ll help you reset your password.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="recovery-email">Email Address</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "recovery-error" : undefined}
                required
                maxLength={254}
                disabled={pending}
              />
            </div>
            {error && (
              <div id="recovery-error" className="auth-message auth-message-error" role="alert">
                <span>{error}</span>
              </div>
            )}
            {confirmation && (
              <p className="recovery-confirmation" role="status" aria-live="polite">
                {confirmation}
              </p>
            )}
            <button type="submit" className="auth-button" disabled={pending} aria-busy={pending}>
              {pending ? "Sending..." : "Reset Password"}
            </button>
          </form>

          <div className="recovery-footer">
            <Link to="/login"><span aria-hidden="true">←</span> Back to Login</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ForgotPassword;
