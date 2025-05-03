import argparse
import os
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from db import db
from master_client import MasterClient

app = FastAPI()
clients = {}

# Вызывается автоматически FastAPI при запуске сервера.
# Подключает сервер к БД и запускает фоновый asyncio-поток, который соединяется с мастером
@app.on_event("startup")
async def startup():
    await db.connect()
    asyncio.create_task(start_master_client())


# WebSocket endpoint, к которому подключаются клиенты.
@app.websocket("/ws/{room}/{username}")
async def websocket_endpoint(websocket: WebSocket, room: str, username: str):
    await websocket.accept()
    clients.setdefault(room, set()).add(websocket)
    await db.register_room(room, f"{HOST}:{PORT}")
    try:
        while True:
            data = await websocket.receive_text() # читаем кто что отправил
            await db.save_message(room, username, data)
            for client in clients[room]: # отправляем всем остальным
                if client != websocket:
                    await client.send_text(f"{username}: {data}")
    except WebSocketDisconnect:
        clients[room].remove(websocket)

# Это ваще кто
@app.get("/history/{room}")
async def get_history(room: str):
    records = await db.get_history(room)
    return [{"sender": r["sender"], "content": r["content"], "timestamp": r["timestamp"]} for r in records]

# ----- Startup logic -----

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", required=True)
    return parser.parse_args()

args = parse_args()
HOST, PORT = args.host, int(args.port)

async def start_master_client():
    master_url = os.getenv("MASTER_URL", "ws://master:9000/ws")
    client = MasterClient(master_url, f"{HOST}:{PORT}")
    await client.connect()
