"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = exports.IPC = void 0;
const IPC_1 = __importDefault(require("./IPC"));
exports.IPC = IPC_1.default;
const Cache_1 = __importDefault(require("./Cache"));
exports.Cache = Cache_1.default;
const internalIPC = new IPC_1.default();
exports.default = internalIPC;
//# sourceMappingURL=index.js.map