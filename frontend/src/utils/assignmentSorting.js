export function sortAssignments(assignments, sortBy) {

    const priorityOrder = {
        High: 1,
        Medium: 2,
        Low: 3,
    };

    return [...assignments].sort((a, b) => {
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
}