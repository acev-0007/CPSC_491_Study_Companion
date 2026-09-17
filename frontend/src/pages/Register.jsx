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


  // ========================================
  // SUCCESS SCREEN
  // ========================================

  if (accountCreated) {
    return (
      <div className="auth-page">

        <div className="auth-card">

          <div className="auth-logo">
            ✓
          </div>

          <h1 className="app-title">
            AI Study Companion
          </h1>

          <h2>
            Account Created!
          </h2>

          <p className="auth-subtitle">
            Welcome to AI Study Companion.
          </p>


          <div
            style={{
              margin: "30px 0",
              padding: "22px",
              textAlign: "center",

              background:
                "rgba(124, 58, 237, 0.06)",

              border:
                "1px solid rgba(124, 58, 237, 0.15)",

              borderRadius:
                "14px",

              lineHeight:
                "1.6",
            }}
          >

            <p>
              Congratulations,{" "}

              <strong>
                {formData.name}
              </strong>
              !
            </p>

            <p>
              Your account has been
              created successfully.
            </p>

            {requiresEmailConfirmation ? (
              <p>
                Check your email to
                confirm your account
                before logging in.
              </p>
            ) : (
              <p>
                You're ready to start
                using your AI Study
                Companion.
              </p>
            )}

          </div>


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
              : "Continue to Dashboard"}

          </button>

        </div>

      </div>
    );
  }


  // ========================================
  // REGISTRATION FORM
  // ========================================

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo">
          ✦
        </div>

        <h1 className="app-title">
          AI Study Companion
        </h1>

        <h2>
          Create Your Account
        </h2>

        <p className="auth-subtitle">
          Start studying smarter
          with your AI companion.
        </p>


        <form
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

            <input
              id="password"
              type="password"
              name="password"
              placeholder="Create a password"

              value={
                formData.password
              }

              onChange={
                handleChange
              }

              required
            />

          </div>


          <div className="form-group">

            <label
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="Confirm your password"

              value={
                formData
                  .confirmPassword
              }

              onChange={
                handleChange
              }

              required
            />

          </div>


          {errorMessage && (
            <p
              style={{
                color:
                  "crimson",

                marginBottom:
                  "12px",
              }}
            >
              {errorMessage}
            </p>
          )}


          <button
            className="auth-button"
            type="submit"
            disabled={loading}
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

      </div>

    </div>
  );
}


export default Register;
