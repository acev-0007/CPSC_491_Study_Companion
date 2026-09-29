import { useState } from "react";





function DocumentDetailModal({
  document,
  categories,
  onSave,
  onDelete,
  onClose,
}) {
  const [name, setName] = useState(document.name);
  const [category, setCategory] = useState(document.category || "Other");
  const [course, setCourse] = useState(document.course || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
async function handleSave() {
  setSaving(true);

  const success = await onSave(document.id, {
    name,
    category,
    course,
  });

  setSaving(false);

  if (success) {
    onClose();
  }
}

async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${document.name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      await onDelete(document.id);
    } finally {
      setDeleting(false);
    }
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }


  return (
    <div className="document-modal-overlay" onClick={handleOverlayClick}>
      <section className="document-modal" role="dialog" aria-modal="true">
        <div className="document-modal-header">
          <h2 style={{ color: 'black' }}>Document details</h2>   
        </div>

        <div className="document-modal-actions">
          <button
            type="button"
            className="document-delete-button"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>


          <button
            type="button"
            className="hub-primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            className="hub-secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="document-modal-fields">
          <label>
            <h2 style={{ color: 'black' }}>Name</h2>  
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label>
            <h2 style={{ color: 'black' }}>Category</h2>  
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <h2 style={{ color: 'black' }}>Course</h2>  
            <input
              type="text"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
            />
          </label>
        </div>

        <div className="document-modal-metadata">
          <p>
            <strong>Type:</strong> {document.type}
          </p>

          <p>
            <strong>Status:</strong> {document.status}
          </p>

          <p>
            <strong>Size:</strong> {document.size} bytes
          </p>

          <p>
            <strong>Text length:</strong> {document.textLength ?? 0}
          </p>

          <p>
            <strong>Uploaded:</strong>{" "}
            {new Date(document.uploadedAt).toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}

export default DocumentDetailModal;