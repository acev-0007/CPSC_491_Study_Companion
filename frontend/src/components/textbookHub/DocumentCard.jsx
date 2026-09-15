function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentCard({ document }) {
  const failed = document.status === "failed";

  return (
    <article className="document-card">
      <div className="document-card-heading">
        <div>
          <h3>{document.name}</h3>
          <p>
            {document.type.toUpperCase()} · {formatBytes(document.size)}
          </p>
        </div>
        <span className={`status-badge ${failed ? "status-failed" : "status-ready"}`}>
          {failed ? "Extraction failed" : "Ready"}
        </span>
      </div>

      <p className="document-date">
        Uploaded {new Date(document.uploadedAt).toLocaleString()}
      </p>

      {failed && (
        <p className="hub-message hub-message-error" role="status">
          {document.extractionError || "The file was saved, but its text could not be extracted."}
        </p>
      )}
    </article>
  );
}

export default DocumentCard;
