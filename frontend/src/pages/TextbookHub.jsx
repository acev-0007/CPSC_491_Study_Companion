import { useEffect, useMemo, useState } from "react";

import DocumentCard from "../components/textbookHub/DocumentCard";
import DocumentUploadForm from "../components/textbookHub/DocumentUploadForm";
import DocumentDetailModal from "../components/textbookHub/DocumentDetailModal";

import {
  listDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument,
  retryDocument,
} from "../api/documents";

import "./TextbookHub.css";

const CATEGORIES = [
  "Textbook",
  "Lecture Notes",
  "Study Guide",
  "Assignment",
  "Reference",
  "Other",
];

const SORT_OPTIONS = {
  NEWEST: "newest",
  OLDEST: "oldest",
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
};

function getRequestError(
  requestError,
  fallback
) {
  if (
    typeof requestError?.message ===
      "string" &&
    requestError.message.trim()
  ) {
    return requestError.message;
  }

  return fallback;
}

function TextbookHub() {
  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [category, setCategory] =
    useState("Other");

  const [course, setCourse] =
    useState("");

  const [
    selectedDocument,
    setSelectedDocument,
  ] = useState(null);

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("All");

  const [
    courseFilter,
    setCourseFilter,
  ] = useState("All");

  const [
    sortOrder,
    setSortOrder,
  ] = useState(
    SORT_OPTIONS.NEWEST
  );

  const courseOptions =
    useMemo(() => {
      return [
        ...new Set(
          documents
            .map(
              (document) =>
                document.course
            )
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a.localeCompare(b)
      );
    }, [documents]);

  const visibleDocuments =
    useMemo(() => {
      const filtered =
        documents.filter(
          (document) => {
            const matchesCategory =
              categoryFilter ===
                "All" ||
              document.category ===
                categoryFilter;

            const matchesCourse =
              courseFilter ===
                "All" ||
              document.course ===
                courseFilter;

            return (
              matchesCategory &&
              matchesCourse
            );
          }
        );

      return [
        ...filtered,
      ].sort(
        (
          firstDocument,
          secondDocument
        ) => {
          if (
            sortOrder ===
            SORT_OPTIONS.OLDEST
          ) {
            return (
              new Date(
                firstDocument.uploadedAt
              ).getTime() -
              new Date(
                secondDocument.uploadedAt
              ).getTime()
            );
          }

          if (
            sortOrder ===
            SORT_OPTIONS.NAME_ASC
          ) {
            return (
              firstDocument.name ??
              ""
            ).localeCompare(
              secondDocument.name ??
                ""
            );
          }

          if (
            sortOrder ===
            SORT_OPTIONS.NAME_DESC
          ) {
            return (
              secondDocument.name ??
              ""
            ).localeCompare(
              firstDocument.name ??
                ""
            );
          }

          return (
            new Date(
              secondDocument.uploadedAt
            ).getTime() -
            new Date(
              firstDocument.uploadedAt
            ).getTime()
          );
        }
      );
    }, [
      documents,
      categoryFilter,
      courseFilter,
      sortOrder,
    ]);

  const hasActiveFilters =
    categoryFilter !== "All" ||
    courseFilter !== "All";

  useEffect(() => {
    let cancelled = false;

    listDocuments()
      .then(
        (loadedDocuments) => {
          if (!cancelled) {
            setDocuments(
              Array.isArray(
                loadedDocuments
              )
                ? loadedDocuments
                : []
            );
          }
        }
      )
      .catch(
        (requestError) => {
          if (!cancelled) {
            setError(
              getRequestError(
                requestError,
                "Could not load your documents. Please try again."
              )
            );
          }
        }
      )
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const loadedDocuments =
        await listDocuments();

      setDocuments(
        Array.isArray(
          loadedDocuments
        )
          ? loadedDocuments
          : []
      );
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          "Could not refresh your documents. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file) {
    setUploading(true);
    setError("");

    try {
      const created =
        await uploadDocument(
          file,
          category,
          course
        );

      setDocuments(
        (current) => [
          created,
          ...current,
        ]
      );

      setCategory("Other");
      setCourse("");

      return true;
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          "Could not upload this document. Please try again."
        )
      );

      return false;
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(
    id
  ) {
    setError("");

    try {
      await deleteDocument(id);

      setDocuments(
        (current) =>
          current.filter(
            (document) =>
              document.id !== id
          )
      );

      setSelectedDocument(null);

      return {
        success: true,
      };
    } catch (requestError) {
      const message =
        getRequestError(
          requestError,
          "Could not delete this document. Please try again."
        );

      setError(message);

      return {
        success: false,
        error: message,
      };
    }
  }

  async function handleUpdateDocument(
    id,
    updates
  ) {
    setError("");

    try {
      const updated =
        await updateDocument(
          id,
          updates
        );

      setDocuments(
        (current) =>
          current.map(
            (document) =>
              document.id ===
              updated.id
                ? updated
                : document
          )
      );

      setSelectedDocument(
        updated
      );

      return {
        success: true,
      };
    } catch (requestError) {
      const message =
        getRequestError(
          requestError,
          "Could not save document changes. Please try again."
        );

      setError(message);

      return {
        success: false,
        error: message,
      };
    }
  }

  async function handleRetryDocument(
    id
  ) {
    setError("");

    try {
      const updated =
        await retryDocument(id);

      setDocuments(
        (current) =>
          current.map(
            (document) =>
              document.id ===
              updated.id
                ? updated
                : document
          )
      );

      setSelectedDocument(
        updated
      );

      return {
        success: true,
      };
    } catch (requestError) {
      const message =
        getRequestError(
          requestError,
          "Could not retry document processing. Please try again."
        );

      setError(message);

      return {
        success: false,
        error: message,
      };
    }
  }

  function handleOpenDocument(
    document
  ) {
    setError("");
    setSelectedDocument(
      document
    );
  }

  function handleCloseDocument() {
    setError("");
    setSelectedDocument(null);
  }

  function clearFilters() {
    setCategoryFilter("All");
    setCourseFilter("All");
  }

  return (
    <section className="textbook-hub">
      <header className="hub-page-header">
        <div>
          <p className="hub-eyebrow">
            Study materials
          </p>

          <h2>
            Textbook Hub
          </h2>

          <p className="hub-intro">
            Upload your TXT, PDF,
            and DOCX study
            documents so they can
            be organized here and
            read by AI study
            features later.
          </p>
        </div>
      </header>

      <DocumentUploadForm
        onUpload={handleUpload}
        uploading={uploading}
        category={category}
        setCategory={setCategory}
        categories={CATEGORIES}
        course={course}
        setCourse={setCourse}
      />

      {error &&
        !selectedDocument && (
          <p
            className="hub-message hub-message-error"
            role="alert"
          >
            {error}
          </p>
        )}

      <div className="hub-library-heading">
        <h2>
          Your documents — select
          a card to view, edit, or
          delete
        </h2>

        <button
          className="hub-secondary-button"
          type="button"
          onClick={loadDocuments}
          disabled={loading}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div className="hub-filters">
        <label>
          Category

          <select
            value={
              categoryFilter
            }
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All categories
            </option>

            {CATEGORIES.map(
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
          Course

          <select
            value={courseFilter}
            onChange={(event) =>
              setCourseFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All courses
            </option>

            {courseOptions.map(
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
          Sort

          <select
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(
                event.target.value
              )
            }
          >
            <option
              value={
                SORT_OPTIONS.NEWEST
              }
            >
              Newest first
            </option>

            <option
              value={
                SORT_OPTIONS.OLDEST
              }
            >
              Oldest first
            </option>

            <option
              value={
                SORT_OPTIONS.NAME_ASC
              }
            >
              Name A–Z
            </option>

            <option
              value={
                SORT_OPTIONS.NAME_DESC
              }
            >
              Name Z–A
            </option>
          </select>
        </label>

        <button
          type="button"
          className="hub-secondary-button"
          onClick={clearFilters}
          disabled={
            !hasActiveFilters
          }
        >
          Clear filters
        </button>
      </div>

      {!loading &&
        documents.length > 0 && (
          <p
            className="hub-state"
            role="status"
          >
            Showing{" "}
            {
              visibleDocuments.length
            }{" "}
            of {documents.length}{" "}
            document
            {documents.length === 1
              ? ""
              : "s"}.
          </p>
        )}

      {loading ? (
        <p
          className="hub-state"
          role="status"
        >
          Loading documents...
        </p>
      ) : documents.length ===
        0 ? (
        <div className="hub-empty-state">
          <h3>
            No documents yet
          </h3>

          <p>
            Upload a TXT, PDF, or
            DOCX file to start
            building your study
            library.
          </p>
        </div>
      ) : visibleDocuments.length ===
        0 ? (
        <div className="hub-empty-state">
          <h3>
            No matching documents
          </h3>

          <p>
            No documents match the
            selected filters.
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              className="hub-secondary-button"
              onClick={
                clearFilters
              }
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="document-grid">
          {visibleDocuments.map(
            (document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onOpen={() =>
                  handleOpenDocument(
                    document
                  )
                }
              />
            )
          )}
        </div>
      )}

      {selectedDocument && (
        <DocumentDetailModal
          document={
            selectedDocument
          }
          categories={
            CATEGORIES
          }
          onSave={
            handleUpdateDocument
          }
          onDelete={
            handleDeleteDocument
          }
          onRetry={
            handleRetryDocument
          }
          requestError={error}
          onClearError={() =>
            setError("")
          }
          onClose={
            handleCloseDocument
          }
        />
      )}
    </section>
  );
}

export default TextbookHub;