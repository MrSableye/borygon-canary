import { ManagedShowdownClient, serializeMessage } from 'borygon';
import { Low } from 'lowdb';
import {
  MessageDatabase,
  NotEqualMessage,
  UndeserializableMessage,
  UnhandledMessage,
  UnserializableMessage,
} from './types.js';

const keywordArgumentPattern = /^\[(?<key>.+)\](?<value>.*)$/;
const extractKeywordArguments = (input: string): [string, Record<string, string>] => {
  const inputs = input.split('|');
  const inputsCopy = input.split('|');
  const keywordArguments: Record<string, string> = {};

  for (let i = 0; i < inputs.length; i += 1) {
    const matches = keywordArgumentPattern.exec(inputs[inputs.length - i - 1]);

    if (matches && matches.groups?.key && matches.groups?.value !== undefined) {
      keywordArguments[matches.groups.key] = matches.groups.value.trim();
      inputsCopy.pop();
    } else {
      break;
    }
  }

  return [inputsCopy.join('|'), keywordArguments];
};

export const initialize = (database: Low<MessageDatabase>, username: string, password: string) => {
  const showdownClient = new ManagedShowdownClient({});

  let rooms = new Set<string>();
  let seenChat = false;
  let interval: NodeJS.Timer | undefined = undefined;

  const unsubscribeFunctions = [
    showdownClient.messages.onAny((messageName, message) => {
      if (!message) return;
      if (!database.data) return;
      database.data.totalMessages++;
      const now = Date.now();
      if (messageName === 'unhandled') {
        const now = Date.now();
        const unhandledMessage: UnhandledMessage = {
          timestamp: now,
          room: message.room,
          rawMessage: message.rawMessage,
        };
        database.data.unhandledMessages.push(unhandledMessage);
      } else {
        const serializedMessage = serializeMessage(message.rawMessageName, message.value.message, message.value.keywordArguments);
        if ('value' in serializedMessage) {
          const serialized = serializedMessage.value.join('|');
          const [rawWithoutKw, rawKw] = extractKeywordArguments(message.rawMessage);
          const [serialWithoutKw, serialKw] = extractKeywordArguments(serialized);
          const equal = (rawWithoutKw === serialWithoutKw) && (Object.keys(rawKw).length === Object.keys(serialKw).length) && (Object.keys(rawKw).every((rawKey) => rawKw[rawKey] === serialKw[rawKey]));
          if (!equal) {
            const notEqualMessage: NotEqualMessage = {
              timestamp: now,
              room: message.room,
              rawMessage: message.rawMessage,
              deserializedMessage: [message.value.message, message.value.keywordArguments],
              serializedMessage: serialized,
            };
            database.data.notEqualMessages.push(notEqualMessage);
          }
        } else {
          const unserializableMessage: UnserializableMessage = {
            timestamp: now,
            room: message.room,
            rawMessage: message.rawMessage,
            deserializedMessage: [message.value.message, message.value.keywordArguments],
            errors: serializedMessage.errors,
          };
          database.data.unserializableMessages.push(unserializableMessage);
        }
      }
    }),
    showdownClient.messageErrors.onAny((_, messageError) => {
      if (!database.data) return;
      if (!messageError) return;
      database.data.totalMessages++;
      const now = Date.now();
      const undeserializableMessage: UndeserializableMessage = {
        timestamp: now,
        room: messageError.room,
        rawMessage: messageError.rawMessage,
        errors: messageError.errors,
      };
      database.data.undeserializableMessages.push(undeserializableMessage);
    }),
    showdownClient.messages.on('queryResponse', async (queryResponseMessage) => {
      const { response } = queryResponseMessage.value.message;

      if (!seenChat && ('chat' in (response as any))) {
        seenChat = true;
        if (Array.isArray((response as any).chat)) {
          const chatRooms = (response as any).chat.slice(0, 15);
          for (let i = 0; i < chatRooms.length; i++) {
            const chatRoom = chatRooms[i];
            await showdownClient.send(`|/join ${chatRoom.title}`);
          }
        }
      } else if ('rooms' in (response as any)) {
        const battles = Object.keys((response as any).rooms);
        for (let i = 0; i < battles.length; i++) {
          const battle = battles[i];
          await showdownClient.send(`|/join ${battle}`);
        }
      }
    }),
    showdownClient.messages.on('win', async (winMessage) => {
      await showdownClient.send(`${winMessage.room}|/savereplay`);
      await showdownClient.send(`|/leave ${winMessage.room}`);
    }),
    showdownClient.messages.on('tie', async (winMessage) => {
      await showdownClient.send(`${winMessage.room}|/savereplay`);
      await showdownClient.send(`|/leave ${winMessage.room}`);
    }),
    showdownClient.messages.on('initializeRoom', (initializeRoomEvent) => {
      rooms.add(initializeRoomEvent.room);
    }),
    showdownClient.messages.on('deinitializeRoom', (deinitializeRoomEvent) => {
      rooms.delete(deinitializeRoomEvent.room);
    }),
  ];

  return {
    start: async () => {
      await showdownClient.connect();
      await showdownClient.login(username, password);
      await showdownClient.send('|/cmd rooms');
      await showdownClient.send('|/cmd roomlist');
      interval = setInterval(() => showdownClient.send('|/cmd roomlist'), 60 * 1000);
    },
    stop: () => {
      clearInterval(interval);
      unsubscribeFunctions.forEach((fn) => fn());
    },
    getRooms: () => Array.from(rooms),
  };
};
