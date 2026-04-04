const userSockets = new Map();
const socketMeta = new WeakMap();

const safeSend = (ws, payload) => {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(payload));
};

export const registerConnection = (userId, ws) => {
  if (!userId) return;
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  userSockets.get(key).add(ws);
  socketMeta.set(ws, {
    userId: key,
    groups: new Set(),
  });
};

export const unregisterConnection = (ws) => {
  const meta = socketMeta.get(ws);
  if (!meta) return;

  const sockets = userSockets.get(meta.userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      userSockets.delete(meta.userId);
    }
  }

  socketMeta.delete(ws);
};

export const subscribeSocketToGroup = (ws, groupId) => {
  const meta = socketMeta.get(ws);
  if (!meta) return false;
  meta.groups.add(String(groupId));
  return true;
};

export const unsubscribeSocketFromGroup = (ws, groupId) => {
  const meta = socketMeta.get(ws);
  if (!meta) return false;
  meta.groups.delete(String(groupId));
  return true;
};

export const broadcastToGroup = (groupId, memberIds, payload) => {
  const groupKey = String(groupId);

  for (const memberId of memberIds || []) {
    const sockets = userSockets.get(String(memberId));
    if (!sockets) continue;

    for (const ws of sockets) {
      const meta = socketMeta.get(ws);
      if (!meta || !meta.groups.has(groupKey)) continue;
      safeSend(ws, payload);
    }
  }
};

export const sendToSocket = (ws, payload) => {
  safeSend(ws, payload);
};
