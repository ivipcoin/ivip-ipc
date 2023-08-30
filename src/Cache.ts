import { Utils } from "ivipbase-core";
import IPC from "./IPC";

const cache: Map<string | number, { value: any; added: number; expires: number; accessed: number }> = new Map();

const calculateExpiryTime = (expirySeconds: number) => (expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : Infinity);

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

class Cache extends IPC {
	public defaultExpirySeconds: number = 60;

	constructor() {
		super();

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

	set(key: string | number, value: any, expirySeconds?: number, notify: boolean = true) {
		expirySeconds = typeof expirySeconds === "number" ? expirySeconds : this.defaultExpirySeconds;
		cache.set(key, { value: Utils.cloneObject(value), added: Date.now(), accessed: Date.now(), expires: calculateExpiryTime(expirySeconds) });
		if (notify) {
			this.notify("cache:update", { key, value, expirySeconds }, true);
		}
	}

	get(key: string | number) {
		const entry = cache.get(key);
		if (!entry) {
			return null;
		}
		entry.expires = calculateExpiryTime(this.defaultExpirySeconds);
		entry.accessed = Date.now();
		return Utils.cloneObject(entry.value);
	}

	has(key: string | number) {
		return cache.has(key);
	}

	delete(key: string | number, notify: boolean = true) {
		cache.delete(key);
		if (notify) {
			this.notify("cache:delete", { key }, true);
		}
	}

	cleanUp() {
		cleanUp();
	}

	memoize(name: string, fn: (...arg: any[]) => any, expireInSeconds?: number) {
		const cache = this;
		return async function (...args: any[]) {
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

export default internalCache;
