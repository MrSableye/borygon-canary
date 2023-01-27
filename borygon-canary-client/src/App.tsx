import React, { useEffect, useState } from 'react';
import * as moment from 'moment';
import setupDuration from 'moment-duration-format';
import borygonSprite from './borygon.png';
import './App.css';
import {
  getInequalLogs,
  getMetadata,
  getMetrics,
  getRooms,
  getUndeserializableLogs,
  getUnhandledLogs,
  getUnserializableLogs,
  Metadata,
  Metrics,
  NotEqualMessage,
  Paginated,
  UndeserializableMessage,
  UnhandledMessage,
  UnserializableMessage,
} from './api';

setupDuration(moment);

const Hideable = ({ children, startHidden }: { children: React.ReactNode, startHidden: boolean}) => {
  const [hidden, setHidden] = useState(startHidden);

  if (hidden) {
    return <span style={{ cursor: 'pointer'}} onClick={() => setHidden(false)}>▶ Show</span>;
  }

  return <span>
    <div style={{ cursor: 'pointer'}} onClick={() => setHidden(true)}>▼ Hide</div>
    <div>{children}</div>
  </span>;
};

const jsxJoin = (array: React.ReactNode[], join: React.ReactNode) => array.length > 0
  ? array.reduce((result, item) => <>{result}{join}{item}</>)
  : null;

const showdownRoomLink = (room: string) => `https://play.pokemonshowdown.com/${room}`;

const showdownReplayLink = (battleId: string) => {
  const replacedBattleId = battleId.replace(/^battle-/, '');
  return `https://replay.pokemonshowdown.com/${replacedBattleId}`;
};

const Uptime = ({ startTime }: { startTime: number}) => {
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 300);

    return () => clearInterval(interval);
  });

  const duration = moment.duration(time - startTime, 'milliseconds');
  const uptimeDuration = duration.format('HH:mm:ss', { trim: false });

  return <>{uptimeDuration}</>
};

const MetadataDisplay = ({ metadata }: { metadata: Metadata }) => <div>
  <strong>User</strong>: {metadata.showdownUsername} / <strong>Uptime</strong>: <Uptime startTime={metadata.startTime} />
</div>;

