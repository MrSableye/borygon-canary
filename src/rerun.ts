import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { MessageDatabase, NotEqualMessage, UndeserializableMessage, UnhandledMessage, UnserializableMessage } from './types.js';
import { deserializeRawMessages, serializeMessage } from 'borygon';

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

type DefinedRetryResult = ['unhandled', UnhandledMessage]
| ['undeserializable', UndeserializableMessage]
| ['unserializable', UnserializableMessage]
| ['notequal', NotEqualMessage];

type RetryResult = DefinedRetryResult
  | undefined; // Valid

const retry = (unhandledMessage: UnhandledMessage): RetryResult => {
  const [deserializedMessage] = deserializeRawMessages(unhandledMessage.rawMessage);

  if (deserializedMessage) {
    if ('value' in deserializedMessage) {
      if (deserializedMessage.value.rawMessageName === 'unhandled') {
        return ['unhandled', unhandledMessage];
      } else {
        const serializedMessage = serializeMessage(
          deserializedMessage.value.rawMessageName,
          deserializedMessage.value.value.message,
          deserializedMessage.value.value.keywordArguments,
        );

        if ('value' in serializedMessage) {
          const serializedText = serializedMessage.value.join('|');
          const [rawWithoutKw, rawKw] = extractKeywordArguments(unhandledMessage.rawMessage);
          const [serialWithoutKw, serialKw] = extractKeywordArguments(serializedText);
          const equal = (rawWithoutKw === serialWithoutKw) && (Object.keys(rawKw).length === Object.keys(serialKw).length) && (Object.keys(rawKw).every((rawKey) => rawKw[rawKey] === serialKw[rawKey]));
          if (!equal) {
            return ['notequal', {
              ...unhandledMessage,
              deserializedMessage: [
                deserializedMessage.value.value.message,
                deserializedMessage.value.value.keywordArguments,
              ],
              serializedMessage: serializedText,
            }];
          }
        } else {
          return ['unserializable', {
            ...unhandledMessage,
            deserializedMessage: [
              deserializedMessage.value.value.message,
              deserializedMessage.value.value.keywordArguments,
            ],
            errors: serializedMessage.errors,
          }];
        }
      }
    } else {
      return ['undeserializable', {
        ...unhandledMessage,
        errors: deserializedMessage.error.errors,
      }];
    }
  }

  return undefined;
};


const rerun = async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const file = join(__dirname, 'db.json')
  const adapter = new JSONFile<MessageDatabase>(file);
  const database = new Low(adapter);
  await database.read();

  if (!database.data) return;

  const definedRetryResult: DefinedRetryResult[] = [];

  database.data.unhandledMessages.forEach((m) => {
    const r = retry(m);

    if (r) {
      definedRetryResult.push(r);
    }
  });

  database.data.undeserializableMessages.forEach((m) => {
    const r = retry(m);

    if (r) {
      definedRetryResult.push(r);
    }
  });

  database.data.unserializableMessages.forEach((m) => {
    const r = retry(m);

    if (r) {
      definedRetryResult.push(r);
    }
  });

  database.data.notEqualMessages.forEach((m) => {
    const r = retry(m);

    if (r) {
      definedRetryResult.push(r);
    }
  });

  database.data = {
    notEqualMessages: [],
    totalMessages: database.data.totalMessages || 0,
    undeserializableMessages: [],
    unhandledMessages: [],
    unserializableMessages: [],
  };

  definedRetryResult
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .forEach((r) => {
      if (r[0] === 'notequal') {
        database.data?.notEqualMessages.push(r[1]);
      } else if (r[0] === 'undeserializable') {
        database.data?.undeserializableMessages.push(r[1]);
      } else if (r[0] === 'unserializable') {
        database.data?.unserializableMessages.push(r[1]);
      } else if (r[0] === 'unhandled') {
        database.data?.unhandledMessages.push(r[1]);
      }
    });

  await database.write();
};

rerun();
