# GeoSquid

Real-time GPS-based *Red Light, Green Light* web game built with Flask-SocketIO, React, and Leaflet.

## Features
- **Host Console (`/host`):** Create room codes, calibrate the finish line and geofence polygon, toggle `GREEN` / `RED` signals, monitor live player avatars and trails, and purge volatile RAM data.
- **Player Client (`/player`):** Join with a room code, customize avatar theme/seed and aura color, view the destination radar mini-map, and receive audio and haptic cues.

## Local Setup

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
