import os
import time
from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit, join_room
from game_engine import GameSession, GeoPoint

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "bcs501-sepm-geosquid")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

sessions: dict[str, GameSession] = {}
sid_to_room: dict[str, str] = {}


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    target = os.path.join(DIST_DIR, path)
    if path and os.path.exists(target):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


@socketio.on("create_room")
def handle_create_room():
    code = GameSession.generate_room_code()
    while code in sessions:
        code = GameSession.generate_room_code()
    session = GameSession(code)
    sessions[code] = session
    join_room(code)
    sid_to_room[request.sid] = code
    session.log("Arena room initialized by Host.")
    emit("room_created", session.snapshot())


@socketio.on("rejoin_room_host")
def handle_rejoin_host(data):
    code = data.get("room_code", "").strip().upper()
    session = sessions.get(code)
    if not session:
        emit("room_expired")
        return
    join_room(code)
    sid_to_room[request.sid] = code
    session.log("Host reconnected to active arena.")
    emit("room_created", session.snapshot())


@socketio.on("join_room_player")
def handle_join_player(data):
    code = data.get("room_code", "").strip().upper()
    name = data.get("name", "Player").strip()[:20]
    session = sessions.get(code)
    if not session:
        emit("join_error", {"message": "Invalid Room Code. Verify on Host Console."})
        return

    join_room(code)
    sid_to_room[request.sid] = code
    player = session.add_player(request.sid, name)
    emit("joined_success", {"player": player.to_dict(), "light_state": session.light_state})
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("set_finish_line")
def handle_finish_line(data):
    code = sid_to_room.get(request.sid)
    session = sessions.get(code)
    if not session:
        return
    session.finish_line = GeoPoint(lat=float(data["lat"]), lon=float(data["lon"]), timestamp=time.time())
    session.log(f"Finish line calibrated at ({data['lat']:.5f}, {data['lon']:.5f}).")
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("set_geofence")
def handle_geofence(data):
    code = sid_to_room.get(request.sid)
    session = sessions.get(code)
    if not session:
        return
    vertices = [(float(pt[0]), float(pt[1])) for pt in data.get("vertices", [])]
    session.geofence.vertices = vertices
    session.log(f"Geofence polygon active ({len(vertices)} vertices).")
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("set_light")
def handle_set_light(data):
    code = sid_to_room.get(request.sid)
    session = sessions.get(code)
    if not session:
        return
    new_state = data.get("light_state", "LOBBY")
    session.set_light_state(new_state)
    socketio.emit("light_changed", {"light_state": new_state}, room=code)
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("gps_ping")
def handle_gps_ping(data):
    code = sid_to_room.get(request.sid)
    session = sessions.get(code)
    if not session:
        return

    point = GeoPoint(
        lat=float(data["lat"]),
        lon=float(data["lon"]),
        timestamp=time.time(),
        accuracy=float(data.get("accuracy", 5.0)),
    )
    alert = session.process_gps_ping(request.sid, point)
    if alert:
        emit("player_alert", alert, to=request.sid)
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("purge_data")
def handle_purge_data():
    code = sid_to_room.get(request.sid)
    session = sessions.get(code)
    if not session:
        return
    session.set_light_state("ENDED")
    session.purge_sensitive_data()
    socketio.emit("state_update", session.snapshot(), room=code)


@socketio.on("disconnect")
def handle_disconnect():
    code = sid_to_room.pop(request.sid, None)
    session = sessions.get(code)
    if session:
        session.remove_player(request.sid)
        socketio.emit("state_update", session.snapshot(), room=code)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)