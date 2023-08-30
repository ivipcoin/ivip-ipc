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
const IPC = require('ivip-ipc').default;
//import IPC from "ivip-ipc";

// Ouvir eventos
IPC.on('evento-personalizado', (mensagem) => {
  console.log('Evento personalizado recebido:', mensagem);
});

// Enviar uma notificação para outros processos
IPC.notify('evento-personalizado', 'Mensagem da notificação');

// Encerra a comunicação IPC
// IPC.destroy();
```

## Documentação da Classe IPC

### `constructor()`

Cria uma nova instância da classe IPC. A instância é capaz de enviar notificações para outros processos e ouvir eventos.

### `notify(event: string, message: any): Promise<void>`

Envia uma notificação para outros processos. O `event` é o tipo de evento que os processos devem receber e o `message` é a mensagem para enviar.

### `destroy()`

Encerra a comunicação IPC. Isso limpará todos os ouvintes de eventos e liberará recursos associados à instância.


### Eventos

A classe IPC estende `SimpleEventEmitter`, permitindo que você ouça eventos usando o método `on` e/ou `once`, e interrompimento de eventos usando o método `off`:

```javascript
const evento = (mensagem) => {
  console.log('Evento recebido:', mensagem);
};

IPC.on('evento', evento);

IPC.off('evento', evento);
```

```javascript
const evento = (mensagem) => {
  console.log('Evento recebido:', mensagem);
};

IPC.once('evento', evento);

IPC.off('evento', evento);
```

```javascript
const evento = IPC.on('evento', (mensagem) => {
  console.log('Evento recebido:', mensagem);
});

evento.stop(); // Substituindo o uso do método `off`
```

## Cache

Além de uma comunicação entre processos simultâneas, o `ivip-ipc` também fornece uma funcionalidade de cache compartilhado entre processos no Node.js. Ele permite que você mantenha os dados em cache sincronizados entre várias instâncias do aplicativo, mesmo em um ambiente de cluster.

## Uso

Aqui está um exemplo de como você pode usar o `Cache` para gerenciar um cache compartilhado entre processos:

```javascript
const { IPC, Cache } = require('ivip-ipc');
//import { IPC, Cache } from "ivip-ipc";

// Ouvir eventos
IPC.on("evento-personalizado", (mensagem) => {
  console.log(`[${process.pid}] Evento personalizado recebido:`, mensagem);
});

// Enviar uma notificação para outros processos
IPC.notify("evento-personalizado", `Mensagem da notificação de [${process.pid}]`);

// Definir um valor no cache
Cache.set("chave", "valor", 60); // Valor expirará após 60 segundos

// Obter um valor do cache
const valor = Cache.get("chave");

console.log(`[${process.pid}]::`, valor); // Valor do cache ou null se expirado

// Encerra a comunicação IPC e limpa o cache
//IPC.destroy();
```

## Documentação das propriedades Cache

### `set(key: string | number, value: any, expirySeconds?: number)`
Define um valor no cache compartilhado. O key é a chave para identificar o valor, o value é o valor a ser armazenado e o expirySeconds é o tempo de expiração em segundos.

### `get(key: string | number)`
Obtém um valor do cache compartilhado. Retorna o valor armazenado ou null se expirado.

### `has(key: string | number)`
Verifica se uma chave existe no cache.

### `delete(key: string | number)`
Remove um valor do cache compartilhado.

### `cleanUp()`
Remove valores expirados do cache compartilhado.

### `memoize(name: string, fn: (...args: any[]) => any, expireInSeconds?: number)`
Cria uma função memoizada que armazena o resultado em cache. Útil para funções que você deseja cache durante um determinado período.

## Contribuindo

Contribuições são bem-vindas! Se você encontrar problemas ou tiver melhorias para sugerir, por favor, abra uma issue neste repositório.

## Licença

Este projeto é licenciado sob a licença [MIT](LICENSE).