import asyncio
import websockets
import json
from pyrow import pyrow
import time

async def main(websocket, path):
    print('searching...')
    ergs = list(pyrow.find())
    while len(ergs) == 0:
        ergs = list(pyrow.find())
    print(ergs, "\a")
    erg = pyrow.PyErg(ergs[0])
    async def sender():
        while True:
            data = erg.get_monitor(forceplot=True)
            await websocket.send(json.dumps(data))
            await asyncio.sleep(0.1)
    async def recver():
        while True:
            a = json.loads(await websocket.recv())
            erg.set_workout(**a)
    await asyncio.gather(sender(), recver())

start_server = websockets.serve(main, 'localhost', 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
