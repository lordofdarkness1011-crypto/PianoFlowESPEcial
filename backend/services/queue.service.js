const queueRepository = require("../repositories/queue.repository");

/**
 * Agrega una tarea de correo a la cola
 * @param {Object} data 
 * @param {string} data.type ACCOUNT_VERIFICATION, PASSWORD_RECOVERY, CUSTOM_NOTIFICATION, ATTACHMENT_NOTIFICATION
 * @param {string} data.to
 * @param {string} data.subject
 * @param {string} data.html
 * @param {Array} data.attachments
 */
function enqueueEmailTask(data) {
  const task = {
    type: data.type,
    to: data.to,
    subject: data.subject,
    message: data.html, // Guardamos el html como message
    attachments: data.attachments || []
  };
  
  const createdTask = queueRepository.enqueue(task);
  console.log(`[Queue] Tarea encolada: ${createdTask.id} (${createdTask.type})`);
  return createdTask;
}

function getQueueStatus() {
    return queueRepository.getAll();
}

module.exports = {
  enqueueEmailTask,
  getQueueStatus
};
