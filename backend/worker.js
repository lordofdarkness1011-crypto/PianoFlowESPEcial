const queueRepository = require("./repositories/queue.repository");
const emailService = require("./services/email.service");
const { env } = require("./config/env");

let isRunning = false;
let workerInterval = null;

async function processNextTask() {
  if (isRunning) return;
  isRunning = true;

  try {
    const task = queueRepository.getNextPending();
    if (!task) {
      isRunning = false;
      return;
    }

    console.log(`[Worker] Procesando tarea: ${task.id} (${task.type}) - Intento ${task.attempts + 1}`);
    queueRepository.updateStatus(task.id, "PROCESSING");

    try {
      await emailService.sendEmail({
        to: task.to,
        subject: task.subject,
        html: task.message,
        attachments: task.attachments
      });

      queueRepository.updateStatus(task.id, "SENT");
      console.log(`[Worker] Tarea completada con éxito: ${task.id}`);
    } catch (error) {
      console.error(`[Worker] Error procesando tarea ${task.id}:`, error.message);
      
      // Si superó intentos, la marcamos como fallida, si no, vuelve a pendiente para reintentar (según lógica simple)
      // O en este caso, podemos marcarla directamente fallida o permitir reintentos.
      // La instrucción pide evidenciar max_queue_attempts
      if (task.attempts >= (env.MAX_QUEUE_ATTEMPTS || 3)) {
          queueRepository.updateStatus(task.id, "FAILED", error.message);
          console.log(`[Worker] Tarea fallida permanentemente: ${task.id}`);
      } else {
          // Requeue it by setting status back to PENDING
          queueRepository.updateStatus(task.id, "PENDING", error.message);
          console.log(`[Worker] Tarea devuelta a PENDING para reintento: ${task.id}`);
      }
    }
  } finally {
    isRunning = false;
  }
}

function start() {
  if (workerInterval) return;
  const intervalMs = env.QUEUE_INTERVAL_MS || 5000;
  console.log(`[Worker] Iniciado. Revisando cola cada ${intervalMs} ms.`);
  workerInterval = setInterval(processNextTask, intervalMs);
}

function stop() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[Worker] Pausado.");
  }
}

module.exports = {
  start,
  stop
};
