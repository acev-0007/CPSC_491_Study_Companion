import { useEffect, useState } from "react";
import "./AssignmentTracker.css"

function AssignmentTracker() {
  const [assignments, setAssignments] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    course: "",
    duedate: "",
    priority: "Low",
    status: "Upcoming",
    notes: "",
    estimated_time: "",
  });

  async function fetchAssignments() {
    const response = await fetch("http://localhost:3000/api/assignments");
    const data = await response.json();
    setAssignments(data);
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
      const response = await fetch("http://localhost:3000/api/assignments", {
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
          />
        </label>
        <button className="assignment-form" type="submit">Add Assignment</button>
      </form >
      {message && <p>{message}</p>}
      <h2>Assignments</h2>
      {assignments.map((assignment) => (
        <p key={assignment.id}>
          {assignment.title}
        </p>
      ))}
    </div>
  );
}

export default AssignmentTracker;
