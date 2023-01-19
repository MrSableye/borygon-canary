import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv';
import Koa from 'koa';
import Router from '@koa/router';
import serve from 'koa-static';
import logger from 'koa-logger';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { initialize as initializeShowdown } from './showdown.js';
import { MessageDatabase } from './types.js';

config();

const defaultStaticAssetsDirectory = './borygon-canary-client/build';
const defaultPort = 8080;
const defaultPageSize = 50;

const paginate = <T>(array: T[], from: number, pageSize = defaultPageSize) => {
  const end = Math.min(from, array.length)
  const start = Math.max(0, end - pageSize);
  return {
    last: start,
    data: array.slice(start, end),
  };
};

const initialize = async () => {
  const startTime = Date.now();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const file = join(__dirname, 'db.json')
  const adapter = new JSONFile<MessageDatabase>(file);
  const database = new Low(adapter);
  await database.read();

  database.data ||= {
    totalMessages: 0,
    notEqualMessages: [],
    undeserializableMessages: [],
    unhandledMessages: [],
    unserializableMessages: [],
  };

  const showdownUsername = process.env.SHOWDOWN_USERNAME || '';
  const { start, getRooms } = initializeShowdown(database, showdownUsername, process.env.SHOWDOWN_PASSWORD || '');

  console.time('Connected to Showdown');
  await start();
  console.timeEnd('Connected to Showdown');

  const koaApp = new Koa();
  const apiRoute = new Router({ prefix: '/api' });

  apiRoute.get('/metadata', (ctx) => {
    ctx.body = {
      startTime,
      showdownUsername,
    };
  });

  apiRoute.get('/metrics', (ctx) => {
    ctx.body = {
      seen: database.data?.totalMessages || 0,
      unhandled: database.data?.unhandledMessages.length || 0,
      undeserializable: database.data?.undeserializableMessages.length || 0,
      unserializable: database.data?.unserializableMessages.length || 0,
      inequal: database.data?.notEqualMessages.length || 0,
    };
  });

  apiRoute.get('/rooms', (ctx) => {
    ctx.body = getRooms();
  });

  apiRoute.get('/logs', (ctx) => {
    const type = ctx.query['type'];

    if (!type || !database.data) {
      ctx.body = {
        last: 0,
        data: [],
      };
      return;
    }

    let validType = false;
    let data: any[] = [];
    switch (type) {
      case 'unhandled':
        validType = true;
        data = database.data.unhandledMessages;
        break;
      case 'undeserializable':
        validType = true;
        data = database.data.undeserializableMessages;
        break;
      case 'unserializable':
        validType = true;
        data = database.data.unserializableMessages;
        break;
      case 'inequal':
        validType = true;
        data = database.data.notEqualMessages;
        break;
    }

    if (!validType) {
      ctx.body = {
        last: 0,
        data: [],
      };
      return;
    }

    let from = data.length;
    if (ctx.query['from'] && !Number.isNaN(+ctx.query['from'])) {
      from = +ctx.query['from'];
    }

    ctx.body = paginate(data, from);
  });

  koaApp.use(logger());
  koaApp.use(apiRoute.routes());
  koaApp.use(serve(process.env.STATIC_ASSETS || defaultStaticAssetsDirectory, { index: 'index.html' }));

  const port = +(process.env.HTTP_PORT || defaultPort);
  koaApp.listen(port, () => { console.log(`Listening on port ${port}`); });
  
  setInterval(() => {
    database.write();
  }, 60 * 1000);
};

initialize();