const UnhandledMessagesDisplay = ({ unhandledMessages, loadMore }: { unhandledMessages: Paginated<UnhandledMessage>, loadMore: (type: LogType) => void }) => <table>
  <tr>
    <th>Timestamp</th>
    <th>Room</th>
    <th>Raw message</th>
  </tr>
  { 
    unhandledMessages.data.map((message) => <tr>
      <td><code>{new Date(message.timestamp).toISOString()}</code></td>
      <td><code><a href={showdownReplayLink(message.room)}>{message.room}</a></code></td>
      <td><code>{message.rawMessage}</code></td>
    </tr>)
  }
  { unhandledMessages.last > 0 && <tr><td colSpan={3} onClick={() => loadMore('unhandled')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Load more</td></tr> }
</table>;

const UndeserializableMessagesDisplay = ({ undeserializableMessages, loadMore }: { undeserializableMessages: Paginated<UndeserializableMessage>, loadMore: (type: LogType) => void }) => <table>
  <tr>
    <th>Timestamp</th>
    <th>Room</th>
    <th>Raw message</th>
    <th>Errors</th>
  </tr>
  { 
    undeserializableMessages.data.map((message) => <tr>
      <td><code>{new Date(message.timestamp).toISOString()}</code></td>
      <td><code><a href={showdownReplayLink(message.room)}>{message.room}</a></code></td>
      <td><code>{message.rawMessage}</code></td>
      <td>{message.errors.join(', ')}</td>
    </tr>)
  }
  { undeserializableMessages.last > 0 && <tr><td colSpan={4} onClick={() => loadMore('undeserializable')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Load more</td></tr> }
</table>;

const UnserializableMessagesDisplay = ({ unserializableMessages, loadMore }: { unserializableMessages: Paginated<UnserializableMessage>, loadMore: (type: LogType) => void }) => <table>
  <tr>
    <th>Timestamp</th>
    <th>Room</th>
    <th>Raw message</th>
    <th>JSON</th>
    <th>Kwargs</th>
    <th>Errors</th>
  </tr>
  { 
    unserializableMessages.data.map((message) => <tr>
      <td><code>{new Date(message.timestamp).toISOString()}</code></td>
      <td><code><a href={showdownReplayLink(message.room)}>{message.room}</a></code></td>
      <td><code>{message.rawMessage}</code></td>
      <td><Hideable startHidden={true}><code>{JSON.stringify(message.deserializedMessage[0])}</code></Hideable></td>
      <td><Hideable startHidden={true}><code>{JSON.stringify(message.deserializedMessage[1])}</code></Hideable></td>
      <td>{message.errors.join(', ')}</td>
    </tr>)
  }
  { unserializableMessages.last > 0 && <tr><td colSpan={6} onClick={() => loadMore('unserializable')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Load more</td></tr> }
</table>;

const NotEqualMessagesDisplay = ({ notEqualMessages, loadMore }: { notEqualMessages: Paginated<NotEqualMessage>, loadMore: (type: LogType) => void }) => <table>
  <tr>
    <th>Timestamp</th>
    <th>Room</th>
    <th>Raw message</th>
    <th>Serialized messages</th>
    <th>JSON</th>
    <th>Kwargs</th>
  </tr>
  { 
    notEqualMessages.data.map((message) => <tr>
      <td><code>{new Date(message.timestamp).toISOString()}</code></td>
      <td><code><a href={showdownReplayLink(message.room)}>{message.room}</a></code></td>
      <td><code>{message.rawMessage}</code></td>
      <td><code>{message.serializedMessage}</code></td>
      <td><Hideable startHidden={true}><code>{JSON.stringify(message.deserializedMessage[0])}</code></Hideable></td>
      <td><Hideable startHidden={true}><code>{JSON.stringify(message.deserializedMessage[1])}</code></Hideable></td>
    </tr>)
  }
  { notEqualMessages.last > 0 && <tr><td colSpan={5} onClick={() => loadMore('notequal')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Load more</td></tr> }
</table>;

type LogType = 'unhandled' | 'undeserializable' | 'unserializable' | 'notequal';

interface LogDisplayProps {
  metrics: Metrics;
  unhandledMessages?: Paginated<UnhandledMessage>;
  undeserializableMessages?: Paginated<UndeserializableMessage>;
  unserializableMessages?: Paginated<UnserializableMessage>;
  notEqualMessages?: Paginated<NotEqualMessage>;
  loadMore: (type: LogType) => void;
}

const LogDisplay = ({ metrics, unhandledMessages, undeserializableMessages, unserializableMessages, notEqualMessages, loadMore }: LogDisplayProps) => {
  const [selected, setSelected] = useState(0);
  const items = jsxJoin([
    <><strong>Seen</strong>: {metrics.seen}</>,
    <><strong onClick={() => setSelected(0)} style={{ cursor: 'pointer', textDecoration: selected === 0 ? 'underline' : '' }}>Unhandled</strong>: {metrics.unhandled}</>,
    <><strong onClick={() => setSelected(1)} style={{ cursor: 'pointer', textDecoration: selected === 1 ? 'underline' : '' }}>Undeserializable</strong>: {metrics.undeserializable}</>,
    <><strong onClick={() => setSelected(2)} style={{ cursor: 'pointer', textDecoration: selected === 2 ? 'underline' : '' }}>Unserializable</strong>: {metrics.unserializable}</>,
    <><strong onClick={() => setSelected(3)} style={{ cursor: 'pointer', textDecoration: selected === 3 ? 'underline' : '' }}>Not Equal</strong>: {metrics.inequal}</>,
  ], ' / ');

  let child = <></>;

  if (selected === 0 && unhandledMessages) {
    child = <UnhandledMessagesDisplay unhandledMessages={unhandledMessages} loadMore={loadMore} />;
  } else if (selected === 1 && undeserializableMessages) {
    child = <UndeserializableMessagesDisplay undeserializableMessages={undeserializableMessages} loadMore={loadMore} />;
  } else if (selected === 2 && unserializableMessages) {
    child = <UnserializableMessagesDisplay unserializableMessages={unserializableMessages} loadMore={loadMore} />;
  } else if (selected === 3 && notEqualMessages) {
    child = <NotEqualMessagesDisplay notEqualMessages={notEqualMessages} loadMore={loadMore} />;
  }

  return <div>
    <div>
      {items}
    </div>
    {child}
  </div>;
};

const RoomDisplay = ({ rooms }: { rooms: string[] }) => <div>
  <strong>Rooms</strong>: <Hideable startHidden={true}>{jsxJoin(rooms.map((room) => <a href={showdownRoomLink(room)}>{room}</a>), ', ')}</Hideable>
</div>;

const App = () => {
  const [metadata, setMetadata] = useState<Metadata>();
  const [metrics, setMetrics] = useState<Metrics>();
  const [rooms, setRooms] = useState<string[]>();
  const [unhandledMessages, setUnhandledMessages] = useState<Paginated<UnhandledMessage>>();
  const [undeserializableMessages, setUndeserializableMessages] = useState<Paginated<UndeserializableMessage>>();
  const [unserializableMessages, setUnserializableMessages] = useState<Paginated<UnserializableMessage>>();
  const [notEqualMessages, setNotEqualMessages] = useState<Paginated<NotEqualMessage>>();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const update = () => {
    if (!autoRefresh) return;
    getInequalLogs().then(setNotEqualMessages);
    getMetadata().then(setMetadata);
    getMetrics().then(setMetrics);
    getRooms().then(setRooms);
    getUndeserializableLogs().then(setUndeserializableMessages);
    getUnhandledLogs().then(setUnhandledMessages);
    getUnserializableLogs().then(setUnserializableMessages);
  };

  const loadMore = (type: 'unhandled' | 'undeserializable' | 'unserializable' | 'notequal') => {
    setAutoRefresh(false);
    switch (type) {
      case 'unhandled':
        if (unhandledMessages && unhandledMessages.last > 0) {
          getUnhandledLogs(unhandledMessages.last).then((result) => {
            setUnhandledMessages((previous) => ({
              data: [...(previous?.data || []), ...result.data],
              last: result.last,
            }));
          });
        }
        break;
      case 'undeserializable':
        if (undeserializableMessages && undeserializableMessages.last > 0) {
          getUndeserializableLogs(undeserializableMessages.last).then((result) => {
            setUndeserializableMessages((previous) => ({
              data: [...(previous?.data || []), ...result.data],
              last: result.last,
            }));
          });
        }
        break;
      case 'unserializable':
        if (unserializableMessages && unserializableMessages.last > 0) {
          getUnserializableLogs(unserializableMessages.last).then((result) => {
            setUnserializableMessages((previous) => ({
              data: [...(previous?.data || []), ...result.data],
              last: result.last,
            }));
          });
        }
        break;
      case 'notequal':
        if (notEqualMessages && notEqualMessages.last > 0) {
          getInequalLogs(notEqualMessages.last).then((result) => {
            setNotEqualMessages((previous) => ({
              data: [...(previous?.data || []), ...result.data],
              last: result.last,
            }));
          });
        }
        break;
    }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    update();
    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="App">
      <img src={borygonSprite} className="borygon" />
      <div><label><input type='checkbox' checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)}/> Auto refresh</label></div>
      { metadata && <MetadataDisplay metadata={metadata} /> }
      { rooms && <RoomDisplay rooms={rooms} /> }
      { metrics && <LogDisplay
        metrics={metrics}
        unhandledMessages={unhandledMessages}
        undeserializableMessages={undeserializableMessages}
        unserializableMessages={unserializableMessages}
        notEqualMessages={notEqualMessages}
        loadMore={loadMore}
      />}
    </div>
  );
};

export default App;
