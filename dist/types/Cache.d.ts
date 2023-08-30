import { IPC } from "./IPC";
declare class Cache extends IPC {
    defaultExpirySeconds: number;
    constructor();
    get size(): number;
    set(key: string | number, value: any, expirySeconds?: number, notify?: boolean): void;
    get(key: string | number): any;
    has(key: string | number): boolean;
    delete(key: string | number, notify?: boolean): void;
    cleanUp(): void;
    memoize(name: string, fn: (...arg: any[]) => any, expireInSeconds?: number): (...args: any[]) => Promise<any>;
}
declare const internalCache: Cache;
export default internalCache;
//# sourceMappingURL=Cache.d.ts.map