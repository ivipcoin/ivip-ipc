import { SimpleEventEmitter, JSONStringify } from "ivip-utils";
import cluster from "cluster";
import path from "path";
import fs from "fs";
import chokidar from "chokidar";
import properLockfile from "proper-lockfile";
import { NotificationContent } from "./type";

/** Verificam se o processo é um worker, primary ou master do cluster. */
const isCluster: boolean = cluster.isWorker || cluster.isPrimary || cluster.isMaster;

/** Verificam se o processo é um primary ou master do cluster. */
const isMaster: boolean = !isCluster || cluster.isPrimary || cluster.isMaster;

/** Caminho para o arquivo de comunicação compartilhado. */
const pathRoot: string = path.resolve(__dirname, "notification.ipc");

/** Array que armazena linhas pendentes a serem escritas no arquivo. */
const pending: string[] = [];

/** Identificador único para o processo, incluindo o pid do processo. */
let ipcId: string = !isMaster ? `[${process.pid}]` : "[MASTER]";

let ipcList: string[] = [ipcId];

/** Separador usado para codificar e decodificar linhas no arquivo. */
const separator: string = "_n_::_n_";

/** Mapa que armazena números como chaves e funções como valores. Essas funções serão chamadas quando uma notificação for recebida. */
const notifyCallbackMap = new Map<string, (data: NotificationContent) => void>();

/**
 * Prepara o arquivo de comunicação, criando-o se não existir.
 * @returns {Promise<void>}
 */
const prepareFile = (): Promise<void> => {
	return new Promise((resolve, reject) => {
		try {
			fs.access(pathRoot, fs.constants.F_OK, (accessErr) => {
				if (accessErr) {
					fs.writeFile(pathRoot, "", (e) => {
						if (e) {
							reject(e);
						}
						resolve();
					});
				} else {
					resolve();
				}
			});
		} catch (e) {
			reject(e);
		}
	});
};

/** Codifica um array de strings usando base64. */
const prepareLine = (colls: string[]): string => {
	return colls.map((v) => Buffer.from(v).toString("base64")).join(separator);
};

/** Decodifica a linha codificada. */
const readLine = (line: string): string[] => {
	return line.split(separator).map((v) => Buffer.from(v, "base64").toString("utf-8"));
};

/** Filtra e processa as linhas do arquivo. */
const filterLines = (header: string[], lines: string[][], inProcess: boolean = false): string[][] => {
	return lines
		.sort((a, b) => {
			return parseInt(a[0]) > parseInt(b[0]) ? 1 : parseInt(a[0]) < parseInt(b[0]) ? -1 : 0;
		})
		.map(([time, content, ...ipcIds]: string[]): string[] => {
			if (!inProcess && ipcIds.includes(ipcId) !== true) {
				try {
					const result = JSON.parse(content) as NotificationContent;

					notifyCallbackMap.forEach((callback) => {
						callback(result);
					});
				} catch {}

				ipcIds.push(ipcId);
			}
			return [time, content, ...ipcIds];
		})
		.filter(([time, content, ...ipcIds]: string[]) => {
			return inProcess || !header.slice(1).every((id: string) => ipcIds.filter((id: string) => header.slice(1).includes(id)).includes(id));
		});
};

function differenceInSeconds(date1: Date, date2: Date) {
	const diffInMilliseconds = Math.abs(date2.getTime() - date1.getTime());
	const diffInSeconds = diffInMilliseconds / 1000;
	return diffInSeconds;
}

let timestamp = Date.now();

let timeDelay: NodeJS.Timeout | undefined = undefined;
let running: boolean = false;

const breakLimitString = (input: string, maxLineLength: number = 120) => {
	input = Buffer.from(input.replaceAll("\n", "<<break-limit-string>>")).toString("base64");
	const lines: string[] = [];
	for (let i = 0; i < input.length; i += maxLineLength) {
		lines.push(input.slice(i, i + maxLineLength));
	}
	return lines.join("\n");
};

const inverseBreakLimitString = (input: string) => {
	return Buffer.from(input.split("\n").join(""), "base64").toString("utf-8").replaceAll("<<break-limit-string>>", "\n");
};

