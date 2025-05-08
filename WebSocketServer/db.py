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

    async def register_room(self, room_id: int, server_host: str, server_port: int):
        """
        Обновляем deployed_id для уже существующей комнаты по её id,
        а не создаём новую комнату.
        """
        async with self.pool.acquire() as conn:
            # 1) Находим конфиг-цель (currentConfiguration.id) по host+port
            rec = await conn.fetchrow(
                'SELECT cc.id '
                'FROM "currentConfiguration" cc '
                'JOIN "currentNodes" cn ON cc."nodeId" = cn.id '
                'WHERE cn.ip = $1 AND cc.port = $2 AND cc.type = $3',
                server_host, server_port, "WebSocketServer"
            )
            if not rec:
                raise RuntimeError(f"WS-сервер {server_host}:{server_port} не зарегистрирован")
            config_id = rec["id"]

            # 2) Обновляем запись в таблице room по её id
            await conn.execute(
                'UPDATE "room" '
                'SET "deployed_id" = $1 '
                'WHERE id = $2',
                config_id, room_id
            )

    async def save_message(self, room_id: int, text: str) -> int:
        """
        Сохраняет сообщение в таблицу message и возвращает его новый id.
        """
        try:
            async with self.pool.acquire() as conn:
                # выполняем INSERT с RETURNING id
                rec_id = await conn.fetchval(
                    'INSERT INTO "message"(room_id, text) VALUES ($1, $2) RETURNING id',
                    room_id, text
                )
                return rec_id
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
