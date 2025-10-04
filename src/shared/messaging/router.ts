import type {
  MessageEnvelope,
  MessageMapDefinition,
  MessageRequest,
  MessageResponse,
  RuntimeMessageEnvelope,
  RuntimeMessageMap,
  RuntimeMessageType
} from './contracts';

interface ErrorEnvelope {
  __error: string;
}

function resolveChrome() {
  return (globalThis as unknown as { chrome?: typeof chrome }).chrome;
}

type Handler<M extends MessageMapDefinition, T extends keyof M> = (
  payload: MessageRequest<M, T>,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<M, T>> | MessageResponse<M, T>;

function isEnvelope<M extends MessageMapDefinition>(value: unknown): value is MessageEnvelope<M, keyof M> {
  return Boolean(value && typeof value === 'object' && 'type' in value);
}

export interface RuntimeMessageRouter<M extends MessageMapDefinition> {
  register<T extends keyof M>(type: T, handler: Handler<M, T>): void;
  attach(): void;
  detach(): void;
  handle<T extends keyof M>(message: MessageEnvelope<M, T>, sender?: chrome.runtime.MessageSender): Promise<MessageResponse<M, T>>;
}

function createErrorEnvelope(message: string): ErrorEnvelope {
  return { __error: message };
}

function handleResponse<T>(resolve: (value: T) => void, reject: (reason?: unknown) => void) {
  return (response: T | ErrorEnvelope) => {
    if (response && typeof response === 'object' && '__error' in response) {
      reject(new Error(response.__error));
      return;
    }
    resolve(response as T);
  };
}

export function createRuntimeMessageRouter<M extends MessageMapDefinition>(): RuntimeMessageRouter<M> {
  const handlers = new Map<string, Handler<M, keyof M>>();
  let listenerAttached = false;

  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (rawMessage, sender, sendResponse) => {
    if (!isEnvelope<M>(rawMessage)) {
      return undefined;
    }

    const handler = handlers.get(String(rawMessage.type));
    if (!handler) {
      return undefined;
    }

    Promise.resolve(handler(rawMessage.payload as MessageRequest<M, keyof M>, sender))
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error('[ai-companion] runtime message failed', error);
        sendResponse(createErrorEnvelope(error instanceof Error ? error.message : String(error)));
      });

    return true;
  };

  async function handle(message: MessageEnvelope<M, keyof M>, sender?: chrome.runtime.MessageSender) {
    const handler = handlers.get(String(message.type)) as Handler<M, typeof message.type> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for ${String(message.type)}`);
    }
    const resolvedSender = sender ?? ({} as chrome.runtime.MessageSender);
    return handler(message.payload, resolvedSender);
  }

  function register<T extends keyof M>(type: T, handler: Handler<M, T>) {
    handlers.set(String(type), handler as unknown as Handler<M, keyof M>);
  }

  function attach() {
    if (listenerAttached) {
      return;
    }
    const chromeApi = resolveChrome();
    if (!chromeApi?.runtime?.onMessage?.addListener) {
      console.warn('[ai-companion] runtime messaging unavailable; skipping listener attach');
      return;
    }
    chromeApi.runtime.onMessage.addListener(listener);
    listenerAttached = true;
  }

  function detach() {
    if (!listenerAttached) {
      return;
    }
    const chromeApi = resolveChrome();
    if (!chromeApi?.runtime?.onMessage?.removeListener) {
      listenerAttached = false;
      return;
    }
    chromeApi.runtime.onMessage.removeListener(listener);
    listenerAttached = false;
  }

  return {
    register,
    attach,
    detach,
    handle: handle as RuntimeMessageRouter<M>['handle']
  };
}

export function sendRuntimeMessage<T extends RuntimeMessageType>(
  type: T,
  payload: MessageRequest<RuntimeMessageMap, T>
): Promise<MessageResponse<RuntimeMessageMap, T>> {
  return new Promise((resolve, reject) => {
    const chromeApi = resolveChrome();
    if (!chromeApi?.runtime?.sendMessage) {
      resolve({} as MessageResponse<RuntimeMessageMap, T>);
      return;
    }
    chromeApi.runtime.sendMessage({ type, payload }, (response) => {
      const error = chromeApi.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      handleResponse(resolve, reject)(response as MessageResponse<RuntimeMessageMap, T> | ErrorEnvelope);
    });
  });
}

export function sendTabMessage<T extends RuntimeMessageType>(
  tabId: number,
  type: T,
  payload: MessageRequest<RuntimeMessageMap, T>
): Promise<MessageResponse<RuntimeMessageMap, T>> {
  return new Promise((resolve, reject) => {
    const chromeApi = resolveChrome();
    if (!chromeApi?.tabs?.sendMessage) {
      reject(new Error('chrome.tabs API is unavailable'));
      return;
    }
    chromeApi.tabs.sendMessage(tabId, { type, payload }, (response) => {
      const error = chromeApi.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      handleResponse(resolve, reject)(response as MessageResponse<RuntimeMessageMap, T> | ErrorEnvelope);
    });
  });
}
