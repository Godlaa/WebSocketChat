import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from db import db
from master_client import MasterClient

# читаем HOST/PORT из окружения до объявления endpoint-ов
HOST = os.getenv("HOST", "localhost")
PORT = int(os.getenv("PORT", "8080"))

app = FastAPI()
clients: dict[str, set[WebSocket]] = {}

@app.on_event("startup")
async def startup():
    await db.connect()
    # запускаем фоновый клиент MasterNode
    asyncio.create_task(start_master_client())

@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await websocket.accept()
    clients.setdefault(room, set()).add(websocket)

    # Зарегистрировать комнату (привязать к этому WS-серверу)
    await db.register_room(room, HOST, PORT)

    # 1) При подключении сразу высылаем историю
    history = await db.get_history(int(room))
    await websocket.send_json({
        "type": "history",
        "messages": [{"id": r["id"], "text": r["text"]} for r in history]
    })

    try:
        while True:
            data = await websocket.receive_text()
            rec = await db.save_message(int(room), data)
            new_msg = {
                "type": "message",
                "message": {
                    "id": rec,
                    "text": data
                }
            }
            for client in clients[room]:
                await client.send_json(new_msg)
    except WebSocketDisconnect:
        clients[room].remove(websocket)

@app.post("/rooms/{room}/message")
async def post_message(room: str, body: MessageIn):
    """Принимает POST /rooms/{room}/message с JSON {text:string}"""
    room_id = int(room)
    # 1) сохраняем в БД
    rec_id = await db.save_message(room_id, body.text)
    # 2) готовим полезлоад
    payload = {"type":"message","message":{"id":rec_id,"text":body.text}}
    # 3) рассылаем всем подключённым в этой комнате
    if room not in clients:
        raise HTTPException(404, f"Комната {room} не найдена")
    for ws in set(clients[room]):
        await ws.send_json(payload)
    return {"status":"ok","id":rec_id}
    
async def start_master_client():
    master_url = os.getenv("MASTER_URL", "")
    client = MasterClient(master_url, f"{HOST}:{PORT}")
    await client.connect()

# —————— точка входа ——————

if __name__ == "__main__":
    # Запускаем Uvicorn
    import uvicorn
    uvicorn.run("server:app", host=HOST, port=PORT)
