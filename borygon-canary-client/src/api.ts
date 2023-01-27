import Axios from 'axios';

export interface Metadata {
  startTime: number;
  showdownUsername: string;
}

export interface Metrics {
  seen: number;
  unhandled: number;
  undeserializable: number;
  unserializable: number;
  inequal: number;
}

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

export interface Paginated<T> {
  last: number;
  data: T[];
}

export const getMetadata = async (): Promise<Metadata | undefined> => {
  try {
    const { data } = await Axios.get('/api/metadata', { responseType: 'json' });
    return data;
  } catch (error) {
    return undefined;
  }
};

export const getMetrics = async (): Promise<Metrics | undefined> => {
  try {
    const { data } = await Axios.get('/api/metrics', { responseType: 'json' });
    return data;
  } catch (error) {
    return undefined;
  }
};

export const getRooms = async (): Promise<string[]> => {
  try {
    const { data } = await Axios.get('/api/rooms', { responseType: 'json' });
    return data;
  } catch (error) {
    return [];
  }
};

export const getUnhandledLogs = async (from?: number): Promise<Paginated<UnhandledMessage>> => {
  try {
    const { data } = await Axios.get<Paginated<UnhandledMessage>>('/api/logs', {
      responseType: 'json',
      params: { type: 'unhandled', from },
    });
    data.data.sort((a, b) => b.timestamp - a.timestamp);
    return data;
  } catch (error) {
    return {
      last: 0,
      data: [],
    };
  }
};

export const getUndeserializableLogs = async (from?: number): Promise<Paginated<UndeserializableMessage>> => {
  try {
    const { data } = await Axios.get<Paginated<UndeserializableMessage>>('/api/logs', {
      responseType: 'json',
      params: { type: 'undeserializable', from },
    });
    data.data.sort((a, b) => b.timestamp - a.timestamp);
    return data;
  } catch (error) {
    return {
      last: 0,
      data: [],
    };
  }
};

export const getUnserializableLogs = async (from?: number): Promise<Paginated<UnserializableMessage>> => {
  try {
    const { data } = await Axios.get<Paginated<UnserializableMessage>>('/api/logs', {
      responseType: 'json',
      params: { type: 'unserializable', from },
    });
    data.data.sort((a, b) => b.timestamp - a.timestamp);
    return data;
  } catch (error) {
    return {
      last: 0,
      data: [],
    };
  }
};

export const getInequalLogs = async (from?: number): Promise<Paginated<NotEqualMessage>> => {
  try {
    const { data } = await Axios.get<Paginated<NotEqualMessage>>('/api/logs', {
      responseType: 'json',
      params: { type: 'inequal', from },
    });
    data.data.sort((a, b) => b.timestamp - a.timestamp);
    return data;
  } catch (error) {
    return {
      last: 0,
      data: [],
    };
  }
};
