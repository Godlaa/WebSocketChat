import express from "express";
import { pool } from "./db";
import cors from "cors";
import http from "http";

const app = express();
app.use(cors());
app.use(express.json());

// Получить список комнат
app.get("/rooms", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM room ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error("Ошибка при получении комнат:", err);
    res.status(500).json({ error: "Не удалось получить список комнат" });
  }
});

// Создать новую комнату
app.post("/rooms", async (req, res) => {
  try {
    const { name } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO room(name) VALUES($1) RETURNING id, name",
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Ошибка при создании комнаты:", err);
    res.status(500).json({ error: "Не удалось создать комнату" });
  }
});

// Удалить комнату
app.delete("/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM room WHERE id = $1", [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error(`Ошибка при удалении комнаты ${req.params.id}:`, err);
    res.status(500).json({ error: "Не удалось удалить комнату" });
  }
});

// Присоединиться к комнате — возвращает URL WebSocket-сервера
app.get("/rooms/:id/join", async (req, res) => {
  try {
    const roomId = Number(req.params.id);

    // 1) Смотрим, есть ли уже deployed_id в таблице room
    const depRes = await pool.query(
      'SELECT "deployed_id" FROM "room" WHERE id = $1',
      [roomId]
    );

    let serverConfigId: number;
    let host: string | undefined;
    let port: number | undefined;

    if (depRes.rows.length && depRes.rows[0].deployed_id) {
      // уже привязано
      serverConfigId = depRes.rows[0].deployed_id;
    } else {
      // 2) Выбираем один из живых WebSocket-серверов из currentConfiguration
      const servers = await pool.query(
        `SELECT cc.id AS config_id, cn.ip, cc.port
         FROM "currentConfiguration" AS cc
         JOIN "currentNodes"      AS cn ON cc."nodeId" = cn.id
         WHERE cc.type = $1 AND cn."isActive" = TRUE`,
        ["WebSocketServer"]
      );
      if (!servers.rows.length) {
        res
          .status(503)
          .json({ error: "Нет доступных WebSocket-серверов" });
      }
      const s = servers.rows[
        Math.floor(Math.random() * servers.rows.length)
      ];
      serverConfigId = s.config_id;
      host = s.ip;
      port = s.port;

      // 3) Сохраняем deployed_id в room
      await pool.query(
        'UPDATE "room" SET "deployed_id" = $1 WHERE id = $2',
        [serverConfigId, roomId]
      );
    }

    // 4) Если мы не получили host/port выше, достаём их по serverConfigId
    if (host === undefined) {
      const row = await pool.query(
        `SELECT cn.ip, cc.port
         FROM "currentConfiguration" AS cc
         JOIN "currentNodes"      AS cn ON cc."nodeId" = cn.id
         WHERE cc.id = $1`,
        [serverConfigId]
      );
      if (!row.rows.length) {
        res
          .status(500)
          .json({ error: "Конфигурация WebSocket-сервера не найдена" });
      }
      host = row.rows[0].ip;
      port = row.rows[0].port;
    }

    // 5) Возвращаем клиенту URL для WebSocket-соединения
    const wsUrl = `ws://${host}:${port}/ws/${roomId}`;
    res.json({ wsUrl });

  } catch (err) {
    console.error(`Ошибка при join для комнаты ${req.params.id}:`, err);
    res
      .status(500)
      .json({ error: "Не удалось присоединиться к комнате" });
  }
});

const server = http.createServer(app);
const PORT = process.env.PORT ?? 5000;
server.listen(PORT, () => console.log(`Router listening on ${PORT}`));
