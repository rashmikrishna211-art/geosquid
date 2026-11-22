# GeoSquid

Real-time GPS-based *Red Light, Green Light* mobile-web game built with **Flask-SocketIO**, **React**, **Leaflet**, and the **Web Audio API**.

## Architecture & Routes
- **Landing Page (`/`)**: Entry screen to launch the Host Console or join as a Player.
- **Host Console (`/host`)**: Generates `SQ-XXXX` room codes, calibrates the finish line and geofence polygon, toggles `GREEN` / `RED` signals, tracks live player avatars and movement trails, and purges volatile GPS data from RAM.
- **Player Client (`/player`)**: Join with a room code, customize avatar theme/seed and aura color, view the destination radar mini-map, and receive Web Audio + haptic feedback.

## Local Setup

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
