import math
import random
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GeoPoint:
    lat: float
    lon: float
    timestamp: float
    accuracy: float = 5.0


class MotionValidator:
    EARTH_RADIUS_M = 6371000.0

    def __init__(self, speed_threshold_mps: float = 0.8, min_distance_m: float = 1.5):
        self.speed_threshold_mps = speed_threshold_mps
        self.min_distance_m = min_distance_m

    @classmethod
    def haversine_distance(cls, p1: GeoPoint, p2: GeoPoint) -> float:
        phi1, phi2 = math.radians(p1.lat), math.radians(p2.lat)
        d_phi = math.radians(p2.lat - p1.lat)
        d_lambda = math.radians(p2.lon - p1.lon)

        a = (
            math.sin(d_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return cls.EARTH_RADIUS_M * c

    def evaluate_movement(
        self, p1: GeoPoint, p2: GeoPoint, light_state: str
    ) -> tuple[bool, float, str]:
        dt = p2.timestamp - p1.timestamp
        if dt <= 0:
            return False, 0.0, "OK"

        dist = self.haversine_distance(p1, p2)
        if dist < self.min_distance_m:
            return False, 0.0, "GPS_JITTER_FILTERED"

        speed = dist / dt
        if light_state == "RED" and speed > self.speed_threshold_mps:
            return True, speed, "RED_LIGHT_MOVEMENT_VIOLATION"

        return False, speed, "OK"


@dataclass
class GeofenceBoundary:
    vertices: list[tuple[float, float]] = field(default_factory=list)

    def is_inside(self, lat: float, lon: float) -> bool:
        n = len(self.vertices)
        if n < 3:
            return True
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = self.vertices[i]
            xj, yj = self.vertices[j]
            intersect = ((yi > lon) != (yj > lon)) and (
                lat < (xj - xi) * (lon - yi) / ((yj - yi) or 1e-12) + xi
            )
            if intersect:
                inside = not inside
            j = i
        return inside

    def contains(self, point: GeoPoint) -> bool:
        return self.is_inside(point.lat, point.lon)


@dataclass
class PlayerState:
    player_id: str
    name: str
    avatar: str = "runner:#00e676"
    contestant_no: str = "001"
    status: str = "ACTIVE"
    last_point: Optional[GeoPoint] = None
    speed_mps: float = 0.0
    elimination_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "player_id": self.player_id,
            "name": self.name,
            "avatar": self.avatar,
            "contestant_no": self.contestant_no,
            "status": self.status,
            "lat": self.last_point.lat if self.last_point else None,
            "lon": self.last_point.lon if self.last_point else None,
            "accuracy": self.last_point.accuracy if self.last_point else None,
            "speed_mps": round(self.speed_mps, 2),
            "elimination_reason": self.elimination_reason,
        }


class GameSession:
    FINISH_RADIUS_M = 5.0

    def __init__(self, room_code: str):
        self.room_code = room_code
        self.light_state = "LOBBY"
        self.finish_line: Optional[GeoPoint] = None
        self.geofence = GeofenceBoundary()
        self.validator = MotionValidator()
        self.players: dict[str, PlayerState] = {}
        self.logs: list[str] = []
        self._next_number = 1

    @staticmethod
    def generate_room_code() -> str:
        return f"SQ-{random.randint(1000, 9999)}"

    def log(self, message: str):
        ts = time.strftime("%H:%M:%S")
        self.logs.insert(0, f"[{ts}] {message}")
        self.logs = self.logs[:40]

    def add_player(
        self, player_id: str, name: str, avatar: str = "runner:#00e676"
    ) -> PlayerState:
        contestant_no = f"{self._next_number:03d}"
        self._next_number += 1
        player = PlayerState(
            player_id=player_id,
            name=name or f"Player {contestant_no}",
            avatar=avatar or "runner:#00e676",
            contestant_no=contestant_no,
        )
        self.players[player_id] = player
        self.log(f"#{contestant_no} {player.name} entered the arena.")
        return player

    def remove_player(self, player_id: str):
        player = self.players.pop(player_id, None)
        if player:
            self.log(f"#{player.contestant_no} {player.name} disconnected (RAM cleared).")

    def set_light_state(self, new_state: str):
        self.light_state = new_state
        self.log(f"Signal switched to {new_state}.")

    def process_gps_ping(self, player_id: str, point: GeoPoint) -> Optional[dict]:
        player = self.players.get(player_id)
        if not player or player.status != "ACTIVE":
            return None

        if player.last_point is not None:
            violated, speed, reason = self.validator.evaluate_movement(
                player.last_point, point, self.light_state
            )
        else:
            violated, speed, reason = False, 0.0, "OK"

        player.last_point = point
        player.speed_mps = speed

        # Enforce arena rules only after the Host starts the match (not in LOBBY/ENDED)
        if self.light_state in ("GREEN", "RED"):
            if len(self.geofence.vertices) >= 3 and not self.geofence.is_inside(
                point.lat, point.lon
            ):
                player.status = "ELIMINATED"
                player.elimination_reason = "OUT_OF_BOUNDS"
                self.log(f"ELIMINATED: #{player.contestant_no} {player.name} left geofence.")
                return {"event": "eliminated", "reason": "OUT_OF_BOUNDS"}

            if self.finish_line is not None:
                dist_to_finish = MotionValidator.haversine_distance(point, self.finish_line)
                if dist_to_finish <= self.FINISH_RADIUS_M:
                    player.status = "WINNER"
                    self.light_state = "ENDED"
                    self.log(
                        f"WINNER: #{player.contestant_no} {player.name} crossed finish line!"
                    )
                    return {"event": "winner"}

            if violated:
                player.status = "ELIMINATED"
                player.elimination_reason = reason
                self.log(
                    f"ELIMINATED: #{player.contestant_no} {player.name} moved ({speed:.2f} m/s) on RED."
                )
                return {"event": "eliminated", "reason": reason}

        return None

    def purge_sensitive_data(self):
        for p in self.players.values():
            p.last_point = None
            p.speed_mps = 0.0
        self.log("All player GPS coordinates purged from volatile RAM.")

    def snapshot(self) -> dict:
        return {
            "room_code": self.room_code,
            "light_state": self.light_state,
            "finish_line": (
                {"lat": self.finish_line.lat, "lon": self.finish_line.lon}
                if self.finish_line
                else None
            ),
            "geofence": self.geofence.vertices,
            "players": [p.to_dict() for p in self.players.values()],
            "logs": self.logs,
        }