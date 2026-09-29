import { useState } from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  loginAccount,
} from "../api/auth";


function Login() {
  const navigate =
    useNavigate();

  const [
    formData,
    setFormData,
  ] = useState({
    email: "",
    password: "",
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };


  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setErrorMessage("");
      setLoading(true);

      try {
        await loginAccount({
          email:
            formData.email,

          password:
            formData.password,
        });

        navigate("/");
      } catch (error) {
        setErrorMessage(
          error.message
        );
      } finally {
        setLoading(false);
      }
    };


  return (
    <div className="auth-page">

      <header className="auth-brand">
        <div
          className="auth-brand-mark"
          aria-hidden="true"
        >
          ✦
        </div>

        <div className="auth-brand-copy">
          <p className="auth-brand-name">
            AI Study Companion
          </p>
          <p className="auth-brand-tagline">
            Your personalized AI learning workspace.
          </p>
        </div>
      </header>

      <main className="auth-shell">
        <section
          className="auth-panel"
          aria-labelledby="login-heading"
        >
          <div className="auth-intro">
            <h1
              id="login-heading"
              className="auth-heading"
            >
              Welcome back
            </h1>
            <p className="auth-subtitle">
              Log in to continue studying.
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            <div className="form-group">

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"

                value={
                  formData.email
                }
                onChange={
                  handleChange
                }

                required
              />

            </div>


            <div className="form-group">

              <div className="field-label-row">
                <label htmlFor="password">
                  Password
                </label>
              </div>

              <div className="password-field">
                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"

                  value={
                    formData.password
                  }
                  onChange={
                    handleChange
                  }

                  required
                />

                <button
                  className="password-toggle"
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (visible) => !visible
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>

            </div>


            <div className="forgot-password">
              <a href="#">
                Forgot password?
              </a>
            </div>


            {errorMessage && (
              <div
                className="auth-message auth-message-error"
                role="alert"
              >
                <span
                  className="auth-message-icon"
                  aria-hidden="true"
                >
                  !
                </span>
                <span>{errorMessage}</span>
              </div>
            )}


            <button
              className="auth-button"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >

              {loading
                ? "Logging In..."
                : "Log In"}

            </button>

          </form>


          <p className="auth-footer">

            Don't have an account?{" "}
            <Link to="/register">
              Create an account
            </Link>

          </p>
        </section>
      </main>

    </div>
  );
}


export default Login;
