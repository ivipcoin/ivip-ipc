import IPC from "../src";
const ipc = new IPC();

// Ouvir eventos
ipc.on("evento-personalizado", (mensagem) => {
	console.log(`[${process.pid}] Evento personalizado recebido:`, mensagem);
});

// Enviar uma notificação para outros processos
ipc.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}]`);

setTimeout(() => {
	ipc.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}] a 10s`);
}, 10000);

setTimeout(() => {
	ipc.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}] a 30s`);
}, 30000);