const observerEvents = () => {
	if (running) {
		return;
	}

	clearTimeout(timeDelay);

	timeDelay = setTimeout(async () => {
		running = true;

		try {
			//await prepareFile();
			if (!fs.existsSync(pathRoot)) {
				fs.writeFileSync(pathRoot, "", "utf-8");
			}

			const lockfile = properLockfile.checkSync(pathRoot);

			if (lockfile === false) {
				properLockfile.lockSync(pathRoot);

				const fileContent = inverseBreakLimitString(fs.readFileSync(pathRoot, "utf-8"));

				let [header = [], ...lines]: string[][] = fileContent
					.split(/\n/)
					.filter((line: string) => line.trim() !== "")
					.map(readLine);

				let inProcess: boolean = differenceInSeconds(new Date(timestamp), new Date()) < 5;

				if (header.length && timestamp !== parseInt(header[0])) {
					if (!header.includes(ipcId) && differenceInSeconds(new Date(parseInt(header[0])), new Date(timestamp)) > 5) {
						header = [];
						lines = [];
						inProcess = true;
					} else {
						timestamp = parseInt(header[0]);
					}
				}

				if (header.length === 0) {
					header = [timestamp.toString()];
					inProcess = true;
				}

				if (!header.includes(ipcId)) {
					header.push(ipcId);
					inProcess = true;
				}

				const linesWrite: string[] = [];

				ipcList = header.slice(1).filter((id, i, l) => l.indexOf(id) === i);

				//linesWrite.push(prepareLine(header));

				const stability = (lines ?? []).filter(([v]) => v === "stability_ipc_ids").slice(-5);

				if (stability.length > 0 && differenceInSeconds(new Date(parseInt(stability.slice(-1)[0][1])), new Date()) < 25) {
					stability[stability.length - 1].push(ipcId);
				} else {
					stability.push(["stability_ipc_ids", Date.now().toString(), ipcId]);
				}

				stability[stability.length - 1] = stability[stability.length - 1].filter((v, i, l) => l.indexOf(v) === i);

				ipcList = Array.prototype.concat
					.apply(
						[],
						stability.map(([k, t, ...ids]) => ids),
					)
					.filter((v, i, l) => l.indexOf(v) === i);

				lines = (lines ?? []).filter(([v]) => v !== "stability_ipc_ids");

				filterLines([header[0], ...ipcList], lines ?? [], inProcess).forEach((line: string[]) => {
					linesWrite.push(prepareLine(line));
				});

				if (!inProcess) {
					pending.splice(0).forEach((line: string) => {
						linesWrite.push(line);
					});
				}

				const newData = [prepareLine(header), ...stability.map(prepareLine), ...linesWrite.filter((line, i, l) => l.indexOf(line) === i)].join("\n");

				if (newData !== fileContent) {
					fs.writeFileSync(pathRoot, breakLimitString(newData), "utf-8");
				}

				properLockfile.unlockSync(pathRoot);
			}
		} catch {
			if (properLockfile.checkSync(pathRoot)) {
				await properLockfile.unlock(pathRoot).catch(() => {});
			}

			setTimeout(observerEvents, 200 + Math.round(Math.random() * 500));
		}

		running = false;
	}, 100);
};

chokidar
	.watch(pathRoot)
	.on("add", (file) => {
		observerEvents();
	})
	.on("change", (file) => {
		observerEvents();
	});

export class IPC extends SimpleEventEmitter {
	private id: string = Math.round(Math.random() * Date.now()).toString();

	/**
	 * A classe `IPC` é definida como uma subclasse de `SimpleEventEmitter` e exportada como padrão. Ela implementa a comunicação entre os processos.
	 */
	constructor() {
		super();
		notifyCallbackMap.set(this.id, ({ event, message }) => {
			this.emit(event, message);
		});
	}

	/**
	 * Este método é usado para enviar notificações entre processos.
	 * @param {string} event Tipo evento que os processos devem receber a mensagem.
	 * @param {any} message Mensagem para enviar aos processos.
	 * @returns {Promise<void>}
	 */
	notify(event: string, message: any, justOut: boolean = false): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				if (notifyCallbackMap.has(this.id)) {
					const content: NotificationContent = {
						timestamp: Date.now(),
						event: event,
						message: message,
					};

					pending.push(prepareLine([content.timestamp.toString(), JSONStringify(content), ipcId]));
					//this.emit(content.event, content.message);

					if (!justOut) {
						notifyCallbackMap.forEach((callback, id) => {
							if (id !== this.id) {
								callback(content);
							}
						});
					}

					observerEvents();
				}

				resolve();
			} catch (e) {
				reject(e);
			}
		});
	}

	/** Encerra a comunicação IPC. */
	destroy() {
		notifyCallbackMap.delete(this.id);
	}
}

const internalIPC = new IPC();

export default internalIPC;
