const crypto = require("crypto");

const queue = new Map();

function generateId() {
  return crypto.randomUUID();
}

function enqueue(task) {
  const id = generateId();
  const newTask = {
    ...task,
    id,
    status: "PENDING",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  queue.set(id, newTask);
  
  console.log(`[Cola] Nueva tarea encolada: ${id} (${task.type}) - Estado: PENDING`);
  
  return newTask;
}

function getNextPending() {
  for (const [id, task] of queue.entries()) {
    if (task.status === "PENDING") {
      return task;
    }
  }
  return null;
}

function updateStatus(id, status, error = null) {
  const task = queue.get(id);
  if (!task) return null;

  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (error) {
    task.error = error;
  }
  
  if (status === "PROCESSING") {
      task.attempts += 1;
  }

  queue.set(id, task);
  return task;
}

function getAll() {
    return Array.from(queue.values());
}

module.exports = {
  enqueue,
  getNextPending,
  updateStatus,
  getAll
};
