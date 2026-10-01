import { Link } from "react-router-dom";
import "./ToolLink.css";

function ToolLink({ title, description, to }) {
  return (
    <Link className="tool-link" to={to}>
      <span className="tool-link-copy">
        <span className="tool-link-title">{title}</span>
        <span className="tool-link-description">{description}</span>
      </span>

      <span className="tool-link-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export default ToolLink;
