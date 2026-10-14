import { useEffect, useState } from "react";
import "./AssignmentTracker.css";
import { getDeadlineStatus } from "../utils/assignmentStatus";

function AssignmentTracker() {
  const [assignments, setAssignments] = useState([]);

  // sortBy stores the user's selected sorting method
  // setSortBy updates that selection
  // "duedate" amakes the due-date sorting default
  const [sortBy, setSortBy] = useState("duedate");

  const [message, setMessage] = useState("");

  const priorityOrder = {
    High: 1,
    Medium: 2,
    Low: 3
  };

  const [formData, setFormData] = useState({
    title: "",
    course: "",
    duedate: "",
    priority: "Low",
    status: "Upcoming",
    notes: "",
    estimated_time: "",
  });

  function renderAssignmentCard(assignment) {
    const deadlineState = getDeadlineStatus(assignment);

    return (
      <div 
        className={`assignment-card ${deadlineState}`}
        key={assignment.id}
      >
        <h3>{assignment.title}</h3>
           
        <p>
          <strong>Course:</strong> {assignment.course}
        </p>

        <p>
          <strong>Due Date:</strong>{" "}
          {new Date(assignment.duedate).toLocaleString()}
        </p>

        <p>
          <strong>Priority:</strong> {assignment.priority}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          <select
            value={assignment.status}
            onChange={(event) =>
              handleStatusChange(assignment.id, event.target.value)
            }
          >
            <option value="Upcoming">Upcoming</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </p>

        <p>
          <strong>Estimated Time</strong> {" "}
          {assignment.estimated_time} hours
        </p>
            
        {deadlineState === "overdue" && (
          <span className="deadline-badge overdue-badge">
            Overdue
          </span>
        )}

        {deadlineState === "due-soon" && (
          <span className="deadline-badge due-soon-badge">
            Due Soon
          </span>
        )}

        {deadlineState === "completed" && (
          <span className="deadline-badge completed-badge">
            Completed
          </span>
        )}
      </div>
    );
  }

  async function fetchAssignments() {
    try {
      const response = await fetch("http://localhost:3001/api/assignments", {
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to fetch assignments"
        );
      }

      const data = await response.json();
      setAssignments(data);
  } catch (error) {
    console.error(error);
    setMessage(error.message);
  }
}

  useEffect(() => {
  async function loadAssignments() {
    try {
      const response = await fetch("http://localhost:3001/api/assignments", {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch assignments");
      }

      const data = await response.json();
      setAssignments(data);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }
    loadAssignments();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const sortedAssignments = [...assignments].sort((a, b) => {
    if (sortBy == "duedate") {
      return new Date(a.duedate) - new Date(b.duedate);
    }

    if (sortBy == "priority-high") {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    if (sortBy == "priority-low") {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }

    return 0;
  });

  const upcomingAssignments = sortedAssignments.filter(
    (assignment) => assignment.status === "Upcoming"
  );

  const inProgressAssignments = sortedAssignments.filter(
    (assignment) => assignment.status === "In Progress"
  );

  const completedAssignments = sortedAssignments.filter(
    (assignment) => assignment.status === "Completed"
  );

  async function handleStatusChange(id, newStatus) {
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      }
    );
      if (!response.ok) {
        throw new Error("Failed to update assignment status");
      }
      const updatedAssignment = await response.json();

      setAssignments((currentAssignments) =>
        currentAssignments.map((assignment) =>
          assignment.id === id
            ? updatedAssignment
            : assignment
        )
      );
    } catch (error) {
      console.error(error)
      setMessage("Failed to update assignment status")
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if(!formData.title || !formData.course || !formData.duedate) {
      setMessage("Please fill in all the required fields.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/api/assignments", {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create assignment: ${response.status} ${errorData}`);
      }
      setMessage("Assignment created successfully!");
      await fetchAssignments();
    } catch(error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  return (
    <div className="assignment-tracker">
      <h1>Assignment Tracker</h1>
      <div className="tracker-layout">
        <div className="left-panel">
          <form className="assignment-form" onSubmit={handleSubmit}>
            <h2>Add Assignment</h2>
            <div className="form-grid">
            <label className="form-group">
              Title
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </label>
          
            <label className="form-group">
              Course
              <input
                type="text"
                name="course"
                value={formData.course}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-group">
              Due Date
              <input
                type="datetime-local"
                name="duedate"
                value={formData.duedate}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-group">
              Priority
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>

            <label className="form-group">
              Status
              <select
              name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Upcoming">Upcoming</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </label>

            <label className="form-group">
              Estimated Time
              <input
                type="number"
                name="estimated_time"
                min="1"
                value={formData.estimated_time}
                onChange={handleChange}
                required
              />
            </label>
          </div>

        <label className="form-group">
          Notes
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}          
          />
        </label>

        <button className="submit-button" type="submit">Add Assignment</button>

        {message && <p>{message}</p>}
      </form >
    </div>

    <div className="right-panel">
      <section className="assignment-section">
        <div className="assignment-sort">
          <label htmlFor="sortBy">Sort By:</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="duedate">Due Date</option>
            <option value="priority-high">Priority: High to Low</option>
            <option value="priority-low">Priority: Low to High</option>     
          </select>
        </div>
      <h2>Upcoming</h2>
      {upcomingAssignments.length === 0 
       ? <p>No upcoming assignments</p>
       : upcomingAssignments.map(renderAssignmentCard)}
      </section>

      <section className="assignment-section">
      <h2>In Progress</h2>
      {inProgressAssignments.length === 0 
       ? <p>No assignments in progress</p>
       : inProgressAssignments.map(renderAssignmentCard)}
      </section>

      <section className="assignment-section">
      <h2>Completed</h2>
      {completedAssignments.length === 0 
       ? <p>No completed assignments</p>
       : completedAssignments.map(renderAssignmentCard)}
      </section>
      </div>
      </div>  
    </div>
  );
}

export default AssignmentTracker;
