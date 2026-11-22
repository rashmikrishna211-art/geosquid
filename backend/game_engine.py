import math
import time
import random
import string
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional


@dataclass
class GeoPoint:
    lat: float
    lon: float
    timestamp: float
    accuracy: float = 5.0


class MotionValidator:
    """
    Mitigates GPS multipath drift (Risk R-01) and cellular packet drops (Risk R-02)
    using the Haversine formula with noise deadband filtering.
    """
    EARTH_RADIUS_M = 6371000.0

    def __init__(
        self,
        speed_threshold_mps: float = 0.8,
        min_distance_m: float = 1.5,
        max_accuracy_m: float = 15.0,
        max_ping_gap_s: float = 3.5,
    ):
        self.speed_threshold_mps = speed_threshold_mps
        self.min_distance_m = min_distance_m
        self.max_accuracy_m = max_accuracy_m
        self.max_ping_gap_s = max_ping_gap_s

    @classmethod
    def haversine_distance(cls, p1: GeoPoint, p2: GeoPoint) -> float:
        phi1, phi2 = math.radians(p1.lat), math.radians(p2.lat)
        dphi = math.radians(p2.lat - p1.lat)
        dlambda = math.radians(p2.lon - p1.lon)

        a = (
            math.sin(dphi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return cls.EARTH_RADIUS_M * c

    def evaluate_movement(
        self, prev_point: GeoPoint, curr_point: GeoPoint, light_state: str
    ) -> Tuple[bool, float, str]:
        """Returns (is_violation, speed_mps, diagnostic_reason)."""
        if light_state != "RED":
            return False, 0.0, "GREEN_LIGHT_ALLOWED"

        if curr_point.accuracy > self.max_accuracy_m:
            return False, 0.0, "LOW_GPS_ACCURACY_IGNORED"

        dt = curr_point.timestamp - prev_point.timestamp
        if dt <= 0 or dt > self.max_ping_gap_s:
            return False, 0.0, "STALE_PING_GAP_IGNORED"

        distance = self.haversine_distance(prev_point, curr_point)
        speed = distance / dt

        if distance < self.min_distance_m:
            return False, round(speed, 2), "GPS_JITTER_FILTERED"

        if speed > self.speed_threshold_mps:
            return True, round(speed, 2), "RED_LIGHT_MOVEMENT_VIOLATION"

        return False, round(speed, 2), "WITHIN_THRESHOLD"


class GeofenceBoundary:
    """Enforces play-area boundaries via the Ray-Casting Point-in-Polygon algorithm."""

    def __init__(self, vertices: Optional[List[Tuple[float, float]]] = None):
        self.vertices: List[Tuple[float, float]] = vertices or []

    def is_inside(self, lat: float, lon: float) -> bool:
        if len(self.vertices) < 3:
            return True

        inside = False
        n = len(self.vertices)
        j = n - 1
        for i in range(n):
            yi, xi = self.vertices[i]
            yj, xj = self.vertices[j]
            intersect = ((yi > lat) != (yj > lat)) and (
                lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi
            )
            if intersect:
                inside = not inside
            j = i
        return inside


@dataclass
class Player:
    player_id: str
    name: str
    status: str = "ACTIVE"  # ACTIVE | ELIMINATED | WINNER
    elimination_reason: Optional[str] = None
    last_point: Optional[GeoPoint] = None
    freeze_point: Optional[GeoPoint] = None
    speed_mps: float = 0.0
    finish_time_s: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "player_id": self.player_id,
            "name": self.name,
            "status": self.status,
            "elimination_reason": self.elimination_reason,
            "lat": self.last_point.lat if self.last_point else None,
            "lon": self.last_point.lon if self.last_point else None,
            "accuracy": self.last_point.accuracy if self.last_point else None,
            "speed_mps": self.speed_mps,
            "finish_time_s": self.finish_time_s,
        }


class GameSession:
    """Manages match lifecycle, state transitions, and ephemeral RAM purging."""
    WIN_RADIUS_M = 5.0

    def __init__(self, room_code: str):
        self.room_code = room_code
        self.light_state: str = "LOBBY"  # LOBBY | GREEN | RED | ENDED
        self.start_time: Optional[float] = None
        self.players: Dict[str, Player] = {}
        self.validator = MotionValidator()
        self.geofence = GeofenceBoundary()
        self.finish_line: Optional[GeoPoint] = None
        self.event_log: List[str] = []

    @staticmethod
    def generate_room_code() -> str:
        return "SQ-" + "".join(random.choices(string.digits, k=4))

    def log(self, message: str):
        ts = time.strftime("%H:%M:%S")
        self.event_log.insert(0, f"[{ts}] {message}")
        self.event_log = self.event_log[:50]

    def add_player(self, player_id: str, name: str) -> Player:
        player = Player(player_id=player_id, name=name)
        self.players[player_id] = player
        self.log(f"{name} joined the lobby.")
        return player

    def remove_player(self, player_id: str):
        player = self.players.pop(player_id, None)
        if player:
            self.log(f"{player.name} disconnected.")

    def set_light_state(self, new_state: str):
        self.light_state = new_state
        if new_state == "GREEN" and self.start_time is None:
            self.start_time = time.time()
        if new_state == "RED":
            for p in self.players.values():
                if p.status == "ACTIVE" and p.last_point:
                    p.freeze_point = p.last_point
        self.log(f"Host switched signal to {new_state}.")

    def process_gps_ping(self, player_id: str, point: GeoPoint) -> Optional[dict]:
        player = self.players.get(player_id)
        if not player:
            return None

        if player.status != "ACTIVE":
            player.last_point = point
            return None

        # 1. Polygon Geofence Boundary Check
        if self.light_state in ("GREEN", "RED") and not self.geofence.is_inside(point.lat, point.lon):
            player.status = "ELIMINATED"
            player.elimination_reason = "OUTSIDE_GEOFENCE_BOUNDARY"
            player.last_point = point
            self.log(f"ELIMINATED: {player.name} crossed outside geofence.")
            self._check_auto_end()
            return {"event": "eliminated", "player": player.to_dict()}

        # 2. Red Light Speed & Displacement Check
        if self.light_state == "RED" and player.freeze_point is not None:
            violated, speed, reason = self.validator.evaluate_movement(
                player.freeze_point, point, "RED"
            )
            player.speed_mps = speed
            if violated:
                player.status = "ELIMINATED"
                player.elimination_reason = reason
                player.last_point = point
                self.log(f"ELIMINATED: {player.name} moved at {speed} m/s on RED LIGHT.")
                self._check_auto_end()
                return {"event": "eliminated", "player": player.to_dict()}

        # 3. Finish Line Proximity Win Check
        if self.light_state == "GREEN" and self.finish_line is not None:
            dist_to_finish = MotionValidator.haversine_distance(point, self.finish_line)
            if dist_to_finish <= self.WIN_RADIUS_M:
                player.status = "WINNER"
                player.finish_time_s = round(time.time() - (self.start_time or time.time()), 1)
                player.last_point = point
                self.log(f"WINNER: {player.name} cleared in {player.finish_time_s}s!")
                self._check_auto_end()
                return {"event": "winner", "player": player.to_dict()}

        player.last_point = point
        self._check_auto_end()
        return None

    def _check_auto_end(self):
        if self.light_state in ("GREEN", "RED") and len(self.players) > 0:
            active_count = sum(1 for p in self.players.values() if p.status == "ACTIVE")
            if active_count == 0:
                self.light_state = "ENDED"
                self.log("All players finished or eliminated. Match ENDED.")

    def purge_sensitive_data(self):
        """Module 1 SE Ethics: Purge all GPS coordinates from volatile RAM post-match."""
        for p in self.players.values():
            p.last_point = None
            p.freeze_point = None
        self.log("ETHICAL PURGE: All player GPS coordinates wiped from RAM.")

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
            "logs": self.event_log,
        }