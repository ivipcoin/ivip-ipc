import IPC, { Cache } from "../src";

//Ouvir eventos
IPC.on("evento-personalizado", (mensagem) => {
	console.log(`[${process.pid}] Evento personalizado recebido:`, mensagem);
});

// Enviar uma notificação para outros processos
IPC.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}]`);

setTimeout(() => {
	IPC.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}] a 10s`);
}, 10000);

setTimeout(() => {
	IPC.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}] a 30s`);

	console.log(`[${process.pid}]:: `, Cache.get("log"));
}, 30000);

Cache.set("log", `Cache de [${process.pid}]`, 200);
