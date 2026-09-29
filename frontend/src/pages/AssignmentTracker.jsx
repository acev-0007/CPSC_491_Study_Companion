import { useEffect, useState } from "react";
import "./AssignmentTracker.css";

function AssignmentTracker() {
  const [assignments, setAssignments] = useState([]);

  const upcomingAssignments = assignments.filter(
    (assignment) => assignment.status === "Upcoming"
  );

  const inProgressAssignments = assignments.filter(
    (assignment) => assignment.status === "In Progress"
  );

  const completedAssignments = assignments.filter(
    (assignment) => assignment.status === "Completed"
  );

  const overdueAssignments = assignments.filter(
    (assignment) => assignment.status === "Overdue"
  );

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
    return (
      <div className="assignment-card" key={assignment.id}>
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
          <strong>Status:</strong> {assignment.status}
        </p>

        <p>
          <strong>Estimated Time</strong> {" "}
          {assignment.estimated_time} hours
        </p>
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
    fetchAssignments();
  }, []);

  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    })
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
      <form className="assignment-form" onSubmit={handleSubmit}>
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
          Notes
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}          
          />
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
        <button className="submit-button" type="submit">Add Assignment</button>
      </form >
      {message && <p>{message}</p>}
      
      <section className="assignment-section">
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

      <section className="assignment-section">
      <h2>Overdue</h2>
      {overdueAssignments.length === 0 
       ? <p>No assignments overdue</p>
       : overdueAssignments.map(renderAssignmentCard)}
      </section>
    </div>
  );
}

export default AssignmentTracker;
