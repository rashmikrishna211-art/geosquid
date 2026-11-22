from game_engine import GeoPoint, MotionValidator, GeofenceBoundary, GameSession


def test_stationary_gps_jitter_ignored():
    validator = MotionValidator(speed_threshold_mps=0.8, min_distance_m=1.5)
    p1 = GeoPoint(lat=12.971600, lon=77.594600, timestamp=1000.0, accuracy=5.0)
    p2 = GeoPoint(lat=12.971608, lon=77.594600, timestamp=1001.0, accuracy=5.0)
    violated, _, reason = validator.evaluate_movement(p1, p2, "RED")
    assert violated is False
    assert reason == "GPS_JITTER_FILTERED"


def test_red_light_running_triggers_elimination():
    validator = MotionValidator(speed_threshold_mps=0.8, min_distance_m=1.5)
    p1 = GeoPoint(lat=12.971600, lon=77.594600, timestamp=1000.0, accuracy=4.0)
    p2 = GeoPoint(lat=12.971640, lon=77.594600, timestamp=1001.0, accuracy=4.0)
    violated, speed, reason = validator.evaluate_movement(p1, p2, "RED")
    assert violated is True
    assert speed > 4.0
    assert reason == "RED_LIGHT_MOVEMENT_VIOLATION"


def test_green_light_movement_allowed():
    validator = MotionValidator()
    p1 = GeoPoint(lat=12.971600, lon=77.594600, timestamp=1000.0, accuracy=4.0)
    p2 = GeoPoint(lat=12.971680, lon=77.594600, timestamp=1001.0, accuracy=4.0)
    violated, _, _ = validator.evaluate_movement(p1, p2, "GREEN")
    assert violated is False


def test_geofence_ray_casting():
    square = [
        (12.9710, 77.5940),
        (12.9720, 77.5940),
        (12.9720, 77.5950),
        (12.9710, 77.5950),
    ]
    fence = GeofenceBoundary(square)
    assert fence.is_inside(12.9715, 77.5945) is True
    assert fence.is_inside(12.9730, 77.5945) is False


def test_finish_line_win_and_auto_end():
    session = GameSession("SQ-1001")
    session.finish_line = GeoPoint(lat=12.972000, lon=77.594600, timestamp=0.0)
    session.add_player("sid_1", "Rashmi")
    session.set_light_state("GREEN")

    event = session.process_gps_ping(
        "sid_1", GeoPoint(lat=12.972010, lon=77.594600, timestamp=10.0, accuracy=4.0)
    )
    assert event["event"] == "winner"
    assert session.players["sid_1"].status == "WINNER"
    assert session.light_state == "ENDED"


def test_ethical_gps_purge():
    session = GameSession("SQ-1002")
    session.add_player("sid_1", "Player1")
    session.process_gps_ping(
        "sid_1", GeoPoint(lat=12.9716, lon=77.5946, timestamp=10.0)
    )
    assert session.players["sid_1"].last_point is not None
    session.purge_sensitive_data()
    assert session.players["sid_1"].last_point is None