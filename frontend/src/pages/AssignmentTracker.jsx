import { useEffect, useState } from "react";
import "./AssignmentTracker.css";
import { getDeadlineStatus } from "../utils/assignmentStatus";
import { sortAssignments } from "../utils/assignmentSorting";

function AssignmentTracker() {
  const [assignments, setAssignments] = useState([]);

  // sortBy stores the user's selected sorting method
  // setSortBy updates that selection
  // "duedate" amakes the due-date sorting default
  const [sortBy, setSortBy] = useState("duedate");

  const [message, setMessage] = useState("");

  const [workPlan, setWorkPlan] = useState(null);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);

  const [generatePlan, setGeneratePlan] = useState(false);

  const [savePlan, setSavePlan] = useState(false);

  const [workPlanError, setWorkPlanError] = useState("");

  const [workPlanWarning, setWorkPlanWarning] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    course: "",
    duedate: "",
    priority: "Low",
    status: "Upcoming",
    notes: "",
    estimated_time: "",
  });


  async function handleGenerateWorkPlan(assignmentId) {
    setGeneratePlan(true);
    setWorkPlanError("");
    setWorkPlanWarning([]);
    setWorkPlan(null);
    setSelectedAssignmentId(assignmentId);

    try {
      const response = await fetch(
        "http://localhost:3001/api/ai/work-plan",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId,
            hoursPerDay: 2,
            // Add the user's timezone to the request body
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Failed to generate work plan"
        );
      }
      setWorkPlan(data.workPlan);
      setWorkPlanWarning(data.warnings || []);
    } catch (error) {
      console.error(error);
      setWorkPlanError(error.message);
    } finally {
      setGeneratePlan(false);
    }
  }
  

  // ===== TEMPORARY TESTING FUNCTION (USING FOR NOW UNTIL TESTING) =====
  // async function handleGenerateWorkPlan(assignmentId) {
  //   setGeneratePlan(true);
  //   setWorkPlanError("");
  //   setWorkPlanWarning([]);
  //   setWorkPlan(null);
  //   setSelectedAssignmentId(assignmentId);
  
  //   try {
  //     // TEMPORARY MOCK DATA - NO CLAUDE API CALL
  //     const mockWorkPlan = [
  //       {
  //         title: "Research Paper - Research",
  //         scheduled_date: "2026-11-06",
  //         estimated_time: 2,
  //         notes: "Find research sources.",
  //       },
  //       {
  //         title: "Research Paper - Outline",
  //         scheduled_date: "2026-11-07",
  //         estimated_time: 2,
  //         notes: "Create the outline.",
  //       },
  //       {
  //         title: "Research Paper - Writing",
  //         scheduled_date: "2026-11-08",
  //         estimated_time: 2,
  //         notes: "Write and revise the paper.",
  //       },
  //     ];
  
  //     setWorkPlan(mockWorkPlan);
  //     setWorkPlanWarning([]);
  
  //   } catch (error) {
  //     console.error(error);
  //     setWorkPlanError(error.message);
  //   } finally {
  //     setGeneratePlan(false);
  //   }
  // }
  // ===============================================================

  async function handleSaveWorkPlan() {
    if (!workPlan || !selectedAssignmentId) {
      return;
    }
    setSavePlan(true);
    setWorkPlanError("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/assignments/work-plan",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId: selectedAssignmentId,
            workPlan,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Faled to save work plan"
        );
      }

      await fetchAssignments();
      setWorkPlan(null);
      setSelectedAssignmentId(null);
      setWorkPlanWarning([]);
      setMessage("AI Work Plan saved successfully!");

    } catch (error) {
      console.error(error);
      setWorkPlanError(error.message);
    } finally {
      setSavePlan(false);
    }
  }

  function handleWorkPlanChange(index, field, value) {
    setWorkPlan((currentPlan) =>
      currentPlan.map((task, taskIndex) =>
        taskIndex === index
          ? {
              ...task,
              [field]:
                field === "estimated_time"
                  ? Number(value)
                  : value,
            }
          : task
      )
    );
  }

  function renderAssignmentCard(assignment) {
    const deadlineState = getDeadlineStatus(assignment);
    return (
      <div 
        className={`assignment-card ${deadlineState}`}
        key={assignment.id}
      >
        <button
          type="button"
          className="delete-button"
          onClick={() => handleDeleteAssignment(assignment.id)}
          aria-label={`Delete ${assignment.title}`}
          title="Delete assignments"
        >
          &times;
        </button>
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
       
        <p>
          <strong>Notes:</strong>{" "}
          {assignment.notes}
        </p>
       
        {assignment.is_ai_generated && (
          <p className="ai-generated-label">
            AI Generated Study Task
          </p>
        )}
       
        {!assignment.is_ai_generated && assignment.status !== "Completed" && (
          <button
            type="button"
            className="generate-plan-button"
            onClick={() => handleGenerateWorkPlan(assignment.id)}
            disabled={generatePlan || savePlan}
          >
            {generatePlan && selectedAssignmentId === assignment.id
              ? "Generating ..."
              : "Generate AI Work Plan"
            }
          </button>
        )}

        {selectedAssignmentId === assignment.id && (
          <div className="work-plan-preview">
            {workPlanError && (
              <p className="work-plan-error">
                {workPlanError}
              </p>
            )}

            {workPlanWarning.map((warnings, index) => (
              <p key={index} className="work-plan-warning">
                {warnings}
              </p>
            ))}

            {workPlan && workPlan.length > 0 && (
              <>
                <h4>AI-Generated Work Plan</h4>
                {workPlan.map((task, index) => (
                  <div className="work-plan-task" key={index}>
                    <label className="form-group">
                      Task Title
                      <input 
                        type="text"
                        value={task.title}
                        onChange={(event) =>
                          handleWorkPlanChange(index, "title", event.target.value)
                        }
                      />  
                    </label>

                    <label className="form-group">
                      Study Date
                      <input 
                        type="date"
                        value={task.scheduled_date}
                        onChange={(event) =>
                          handleWorkPlanChange(index, "scheduled_date", event.target.value)
                        }
                      /> 
                    </label>

                    <label className="form-group">
                      Estimated Time (Hours)
                      <input 
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={task.estimated_time}
                        onChange={(event) =>
                          handleWorkPlanChange(index, "estimated_time", event.target.value)
                        }
                      /> 
                    </label>

                    <label className="form-group">
                      Notes
                      <textarea 
                        value={task.notes}
                        onChange={(event) =>
                          handleWorkPlanChange(index, "notes", event.target.value)
                        }
                      /> 
                    </label>

                  </div>
                ))}
              <div className="work-plan-actions">
                <button
                  type="button"
                  className="regenerate-plan-button"
                  onClick={() => handleGenerateWorkPlan(selectedAssignmentId)}
                  disabled={generatePlan || savePlan}
                >
                  {generatePlan ? "Regenerating..." : "Regenerate Work Plan"}
                </button>
                <button
                  type="button"
                  className="save-plan-button"
                  onClick={handleSaveWorkPlan}
                  disabled={savePlan || generatePlan}
                >
                  {savePlan ? "Saving ..." : "Save Work Plan"}
                </button>
                <button
                  type="button"
                  className="cancel-plan-button"
                  onClick={() => {
                    setWorkPlan(null);
                    setSelectedAssignmentId(null);
                    setWorkPlanError("");
                    setWorkPlanWarning([]);
                  }}
                  disabled={savePlan}
                >
                  Cancel
                </button>
              </div>
              </>
            )}
          </div>
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

  const sortedAssignments = sortAssignments(assignments, sortBy);
 
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

  async function handleDeleteAssignment(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this assignment?"
    );
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/assignments/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete assignment");
      }

      setAssignments((currentAssignments) => 
        currentAssignments.filter(
          (assignment) => assignment.id !== id
        )
      );

      setMessage("Assignment deleted successfully");
    } catch (error) {
      console.error(error);
      setMessage("Failed to delete assignment");
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
