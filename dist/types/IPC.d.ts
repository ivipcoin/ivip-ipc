import { SimpleEventEmitter } from "ivipbase-core";
export default class IPC extends SimpleEventEmitter {
    private id;
    /**
     * A classe `IPC` é definida como uma subclasse de `SimpleEventEmitter` e exportada como padrão. Ela implementa a comunicação entre os processos.
     */
    constructor();
    /**
     * Este método é usado para enviar notificações entre processos.
     * @param {string} event Tipo evento que os processos devem receber a mensagem.
     * @param {any} message Mensagem para enviar aos processos.
     * @returns {Promise<void>}
     */
    notify(event: string, message: any, justOut?: boolean): Promise<void>;
    /** Encerra a comunicação IPC. */
    destroy(): void;
}
//# sourceMappingURL=IPC.d.ts.map