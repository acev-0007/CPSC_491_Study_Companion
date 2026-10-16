import { Link } from "react-router-dom";

// Sprint 3: presentation-only skeleton. Password recovery is implemented in Sprint 4.
function ForgotPassword() {
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

          <div className="auth-form">
            <div className="form-group">
              <label htmlFor="recovery-email">Email Address</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <button type="button" className="auth-button" disabled>
              Reset Password
            </button>
            <p className="recovery-unavailable" role="status">
              Password recovery will be available soon.
            </p>
          </div>

          <div className="recovery-footer">
            <Link to="/login"><span aria-hidden="true">←</span> Back to Login</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ForgotPassword;
