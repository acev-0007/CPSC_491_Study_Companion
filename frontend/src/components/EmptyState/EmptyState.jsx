import "./EmptyState.css";

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export default EmptyState;
