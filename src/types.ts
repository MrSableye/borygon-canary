export interface UnhandledMessage {
  timestamp: number;
  room: string;
  rawMessage: string;
}

export interface UndeserializableMessage extends UnhandledMessage {
  errors: string[];
}

export interface UnserializableMessage extends UndeserializableMessage {
  deserializedMessage: [unknown, Record<string, string>];
}

export interface NotEqualMessage extends Omit<UnserializableMessage, 'errors'> {
  serializedMessage: string;
}

export interface MessageDatabase {
  totalMessages: number;
  unhandledMessages: UnhandledMessage[];
  undeserializableMessages: UndeserializableMessage[];
  unserializableMessages: UnserializableMessage[];
  notEqualMessages: NotEqualMessage[];
}