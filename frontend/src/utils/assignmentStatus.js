export function isOverdue(assignment) {
    const now = new Date();
    const dueDate = new Date(assignment.duedate);
    return dueDate < now && assignment.status !== "Completed";
}

export function isDueSoon(assignment) {
    const now = new Date();
    const dueDate = new Date(assignment.duedate);

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    return (
        dueDate >= now &&
        dueDate <= threeDaysFromNow &&
        assignment.status !== "Completed"
    );
}

export function getDeadlineStatus(assignment) {
    if (assignment.status === "Completed") {
        return "completed";
    }

    if (isOverdue(assignment)) {
        return "overdue";
    }

    if (isDueSoon(assignment)) {
        return "due-soon";
    }

    return "normal"
}