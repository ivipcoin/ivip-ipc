"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
const ivip_utils_1 = require("ivip-utils");
const cluster_1 = __importDefault(require("cluster"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chokidar_1 = __importDefault(require("chokidar"));
const proper_lockfile_1 = __importDefault(require("proper-lockfile"));
/** Verificam se o processo é um worker, primary ou master do cluster. */
const isCluster = cluster_1.default.isWorker || cluster_1.default.isPrimary || cluster_1.default.isMaster;
/** Verificam se o processo é um primary ou master do cluster. */
const isMaster = !isCluster || cluster_1.default.isPrimary || cluster_1.default.isMaster;
/** Caminho para o arquivo de comunicação compartilhado. */
const pathRoot = path_1.default.resolve(`${process.platform === 'win32' ? '' : '/'}${/file:\/{2,3}(.+)\/[^/]/.exec(import.meta.url)[1]}`, "notification.ipc");
/** Array que armazena linhas pendentes a serem escritas no arquivo. */
const pending = [];
/** Identificador único para o processo, incluindo o pid do processo. */
let ipcId = !isMaster ? `[${process.pid}]` : "[MASTER]";
let ipcList = [ipcId];
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
        .sort((a, b) => {
        return parseInt(a[0]) > parseInt(b[0]) ? 1 : parseInt(a[0]) < parseInt(b[0]) ? -1 : 0;
    })
        .map(([time, content, ...ipcIds]) => {
        if (!inProcess && ipcIds.includes(ipcId) !== true) {
            try {
                const result = JSON.parse(content);
                notifyCallbackMap.forEach((callback) => {
                    callback(result);
                });
            }
            catch { }
            ipcIds.push(ipcId);
        }
        return [time, content, ...ipcIds];
    })
        .filter(([time, content, ...ipcIds]) => {
        return inProcess || !header.slice(1).every((id) => ipcIds.filter((id) => header.slice(1).includes(id)).includes(id));
    });
};
function differenceInSeconds(date1, date2) {
    const diffInMilliseconds = Math.abs(date2.getTime() - date1.getTime());
    const diffInSeconds = diffInMilliseconds / 1000;
    return diffInSeconds;
}
let timestamp = Date.now();
let timeDelay = undefined;
let running = false;
const breakLimitString = (input, maxLineLength = 120) => {
    input = Buffer.from(input.replaceAll("\n", "<<break-limit-string>>")).toString("base64");
    const lines = [];
    for (let i = 0; i < input.length; i += maxLineLength) {
        lines.push(input.slice(i, i + maxLineLength));
    }
    return lines.join("\n");
};
const inverseBreakLimitString = (input) => {
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
            if (!fs_1.default.existsSync(pathRoot)) {
                fs_1.default.writeFileSync(pathRoot, "", "utf-8");
            }
            const lockfile = proper_lockfile_1.default.checkSync(pathRoot);
            if (lockfile === false) {
                proper_lockfile_1.default.lockSync(pathRoot);
                const fileContent = inverseBreakLimitString(fs_1.default.readFileSync(pathRoot, "utf-8"));
                let [header = [], ...lines] = fileContent
                    .split(/\n/)
                    .filter((line) => line.trim() !== "")
                    .map(readLine);
                let inProcess = differenceInSeconds(new Date(timestamp), new Date()) < 5;
                if (header.length && timestamp !== parseInt(header[0])) {
                    if (!header.includes(ipcId) && differenceInSeconds(new Date(parseInt(header[0])), new Date(timestamp)) > 5) {
                        header = [];
                        lines = [];
                        inProcess = true;
                    }
                    else {
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
                const linesWrite = [];
                ipcList = header.slice(1).filter((id, i, l) => l.indexOf(id) === i);
                //linesWrite.push(prepareLine(header));
                const stability = (lines ?? []).filter(([v]) => v === "stability_ipc_ids").slice(-5);
                if (stability.length > 0 && differenceInSeconds(new Date(parseInt(stability.slice(-1)[0][1])), new Date()) < 25) {
                    stability[stability.length - 1].push(ipcId);
                }
                else {
                    stability.push(["stability_ipc_ids", Date.now().toString(), ipcId]);
                }
                stability[stability.length - 1] = stability[stability.length - 1].filter((v, i, l) => l.indexOf(v) === i);
                ipcList = Array.prototype.concat
                    .apply([], stability.map(([k, t, ...ids]) => ids))
                    .filter((v, i, l) => l.indexOf(v) === i);
                lines = (lines ?? []).filter(([v]) => v !== "stability_ipc_ids");
                filterLines([header[0], ...ipcList], lines ?? [], inProcess).forEach((line) => {
                    linesWrite.push(prepareLine(line));
                });
                if (!inProcess) {
                    pending.splice(0).forEach((line) => {
                        linesWrite.push(line);
                    });
                }
                const newData = [prepareLine(header), ...stability.map(prepareLine), ...linesWrite.filter((line, i, l) => l.indexOf(line) === i)].join("\n");
                if (newData !== fileContent) {
                    fs_1.default.writeFileSync(pathRoot, breakLimitString(newData), "utf-8");
                }
                proper_lockfile_1.default.unlockSync(pathRoot);
            }
        }
        catch {
            if (proper_lockfile_1.default.checkSync(pathRoot)) {
                await proper_lockfile_1.default.unlock(pathRoot).catch(() => { });
            }
            setTimeout(observerEvents, 200 + Math.round(Math.random() * 500));
        }
        running = false;
    }, 100);
};
chokidar_1.default
    .watch(pathRoot)
    .on("add", (file) => {
    observerEvents();
})
    .on("change", (file) => {
    observerEvents();
});
class IPC extends ivip_utils_1.SimpleEventEmitter {
    /**
     * A classe `IPC` é definida como uma subclasse de `SimpleEventEmitter` e exportada como padrão. Ela implementa a comunicação entre os processos.
     */
    constructor() {
        super();
        this.id = Math.round(Math.random() * Date.now()).toString();
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
    notify(event, message, justOut = false) {
        return new Promise((resolve, reject) => {
            try {
                if (notifyCallbackMap.has(this.id)) {
                    const content = {
                        timestamp: Date.now(),
                        event: event,
                        message: message,
                    };
                    pending.push(prepareLine([content.timestamp.toString(), (0, ivip_utils_1.JSONStringify)(content), ipcId]));
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
exports.IPC = IPC;
const internalIPC = new IPC();
exports.default = internalIPC;
//# sourceMappingURL=IPC.js.map