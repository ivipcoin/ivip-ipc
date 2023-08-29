"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ivipbase_core_1 = require("ivipbase-core");
const IPC_1 = __importDefault(require("./IPC.js"));
const cache = new Map();
const calculateExpiryTime = (expirySeconds) => (expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : Infinity);
const cleanUp = () => {
    const now = Date.now();
    cache.forEach((entry, key) => {
        if (entry.expires <= now) {
            cache.delete(key);
        }
    });
};
setInterval(() => {
    cleanUp();
}, 60 * 1000);
class Cache extends IPC_1.default {
    constructor() {
        super();
        this.defaultExpirySeconds = 60;
        this.on("cache:update", ({ key, value, expirySeconds }) => {
            this.set(key, value, expirySeconds, false);
        });
        this.on("cache:delete", ({ key }) => {
            this.delete(key, false);
        });
    }
    get size() {
        return cache.size;
    }
    set(key, value, expirySeconds, notify = true) {
        expirySeconds = typeof expirySeconds === "number" ? expirySeconds : this.defaultExpirySeconds;
        cache.set(key, { value: ivipbase_core_1.Utils.cloneObject(value), added: Date.now(), accessed: Date.now(), expires: calculateExpiryTime(expirySeconds) });
        if (notify) {
            this.notify("cache:update", { key, value, expirySeconds });
        }
    }
    get(key) {
        const entry = cache.get(key);
        if (!entry) {
            return null;
        }
        entry.expires = calculateExpiryTime(this.defaultExpirySeconds);
        entry.accessed = Date.now();
        return ivipbase_core_1.Utils.cloneObject(entry.value);
    }
    has(key) {
        return cache.has(key);
    }
    delete(key, notify = true) {
        cache.delete(key);
        if (notify) {
            this.notify("cache:delete", { key });
        }
    }
    cleanUp() {
        cleanUp();
    }
    memoize(name, fn, expireInSeconds) {
        const cache = this;
        return async function (...args) {
            const key = `${name}__${JSON.stringify(args)}`;
            const cachedValue = cache.get(key);
            if (cachedValue !== null) {
                return cachedValue;
            }
            const result = await fn.apply(null, args);
            cache.set(key, result, expireInSeconds);
            return result;
        };
    }
}
const internalCache = new Cache();
exports.default = internalCache;
//# sourceMappingURL=Cache.js.map