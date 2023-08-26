"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ivipbase_core_1 = require("ivipbase-core");
const cluster_1 = __importDefault(require("cluster"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const proper_lockfile_1 = __importDefault(require("proper-lockfile"));
/** Verificam se o processo é um worker, primary ou master do cluster. */
const isCluster = cluster_1.default.isWorker || cluster_1.default.isPrimary || cluster_1.default.isMaster;
/** Verificam se o processo é um primary ou master do cluster. */
const isMaster = !isCluster || cluster_1.default.isPrimary || cluster_1.default.isMaster;
/** Caminho para o arquivo de comunicação compartilhado. */
const pathRoot = path_1.default.resolve(__dirname, "notification.ipc");
/** Array que armazena linhas pendentes a serem escritas no arquivo. */
const pending = [];
/** Identificador único para o processo, incluindo o pid do processo. */
let ipcId = !isMaster ? `[${process.pid}]` : "[MASTER]";
/** Separador usado para codificar e decodificar linhas no arquivo. */
const separator = "_n_::_n_";
/** Mapa que armazena números como chaves e funções como valores. Essas funções serão chamadas quando uma notificação for recebida. */
const notifyCallbackMap = new Map();
/**
 * Prepara o arquivo de comunicação, criando-o se não existir.
 * @returns {Promise<void>}
 */
const prepareFile = () => {
    return new Promise((resolve, reject) => {
        try {
            fs_1.default.access(pathRoot, fs_1.default.constants.F_OK, (accessErr) => {
                if (accessErr) {
                    fs_1.default.writeFile(pathRoot, "", (e) => {
                        if (e) {
                            reject(e);
                        }
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
};
/** Codifica um array de strings usando base64. */
const prepareLine = (colls) => {
    return colls.map((v) => Buffer.from(v).toString("base64")).join(separator);
};
/** Decodifica a linha codificada. */
const readLine = (line) => {
    return line.split(separator).map((v) => Buffer.from(v, "base64").toString("utf-8"));
};
/** Filtra e processa as linhas do arquivo. */
const filterLines = (header, lines, inProcess = false) => {
    return lines
        .map((line) => {
        if (!inProcess && line.includes(ipcId) !== true) {
            const content = JSON.parse(line[0]);
            notifyCallbackMap.forEach((callback) => {
                callback(content);
            });
            line.push(ipcId);
        }
        return line;
    })
        .filter((line) => {
        return inProcess || !header.slice(1).every((id) => line.includes(id));
    });
};
function differenceInSeconds(date1, date2) {
    const diffInMilliseconds = Math.abs(date2.getTime() - date1.getTime());
    const diffInSeconds = diffInMilliseconds / 1000;
    return diffInSeconds;
}
let timestamp = Date.now();
const observerEvents = async () => {
    try {
        await prepareFile().catch(() => Promise.resolve());
        while (true) {
            const lockfile = proper_lockfile_1.default.checkSync(pathRoot);
            if (lockfile === false) {
                proper_lockfile_1.default.lockSync(pathRoot);
                const fileContent = fs_1.default.readFileSync(pathRoot, "utf-8");
                let [header = [], ...lines] = fileContent
                    .split(/\n/)
                    .filter((line) => line.trim() !== "")
                    .map(readLine);
                let inProcess = false;
                if (header.length && timestamp !== parseInt(header[0])) {
                    if (differenceInSeconds(new Date(parseInt(header[0])), new Date(timestamp)) > 10) {
                        header = [];
                        lines = [];
                        inProcess = true;
                    }
                    else {
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
                const linesWrite = [];
                linesWrite.push(prepareLine(header));
                filterLines(header, lines !== null && lines !== void 0 ? lines : [], inProcess).forEach((line) => {
                    linesWrite.push(prepareLine(line));
                });
                pending.splice(0).forEach((line) => {
                    linesWrite.push(line);
                });
                fs_1.default.writeFileSync(pathRoot, linesWrite.join("\n"), "utf-8");
                proper_lockfile_1.default.unlockSync(pathRoot);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.round(Math.random() * 1000)));
        }
    }
    catch (_a) {
        if (proper_lockfile_1.default.checkSync(pathRoot)) {
            await proper_lockfile_1.default.unlock(pathRoot).catch(() => { });
        }
        setTimeout(observerEvents, 1000 + Math.round(Math.random() * 1000));
    }
};
observerEvents();
class IPC extends ivipbase_core_1.SimpleEventEmitter {
    /**
     * A classe `IPC` é definida como uma subclasse de `SimpleEventEmitter` e exportada como padrão. Ela implementa a comunicação entre os processos.
     */
    constructor() {
        super();
        this.id = Math.round(Math.random() * Date.now());
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
    notify(event, message) {
        return new Promise((resolve, reject) => {
            try {
                const content = {
                    timestamp: Date.now(),
                    event: event,
                    message: message,
                };
                pending.push(prepareLine([JSON.stringify(content), ipcId]));
                this.emit(content.event, content.message);
                resolve();
            }
            catch (e) {
                reject(e);
            }
        });
    }
    /** Encerra a comunicação IPC. */
    destroy() {
        notifyCallbackMap.delete(this.id);
    }
}
exports.default = IPC;
//# sourceMappingURL=index.js.map