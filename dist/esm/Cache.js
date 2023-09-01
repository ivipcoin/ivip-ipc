"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const IPC_1 = __importStar(require("./IPC.js"));
const ivip_utils_1 = require("ivip-utils");
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
const joinCache = (...dataList) => {
    dataList.forEach((data) => {
        for (let key in data) {
            const { added } = cache.get(key) ?? data[key];
            if (added <= data[key].added) {
                cache.set(key, data[key]);
            }
        }
    });
    return Object.fromEntries([...cache]);
};
IPC_1.default.on("cache:sync-response", (data) => {
    joinCache(data);
});
IPC_1.default.on("cache:sync-request", (data) => {
    IPC_1.default.notify("cache:sync-response", joinCache(data), true);
});
class Cache extends IPC_1.IPC {
    constructor() {
        super();
        this.defaultExpirySeconds = 60;
        this.maxEntries = 5000;
        this.on("cache:update", ({ key, value, expirySeconds }) => {
            this.set(key, value, expirySeconds, false);
        });
        this.on("cache:delete", ({ key }) => {
            this.delete(key, false);
        });
        setTimeout(() => {
            IPC_1.default.notify("cache:sync-request", Object.fromEntries([...cache]), true);
        }, 2000 + Math.round(Math.random() * 2000));
    }
    get size() {
        return cache.size;
    }
    set(key, value, expirySeconds, notify = true) {
        if (this.maxEntries > 0 && cache.size >= this.maxEntries && !cache.has(key)) {
            let oldest = null;
            const now = Date.now();
            for (const [key, entry] of cache.entries()) {
                if (entry.expires <= now) {
                    cache.delete(key);
                    oldest = null;
                    break;
                }
                if (!oldest || entry.accessed < oldest.accessed) {
                    oldest = { key, accessed: entry.accessed };
                }
            }
            if (oldest !== null) {
                cache.delete(oldest.key);
            }
        }
        expirySeconds = typeof expirySeconds === "number" ? expirySeconds : this.defaultExpirySeconds;
        value = (0, ivip_utils_1.JSONStringify)(value);
        cache.set(key, { value: value, added: Date.now(), accessed: Date.now(), expires: calculateExpiryTime(expirySeconds) });
        if (notify) {
            this.notify("cache:update", { key, value, expirySeconds }, true);
        }
    }
    get(key) {
        const entry = cache.get(key);
        if (!entry) {
            return null;
        }
        entry.expires = calculateExpiryTime(this.defaultExpirySeconds);
        entry.accessed = Date.now();
        return JSON.parse(entry.value);
    }
    has(key) {
        return cache.has(key);
    }
    delete(key, notify = true) {
        cache.delete(key);
        if (notify) {
            this.notify("cache:delete", { key }, true);
        }
    }
    cleanUp() {
        cleanUp();
    }
    memoize(name, fn, expireInSeconds) {
        const cache = this;
        return async function (...args) {
            const key = `${name}__${(0, ivip_utils_1.JSONStringify)(args)}`;
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