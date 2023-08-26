# ivip-ipc

O módulo `ivip-ipc` é uma biblioteca que fornece uma classe para facilitar a comunicação assíncrona entre processos no Node.js, usando um arquivo compartilhado como meio de troca de mensagens. Isso é especialmente útil em cenários de cluster ou em ambientes em que várias instâncias do aplicativo precisam se comunicar sem se depender de um gerenciamento master (processo principal).

## Instalação

Para instalar o `ivip-ipc`, você pode usar o npm:

```bash
npm install ivip-ipc
```

## Uso

Aqui está um exemplo básico de como você pode usar o `ivip-ipc` para comunicação entre processos:

```javascript
const IPC = require('ivip-ipc');

// Crie uma instância da classe IPC
const ipc = new IPC();

// Ouvir eventos
ipc.on('evento-personalizado', (mensagem) => {
  console.log('Evento personalizado recebido:', mensagem);
});

// Enviar uma notificação para outros processos
ipc.notify('evento-personalizado', 'Mensagem da notificação');

// Encerra a comunicação IPC
// ipc.destroy();
```

## Documentação da Classe IPC

### `constructor()`

Cria uma nova instância da classe IPC. A instância é capaz de enviar notificações para outros processos e ouvir eventos.

### `notify(event: string, message: any): Promise<void>`

Envia uma notificação para outros processos. O `event` é o tipo de evento que os processos devem receber e o `message` é a mensagem para enviar.

### `destroy()`

Encerra a comunicação IPC. Isso limpará todos os ouvintes de eventos e liberará recursos associados à instância.


### Eventos

A classe IPC estende `SimpleEventEmitter`, permitindo que você ouça eventos usando o método `on`:

```javascript
ipc.on('evento', (mensagem) => {
  console.log('Evento recebido:', mensagem);
});
```

## Contribuindo

Contribuições são bem-vindas! Se você encontrar problemas ou tiver melhorias para sugerir, por favor, abra uma issue neste repositório.

## Licença

Este projeto é licenciado sob a licença [MIT](LICENSE).