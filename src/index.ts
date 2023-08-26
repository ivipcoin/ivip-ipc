import { SimpleEventEmitter } from "ivipbase-core";
import cluster from "cluster";
import path from "path";
import fs from "fs";
import properLockfile from "proper-lockfile";

interface NotificationContent {
	timestamp: number | string | Date;
	event: string;
	message: any;
}

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

/** Separador usado para codificar e decodificar linhas no arquivo. */
const separator: string = "_n_::_n_";

/** Mapa que armazena números como chaves e funções como valores. Essas funções serão chamadas quando uma notificação for recebida. */
const notifyCallbackMap = new Map<number, (data: NotificationContent) => void>();

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
		.map((line: string[]): string[] => {
			if (!inProcess && line.includes(ipcId) !== true) {
				const content = JSON.parse(line[0]) as NotificationContent;

				notifyCallbackMap.forEach((callback) => {
					callback(content);
				});

				line.push(ipcId);
			}
			return line;
		})
		.filter((line: string[]) => {
			return inProcess || !header.slice(1).every((id: string) => line.includes(id));
		});
};

function differenceInSeconds(date1: Date, date2: Date) {
	const diffInMilliseconds = Math.abs(date2.getTime() - date1.getTime());
	const diffInSeconds = diffInMilliseconds / 1000;
	return diffInSeconds;
}

let timestamp = Date.now();

const observerEvents = async () => {
	try {
		await prepareFile().catch(() => Promise.resolve());

		while (true) {
			const lockfile = properLockfile.checkSync(pathRoot);

			if (lockfile === false) {
				properLockfile.lockSync(pathRoot);

				const fileContent = fs.readFileSync(pathRoot, "utf-8");

				let [header = [], ...lines]: string[][] = fileContent
					.split(/\n/)
					.filter((line: string) => line.trim() !== "")
					.map(readLine);

				let inProcess: boolean = false;

				if (header.length && timestamp !== parseInt(header[0])) {
					if (differenceInSeconds(new Date(parseInt(header[0])), new Date(timestamp)) > 10) {
						header = [];
						lines = [];
						inProcess = true;
					} else {
						timestamp = parseInt(header[0]);
						inProcess = differenceInSeconds(new Date(parseInt(header[0])), new Date()) < 10;
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

				linesWrite.push(prepareLine(header));

				filterLines(header, lines ?? [], inProcess).forEach((line: string[]) => {
					linesWrite.push(prepareLine(line));
				});

				pending.splice(0).forEach((line: string) => {
					linesWrite.push(line);
				});

				fs.writeFileSync(pathRoot, linesWrite.join("\n"), "utf-8");

				properLockfile.unlockSync(pathRoot);
			}

			await new Promise((resolve) => setTimeout(resolve, 1000 + Math.round(Math.random() * 1000)));
		}
	} catch {
		if (properLockfile.checkSync(pathRoot)) {
			await properLockfile.unlock(pathRoot).catch(() => {});
		}

		setTimeout(observerEvents, 1000 + Math.round(Math.random() * 1000));
	}
};

observerEvents();

export default class IPC extends SimpleEventEmitter {
	private id: number = Math.round(Math.random() * Date.now());

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
	notify(event: string, message: any): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const content: NotificationContent = {
					timestamp: Date.now(),
					event: event,
					message: message,
				};

				pending.push(prepareLine([JSON.stringify(content), ipcId]));
				this.emit(content.event, content.message);

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
