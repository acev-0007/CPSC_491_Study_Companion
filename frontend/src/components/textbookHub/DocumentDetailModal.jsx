import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

function actionSucceeded(
  result
) {
  return (
    result === true ||
    result?.success === true
  );
}

function actionError(
  result,
  fallback
) {
  if (
    typeof result?.error ===
      "string" &&
    result.error.trim()
  ) {
    return result.error;
  }

  return fallback;
}

function DocumentDetailModal({
  document,
  categories,
  onSave,
  onDelete,
  onRetry,
  requestError,
  onClearError,
  onClose,
}) {
  const [name, setName] =
    useState(document.name);

  const [
    category,
    setCategory,
  ] = useState(
    document.category ||
      "Other"
  );

  const [course, setCourse] =
    useState(
      document.course || ""
    );

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [retrying, setRetrying] =
    useState(false);

  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  const [
    localError,
    setLocalError,
  ] = useState("");

  const navigate =
    useNavigate();

  const isReady =
    document.status ===
    "ready";

  const isFailed =
    document.status ===
    "failed";

  const isProcessing =
    document.status ===
    "processing";

  const displayedError =
    localError ||
    requestError ||
    "";

  function clearMessages() {
    setLocalError("");
    setActionMessage("");

    onClearError?.();
  }

  function handleStudyAction(
    path
  ) {
    if (!isReady) {
      return;
    }

    navigate(
      `${path}?documentId=${document.id}`
    );
  }

  async function handleSave() {
    clearMessages();
    setSaving(true);

    try {
      const result =
        await onSave(
          document.id,
          {
            name,
            category,
            course,
          }
        );

      if (
        actionSucceeded(
          result
        )
      ) {
        onClose();
        return;
      }

      setLocalError(
        actionError(
          result,
          "Could not save document changes. Please try again."
        )
      );
    } catch {
      setLocalError(
        "Could not save document changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    clearMessages();

    const confirmed =
      window.confirm(
        `Delete "${document.name}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const result =
        await onDelete(
          document.id
        );

      if (
        !actionSucceeded(
          result
        )
      ) {
        setLocalError(
          actionError(
            result,
            "Could not delete this document. Please try again."
          )
        );
      }
    } catch {
      setLocalError(
        "Could not delete this document. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleRetry() {
    clearMessages();
    setRetrying(true);

    try {
      const result =
        await onRetry(
          document.id
        );

      if (
        actionSucceeded(
          result
        )
      ) {
        setActionMessage(
          "Document processing completed successfully."
        );

        return;
      }

      setLocalError(
        actionError(
          result,
          "Could not retry document processing. Please try again."
        )
      );
    } catch {
      setLocalError(
        "Could not retry document processing. Please try again."
      );
    } finally {
      setRetrying(false);
    }
  }

  function handleOverlayClick(
    event
  ) {
    if (
      event.target ===
        event.currentTarget &&
      !saving &&
      !deleting &&
      !retrying
    ) {
      onClose();
    }
  }

  return (
    <div
      className="document-modal-overlay"
      onClick={
        handleOverlayClick
      }
    >
      <section
        className="document-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-details-title"
      >
        <div className="document-modal-header">
          <h2
            id="document-details-title"
            style={{
              color:
                "black",
            }}
          >
            Document details
          </h2>
        </div>

        {displayedError && (
          <p
            className="hub-message hub-message-error"
            role="alert"
          >
            {displayedError}
          </p>
        )}

        {actionMessage && (
          <p
            className="hub-message"
            role="status"
          >
            {actionMessage}
          </p>
        )}

        <div className="document-modal-actions">
          <button
            type="button"
            className="document-delete-button"
            onClick={
              handleDelete
            }
            disabled={
              deleting ||
              saving ||
              retrying
            }
          >
            {deleting
              ? "Deleting..."
              : "Delete"}
          </button>

          <button
            type="button"
            className="hub-primary-button"
            onClick={
              handleSave
            }
            disabled={
              saving ||
              deleting ||
              retrying
            }
          >
            {saving
              ? "Saving..."
              : "Save"}
          </button>

          <button
            type="button"
            className="hub-secondary-button"
            onClick={onClose}
            disabled={
              saving ||
              deleting ||
              retrying
            }
          >
            Close
          </button>
        </div>

        <div className="document-modal-fields">
          <label>
            <h2
              style={{
                color:
                  "black",
              }}
            >
              Name
            </h2>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              disabled={
                saving ||
                deleting ||
                retrying
              }
            />
          </label>

          <div className="document-study-actions">
            <button
              type="button"
              className="hub-primary-button"
              onClick={() =>
                handleStudyAction(
                  "/summarization"
                )
              }
              disabled={
                !isReady ||
                retrying
              }
            >
              Generate Notes
            </button>

            <button
              type="button"
              className="hub-primary-button"
              onClick={() =>
                handleStudyAction(
                  "/quiz"
                )
              }
              disabled={
                !isReady ||
                retrying
              }
            >
              Generate Quiz
            </button>

            <button
              type="button"
              className="hub-primary-button"
              onClick={() =>
                handleStudyAction(
                  "/flashcards"
                )
              }
              disabled={
                !isReady ||
                retrying
              }
            >
              Generate Flashcards
            </button>
          </div>

          {isProcessing && (
            <p
              className="hub-message"
              role="status"
            >
              This document is
              still being
              processed. AI study
              actions will become
              available when
              processing finishes.
            </p>
          )}

          {isFailed && (
            <div>
              <p
                className="hub-message hub-message-error"
                role="alert"
              >
                {document.extractionError ||
                  "Document processing failed. You can retry processing using the original uploaded file."}
              </p>

              <button
                type="button"
                className="hub-primary-button"
                onClick={
                  handleRetry
                }
                disabled={
                  deleting ||
                  saving ||
                  retrying
                }
              >
                {retrying
                  ? "Retrying processing..."
                  : "Retry Processing"}
              </button>
            </div>
          )}

          {!isReady &&
            !isProcessing &&
            !isFailed && (
              <p
                className="hub-message"
                role="status"
              >
                AI study actions
                are unavailable
                until this
                document is ready.
              </p>
            )}

          <label>
            <h2
              style={{
                color:
                  "black",
              }}
            >
              Category
            </h2>

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
              disabled={
                saving ||
                deleting ||
                retrying
              }
            >
              {categories.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <h2
              style={{
                color:
                  "black",
              }}
            >
              Course
            </h2>

            <input
              type="text"
              value={course}
              onChange={(event) =>
                setCourse(
                  event.target.value
                )
              }
              disabled={
                saving ||
                deleting ||
                retrying
              }
            />
          </label>
        </div>

        <div className="document-modal-metadata">
          <p>
            <strong>
              Type:
            </strong>{" "}
            {document.type}
          </p>

          <p>
            <strong>
              Status:
            </strong>{" "}
            {retrying
              ? "processing"
              : document.status}
          </p>

          <p>
            <strong>
              Size:
            </strong>{" "}
            {document.size} bytes
          </p>

          <p>
            <strong>
              Text length:
            </strong>{" "}
            {document.textLength ??
              0}
          </p>

          <p>
            <strong>
              Uploaded:
            </strong>{" "}
            {new Date(
              document.uploadedAt
            ).toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}

export default DocumentDetailModal;