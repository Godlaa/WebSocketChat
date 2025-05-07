# db.py
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DB_ADDR = os.getenv("DB_ADDR")

class Database:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        try:
            self.pool = await asyncpg.create_pool(DB_ADDR)
        except asyncpg.PostgresError as e:
            print(f"Ошибка подключения к базе данных: {e}")
            raise
        except Exception as e:
            print(f"Неизвестная ошибка при инициализации пула соединений: {e}")
            raise

    async def register_room(self, name: str, server_host: str, server_port: int):
        """
        Ищет в currentNodes → currentConfiguration запись WebSocketServer по ip+port,
        получает её id и сохраняет в поле deployed_id таблицы room.
        """
        try:
            async with self.pool.acquire() as conn:
                rec = await conn.fetchrow(
                    'SELECT cc.id '
                    'FROM "currentConfiguration" cc '
                    'JOIN "currentNodes" cn ON cc."nodeId" = cn.id '
                    'WHERE cn.ip = $1 AND cc.port = $2 AND cc.type = $3',
                    server_host, server_port, "WebSocketServer"
                )
                if rec is None:
                    raise RuntimeError(f"WebSocketServer {server_host}:{server_port} не зарегистрирован в currentConfiguration")
                deployed_id = rec["id"]

                await conn.execute(
                    'INSERT INTO "room"(name, "deployed_id") '
                    'VALUES ($1, $2) '
                    'ON CONFLICT (name) DO UPDATE SET "deployed_id" = EXCLUDED."deployed_id"',
                    name, deployed_id
                )
        except asyncpg.PostgresError as e:
            print(f"Ошибка SQL при регистрации комнаты '{name}': {e}")
            raise
        except Exception as e:
            print(f"Неизвестная ошибка в register_room: {e}")
            raise

    async def save_message(self, room_id: int, text: str):
        """Сохраняет сообщение в таблицу message."""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    'INSERT INTO "message"(room_id, text) VALUES ($1, $2)',
                    room_id, text
                )
        except asyncpg.PostgresError as e:
            print(f"Ошибка SQL при сохранении сообщения для room_id={room_id}: {e}")
            raise
        except Exception as e:
            print(f"Неизвестная ошибка в save_message: {e}")
            raise

    async def get_history(self, room_id: str):
        """Возвращает историю из message по room_id."""
        try:
            async with self.pool.acquire() as conn:
                records = await conn.fetch(
                    'SELECT id, text '
                    'FROM "message" '
                    'WHERE room_id = $1 '
                    'ORDER BY id ASC',
                    room_id
                )
            return records
        except asyncpg.PostgresError as e:
            print(f"Ошибка SQL при получении истории для room_id={room_id}: {e}")
            raise
        except Exception as e:
            print(f"Неизвестная ошибка в get_history: {e}")
            raise

# глобальный экземпляр для приложения
db = Database()
