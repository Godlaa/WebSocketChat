import asyncio
import websockets
import json

class MasterClient:
    def __init__(self, master_url, self_address):
        self.master_url = master_url
        self.self_address = self_address
        self.ws = None

    async def connect(self):
        while True:
            try:
                async with websockets.connect(self.master_url) as ws:
                    self.ws = ws
                    await self.register()
                    await self.listen_forever()
            except Exception as e:
                print(f"Master connection failed: {e}")
                await asyncio.sleep(5)

    async def register(self):
        await self.ws.send(json.dumps({
            "type": "register",
            "addr": self.self_address
        }))

    async def listen_forever(self):
        try:
            while True:
                await asyncio.sleep(1)
                if self.ws.closed:
                    break
        except Exception as e:
            print(f"Connection to master interrupted: {e}")
