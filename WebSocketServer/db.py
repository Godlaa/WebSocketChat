import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DB_ADDR = os.getenv("DB_ADDR")

class Database:
    def __init__(self):
        self.pool = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(DB_ADDR)

    async def register_room(self, name, server_address):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO room (name, server_address) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET server_address = $2",
                name, server_address
            )

    async def save_message(self, room, sender, content):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO message (room, sender, content) VALUES ($1, $2, $3)",
                room, sender, content
            )

    async def get_history(self, room):
        async with self.pool.acquire() as conn:
            return await conn.fetch(
                "SELECT sender, content, timestamp FROM message WHERE room=$1 ORDER BY timestamp ASC",
                room
            )

db = Database()
