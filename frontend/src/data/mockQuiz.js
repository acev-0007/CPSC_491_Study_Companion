// SCRUM-124: deterministic mock questions for the Quiz UI.
//
// This shape is the contract a future AI-generated quiz should satisfy:
// every question has a unique `id`, exactly four `options` with ids A-D,
// and a `correctOptionId` that matches one of them.
export const mockQuiz = [
  {
    id: "q1",
    question: "What is a context switch?",
    options: [
      { id: "A", text: "Changing CPU frequency" },
      { id: "B", text: "Saving and restoring execution state" },
      { id: "C", text: "Allocating virtual memory" },
      { id: "D", text: "Creating a file system" },
    ],
    correctOptionId: "B",
  },
  {
    id: "q2",
    question: "What is the purpose of a mutex?",
    options: [
      { id: "A", text: "Speeding up disk reads" },
      { id: "B", text: "Compressing process memory" },
      {
        id: "C",
        text: "Letting only one thread enter a critical section at a time",
      },
      { id: "D", text: "Scheduling threads by priority" },
    ],
    correctOptionId: "C",
  },
  {
    id: "q3",
    question: "Which condition must hold for a deadlock to occur?",
    options: [
      { id: "A", text: "Circular wait among processes" },
      { id: "B", text: "Unlimited physical memory" },
      { id: "C", text: "Preemptive scheduling" },
      { id: "D", text: "Single-threaded execution" },
    ],
    correctOptionId: "A",
  },
  {
    id: "q4",
    question: "What does a page table store?",
    options: [
      { id: "A", text: "Open file descriptors" },
      { id: "B", text: "CPU register values" },
      { id: "C", text: "Network socket states" },
      { id: "D", text: "Virtual-to-physical address mappings" },
    ],
    correctOptionId: "D",
  },
  {
    id: "q5",
    question:
      "Which scheduling algorithm gives each process a fixed time slice in turn?",
    options: [
      { id: "A", text: "First-Come, First-Served" },
      { id: "B", text: "Round Robin" },
      { id: "C", text: "Shortest Job First" },
      { id: "D", text: "Priority Scheduling" },
    ],
    correctOptionId: "B",
  },
];