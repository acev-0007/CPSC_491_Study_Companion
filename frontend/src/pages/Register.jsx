import { useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  registerAccount,
} from "../api/auth";


function Register() {
  const navigate =
    useNavigate();

  const [
    formData,
    setFormData,
  ] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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
    accountCreated,
    setAccountCreated,
  ] = useState(false);

  const [
    requiresEmailConfirmation,
    setRequiresEmailConfirmation,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
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
      if (
        formData.password !==
        formData.confirmPassword
      ) {
        setErrorMessage(
          "Passwords do not match."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await registerAccount({
            name:
              formData.name,

            email:
              formData.email,

            password:
              formData.password,
          });
        setRequiresEmailConfirmation(
          result
            .requiresEmailConfirmation
        );

        setAccountCreated(true);

      } catch (error) {
        setErrorMessage(
          error.message
        );
      } finally {
        setLoading(false);
      }
    };

  const passwordsDoNotMatch =
    errorMessage ===
    "Passwords do not match.";


  // ========================================
  // SUCCESS SCREEN
  // ========================================

  if (accountCreated) {
    return (
      <div className="auth-page">

        <main
          className="auth-card auth-card-success"
          aria-live="polite"
        >
          <div
            className="auth-logo auth-logo-success"
            aria-hidden="true"
          >
            ✓
          </div>

          <p className="app-title">
            AI Study Companion
          </p>

          <h1 className="auth-heading">
            Account created
          </h1>

          <p className="auth-subtitle auth-success-copy">
            {requiresEmailConfirmation
              ? "Check your email to confirm your account before logging in."
              : "Your account is ready. You can continue to your dashboard."}
          </p>

          <button
            className="auth-button"
            type="button"

            onClick={() =>
              navigate(
                requiresEmailConfirmation
                  ? "/login"
                  : "/"
              )
            }
          >

            {requiresEmailConfirmation
              ? "Go to Login"
              : "Continue"}

          </button>

        </main>

      </div>
    );
  }

  // ========================================
  // REGISTRATION FORM
  // ========================================

  return (
    <div className="auth-page">

      <main className="auth-card">

        <div
          className="auth-logo"
          aria-hidden="true"
        >
          ✦
        </div>

        <p className="app-title">
          AI Study Companion
        </p>

        <h1 className="auth-heading">
          Create your account
        </h1>
        <p className="auth-subtitle">
          Create an account to save your progress and access your study tools.
        </p>


        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label htmlFor="name">
              Name
            </label>

            <input
              id="name"
              type="text"
              name="name"
              placeholder="Enter your name"
              autoComplete="name"

              value={
                formData.name
              }
              onChange={
                handleChange
              }

              required
            />

          </div>


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

            <label htmlFor="password">
              Password
            </label>

            <div className="password-field">
              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                placeholder="Create a password"
                autoComplete="new-password"

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


          <div className="form-group">

            <label
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>

            <div className="password-field">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                name="confirmPassword"
                placeholder="Confirm your password"
                autoComplete="new-password"
                aria-invalid={
                  passwordsDoNotMatch
                }
                aria-describedby={
                  passwordsDoNotMatch
                    ? "confirm-password-error"
                    : undefined
                }
                value={
                  formData
                    .confirmPassword
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
                  setShowConfirmPassword(
                    (visible) => !visible
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmed password"
                    : "Show confirmed password"
                }
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>

            {passwordsDoNotMatch && (
              <p
                id="confirm-password-error"
                className="field-error"
                role="alert"
              >
                Passwords do not match.
              </p>
            )}

          </div>


          {errorMessage &&
            !passwordsDoNotMatch && (
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
              ? "Creating Account..."
              : "Create Account"}

          </button>

        </form>


        <p className="auth-footer">

          Already have an account?{" "}

          <Link to="/login">
            Log in
          </Link>

        </p>

      </main>

    </div>
  );
}


export default Register;
