import time
import threading
import socketio

SERVER_URL = "http://127.0.0.1:5000"
NUM_BOTS = 30
latencies_ms = []


def create_host_room() -> str:
    host = socketio.Client()
    room_holder = []

    @host.on("room_created")
    def on_created(data):
        room_holder.append(data["room_code"])

    host.connect(SERVER_URL)
    host.emit("create_room")
    time.sleep(0.5)
    host.disconnect()
    return room_holder[0]


def simulate_bot(bot_idx: int, room_code: str):
    client = socketio.Client()
    ping_sent_at = [0.0]

    @client.on("state_update")
    def on_update(_data):
        if ping_sent_at[0] > 0:
            latencies_ms.append((time.time() - ping_sent_at[0]) * 1000.0)
            ping_sent_at[0] = 0.0

    client.connect(SERVER_URL)
    client.emit("join_room_player", {"room_code": room_code, "name": f"Bot_{bot_idx}"})
    time.sleep(0.3)

    for step in range(5):
        ping_sent_at[0] = time.time()
        client.emit("gps_ping", {"lat": 12.9716 + step * 0.00001, "lon": 77.5946, "accuracy": 4.0})
        time.sleep(0.5)

    client.disconnect()


if __name__ == "__main__":
    code = create_host_room()
    print(f"Benchmarking {NUM_BOTS} concurrent WebSocket players on Room {code}...")
    threads = [threading.Thread(target=simulate_bot, args=(i, code)) for i in range(NUM_BOTS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    avg_lat = sum(latencies_ms) / max(len(latencies_ms), 1)
    print(f"Total Broadcasts Measured: {len(latencies_ms)}")
    print(f"Average End-to-End Latency: {avg_lat:.2f} ms (Target NFR-01: < 500 ms)")s