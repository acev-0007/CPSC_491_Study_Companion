import { Link } from "react-router-dom";

function Login() {
  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("Login form submitted");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✦</div>

        <h1 className="app-title">AI Study Companion</h1>

        <h2>Welcome Back</h2>

        <p className="auth-subtitle">
          Log in to continue your study session.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>

            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="forgot-password">
            <a href="#">Forgot password?</a>
          </div>

          <button className="auth-button" type="submit">
            Log In
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
