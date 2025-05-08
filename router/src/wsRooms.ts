import { WebSocketServer, WebSocket } from "ws";
import { pool } from "./db";
import { IncomingMessage } from "http";
import { Duplex } from "stream";

export function initRoomsWSS(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  // при апгрейде HTTP → WS
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer<ArrayBufferLike>) => {
    if (req.url === "/rooms-ws") {
      wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
    }
  });

  // обработка сообщений
  wss.on("connection", ws => {
    ws.on("message", async raw => {
      try {
        const msg = JSON.parse(raw.toString()) as { type:string; payload?: any };
        switch (msg.type) {
          case "list": {
            const { rows } = await pool.query("SELECT id, name FROM room ORDER BY id ASC");
            ws.send(JSON.stringify({ type: "list", rooms: rows }));
            break;
          }
          case "create": {
            const { name } = msg.payload;
            const { rows } = await pool.query(
              "INSERT INTO room(name) VALUES($1) RETURNING id, name",
              [name]
            );
            const room = rows[0];
            // шлём всем подключённым
            wss.clients.forEach(c => c.send(JSON.stringify({ type:"created", room })));
            break;
          }
          case "delete": {
            const { id } = msg.payload;
            await pool.query("DELETE FROM room WHERE id=$1", [id]);
            wss.clients.forEach(c => c.send(JSON.stringify({ type:"deleted", id })));
            break;
          }
          case "join": {
            const roomId: number = Number(msg.payload.id);
            const dep = await pool.query(
              'SELECT "deployed_id" FROM "room" WHERE id = $1',
              [roomId]
            );
            let serverConfigId: number;
            let host: string | undefined;
            let port: number | undefined;

            if (dep.rows.length && dep.rows[0].deployed_id) {
              serverConfigId = dep.rows[0].deployed_id;
            } else {
              // 2) Выбираем активный WS-сервер
              const servers = await pool.query(
                `SELECT cc.id AS config_id, cn.ip, cc.port
                 FROM "currentConfiguration" cc
                 JOIN "currentNodes" cn ON cc."nodeId" = cn.id
                 WHERE cc.type = $1 AND cn."isActive" = TRUE`,
                ["WebSocketServer"]
              );
              if (!servers.rows.length) {
                return ws.send(JSON.stringify({
                  type: "joinError",
                  error: "Нет доступных WebSocket-серверов"
                }));
              }
              const s = servers.rows[
                Math.floor(Math.random() * servers.rows.length)
              ];
              serverConfigId = s.config_id;
              host = s.ip;
              port = s.port;
              // 3) Сохраняем deployed_id
              await pool.query(
                'UPDATE "room" SET "deployed_id" = $1 WHERE id = $2',
                [serverConfigId, roomId]
              );
            }

            // 4) Если host/port не заполнены (был UPDATE)
            if (!host) {
              const row = await pool.query(
                `SELECT cn.ip, cc.port
                 FROM "currentConfiguration" cc
                 JOIN "currentNodes" cn ON cc."nodeId" = cn.id
                 WHERE cc.id = $1`,
                [serverConfigId]
              );
              if (!row.rows.length) {
                return ws.send(JSON.stringify({
                  type: "joinError",
                  error: "Конфигурация WS-сервера не найдена"
                }));
              }
              host = row.rows[0].ip;
              port = row.rows[0].port;
            }

            // 5) Отправляем клиенту URL для чата
            const wsUrl = `ws://${host}:${port}/ws/${roomId}`;
            ws.send(JSON.stringify({ type: "join", wsUrl }));
            break;
          }
        }
      } catch (e) {
        console.error("WS rooms error:", e);
      }
    });
  });
}
