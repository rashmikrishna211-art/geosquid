import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Flag, Hexagon, Trash2, Copy, Check } from 'lucide-react';
import { TextScramble } from '../components/motion-primitives/TextScramble';
import { BorderTrail } from '../components/motion-primitives/BorderTrail';
import { SlidingNumber } from '../components/motion-primitives/SlidingNumber';
import { GlowEffect } from '../components/motion-primitives/GlowEffect';

export default function HostDashboard() {
  const [gameState, setGameState] = useState({
    room_code: '----',
    light_state: 'LOBBY',
    finish_line: null,
    geofence: [],
    players: [],
    logs: [],
  });
  const [mapMode, setMapMode] = useState(null);
  const [draftFence, setDraftFence] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef(null);
  const roomCodeRef = useRef(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const layersRef = useRef({
    markers: {},
    finishMarker: null,
    finishCircle: null,
    fencePolygon: null,
  });
  const mapModeRef = useRef(mapMode);
  const draftFenceRef = useRef(draftFence);

  mapModeRef.current = mapMode;
  draftFenceRef.current = draftFence;

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([12.9716, 77.5946], 18);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 21,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (e) => {
      const mode = mapModeRef.current;
      if (mode === 'FINISH') {
        socketRef.current?.emit('set_finish_line', { lat: e.latlng.lat, lon: e.latlng.lng });
        setMapMode(null);
      } else if (mode === 'FENCE') {
        const updated = [...draftFenceRef.current, [e.latlng.lat, e.latlng.lng]];
        setDraftFence(updated);
        if (layersRef.current.fencePolygon) map.removeLayer(layersRef.current.fencePolygon);
        layersRef.current.fencePolygon = L.polygon(updated, {
          color: '#00e5ff',
          weight: 2,
          fillOpacity: 0.14,
        }).addTo(map);
      }
    });

    mapRef.current = map;
  }, []);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      if (!roomCodeRef.current) {
        socket.emit('create_room');
      } else {
        socket.emit('rejoin_room_host', { room_code: roomCodeRef.current });
      }
    });

    socket.on('room_created', (data) => {
      roomCodeRef.current = data.room_code;
      setGameState(data);
    });

    socket.on('room_expired', () => {
      roomCodeRef.current = null;
      socket.emit('create_room');
    });

    socket.on('state_update', (data) => setGameState(data));

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gameState.finish_line) {
      const ll = [gameState.finish_line.lat, gameState.finish_line.lon];
      if (!layersRef.current.finishMarker) {
        layersRef.current.finishMarker = L.circleMarker(ll, {
          radius: 6,
          color: '#ffb300',
          fillColor: '#ffb300',
          fillOpacity: 1,
        }).addTo(map);
        layersRef.current.finishCircle = L.circle(ll, {
          radius: 5,
          color: '#ffb300',
          weight: 2,
          fillOpacity: 0.2,
        }).addTo(map);
      } else {
        layersRef.current.finishMarker.setLatLng(ll);
        layersRef.current.finishCircle.setLatLng(ll);
      }
    }

    if (gameState.geofence?.length >= 3 && mapMode !== 'FENCE') {
      if (layersRef.current.fencePolygon) map.removeLayer(layersRef.current.fencePolygon);
      layersRef.current.fencePolygon = L.polygon(gameState.geofence, {
        color: '#00e5ff',
        weight: 2,
        dashArray: '6,6',
        fillOpacity: 0.08,
      }).addTo(map);
    }

    const activeIds = new Set();
    gameState.players.forEach((p) => {
      activeIds.add(p.player_id);
      if (p.lat !== null && p.lon !== null) {
        const hex = p.status === 'ACTIVE' ? '#00e676' : p.status === 'WINNER' ? '#ffb300' : '#ff1744';
        const pulseHtml =
          p.status === 'ACTIVE'
            ? `<span class="gps-pulse-ring absolute -inset-1.5 rounded-full border-2" style="border-color:${hex}"></span>`
            : '';

        const icon = L.divIcon({
          className: 'smooth-gps',
          html: `<div class="relative h-4 w-4 rounded-full border-2 border-zinc-950" style="background:${hex}">${pulseHtml}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        if (!layersRef.current.markers[p.player_id]) {
          layersRef.current.markers[p.player_id] = L.marker([p.lat, p.lon], { icon })
            .addTo(map)
            .bindTooltip(p.name, { permanent: true, direction: 'top', offset: [0, -8] });
        } else {
          layersRef.current.markers[p.player_id].setLatLng([p.lat, p.lon]);
          layersRef.current.markers[p.player_id].setIcon(icon);
        }
      }
    });

    Object.keys(layersRef.current.markers).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(layersRef.current.markers[id]);
        delete layersRef.current.markers[id];
      }
    });
  }, [gameState, mapMode]);

  const toggleGeofence = () => {
    if (mapMode !== 'FENCE') {
      setDraftFence([]);
      setMapMode('FENCE');
    } else {
      setMapMode(null);
      if (draftFence.length >= 3) {
        socketRef.current?.emit('set_geofence', { vertices: draftFence });
      }
    }
  };

  const centerOnHostGPS = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 19);
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard?.writeText(gameState.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const aliveCount = gameState.players.filter((p) => p.status === 'ACTIVE').length;
  const outCount = gameState.players.filter((p) => p.status === 'ELIMINATED').length;
  const winCount = gameState.players.filter((p) => p.status === 'WINNER').length;

  const trailColor =
    gameState.light_state === 'GREEN'
      ? '#00e676'
      : gameState.light_state === 'RED'
      ? '#ff1744'
      : '#00e5ff';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="flex w-[400px] flex-col gap-3 overflow-y-auto border-r border-zinc-800 bg-zinc-900/90 p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
            <span className="tracking-widest text-[#ff0055]">○△□</span>
            <span>GEOSQUID</span>
          </div>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-['JetBrains_Mono'] text-xs text-zinc-400">
            HOST HUD
          </span>
        </div>

        <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
          <BorderTrail color={trailColor} size={90} duration={3.5} />
          <div className="text-[11px] uppercase tracking-widest text-zinc-400">Arena Room Code</div>
          <div className="mt-1 flex items-center justify-between">
            <div className="font-['JetBrains_Mono'] text-3xl font-bold tracking-widest text-cyan-400">
              <TextScramble triggerKey={gameState.room_code}>{gameState.room_code}</TextScramble>
            </div>
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-['JetBrains_Mono'] text-xs hover:border-cyan-400"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>

          <div
            className={`mt-3 rounded-lg border py-2 text-center font-['JetBrains_Mono'] text-sm font-bold tracking-widest ${
              gameState.light_state === 'GREEN'
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                : gameState.light_state === 'RED'
                ? 'border-rose-500/60 bg-rose-500/20 text-rose-400'
                : 'border-zinc-700 bg-zinc-900 text-zinc-300'
            }`}
          >
            <TextScramble triggerKey={gameState.light_state}>
              {`SIGNAL // ${gameState.light_state}`}
            </TextScramble>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-400">1. Spatial Calibration</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={centerOnHostGPS}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-xs font-bold hover:border-cyan-400"
            >
              <Crosshair className="h-3.5 w-3.5 text-cyan-400" /> Locate Me
            </button>
            <button
              onClick={() => setMapMode(mapMode === 'FINISH' ? null : 'FINISH')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold ${
                mapMode === 'FINISH'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-zinc-700 bg-zinc-900 hover:border-amber-400'
              }`}
            >
              <Flag className="h-3.5 w-3.5 text-amber-400" /> Finish Line
            </button>
          </div>
          <button
            onClick={toggleGeofence}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold ${
              mapMode === 'FENCE'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                : 'border-zinc-700 bg-zinc-900 hover:border-cyan-400'
            }`}
          >
            <Hexagon className="h-3.5 w-3.5 text-cyan-400" />
            {mapMode === 'FENCE' ? `Save Polygon (${draftFence.length} pts)` : 'Draw Geofence Boundary'}
          </button>
        </div>

        <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-400">2. Signal Control</div>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => socketRef.current?.emit('set_light', { light_state: 'GREEN' })}
              className="rounded-lg bg-emerald-500 py-2.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
            >
              ○ GREEN LIGHT
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => socketRef.current?.emit('set_light', { light_state: 'RED' })}
              className="rounded-lg bg-rose-600 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-rose-600/25 hover:bg-rose-500"
            >
              △ RED LIGHT
            </motion.button>
          </div>
          <button
            onClick={() => {
              if (confirm('End match and purge all volatile GPS coordinates from RAM?')) {
                socketRef.current?.emit('purge_data');
              }
            }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-pink-500/40 bg-pink-600/15 py-2 text-xs font-bold text-pink-400 hover:bg-pink-600/25"
          >
            <Trash2 className="h-3.5 w-3.5" /> END &amp; PURGE GPS RAM
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-400">
              ALIVE: <SlidingNumber value={aliveCount} padStart />
            </span>
            <span className="text-rose-400">
              OUT: <SlidingNumber value={outCount} padStart />
            </span>
            <span className="text-amber-400">
              WON: <SlidingNumber value={winCount} padStart />
            </span>
          </div>

          <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            <AnimatePresence initial={false}>
              {gameState.players.map((p) => (
                <motion.div
                  layout
                  key={p.player_id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  onClick={() => setSelectedPlayer(p)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800/90 bg-zinc-900 px-2.5 py-1.5 text-xs hover:border-zinc-600"
                >
                  <span className="font-bold">
                    {p.status === 'ACTIVE' ? '○' : p.status === 'WINNER' ? '□' : '△'} {p.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-['JetBrains_Mono'] text-[10px] font-bold ${
                      p.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : p.status === 'WINNER'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-widest text-zinc-400">4. Audit Stream</div>
          <div className="max-h-28 overflow-y-auto font-['JetBrains_Mono'] text-[11px] leading-relaxed text-zinc-400">
            {gameState.logs.map((entry, idx) => (
              <div key={idx}>{entry}</div>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex-1">
        <AnimatePresence>
          {mapMode && (
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full border border-cyan-400 bg-zinc-950/90 px-4 py-1.5 font-['JetBrains_Mono'] text-xs font-bold text-cyan-300 shadow-xl"
            >
              {mapMode === 'FINISH'
                ? 'CLICK MAP TO SET FINISH LINE (5m RADIUS)'
                : 'CLICK 3+ CORNERS ON MAP, THEN CLICK SAVE POLYGON'}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedPlayer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="absolute bottom-6 left-6 z-[1000] w-72 rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur"
            >
              <GlowEffect colors={['#ff0055', '#00e5ff']} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{selectedPlayer.name}</span>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="font-['JetBrains_Mono'] text-xs text-zinc-400 hover:text-white"
                  >
                    [CLOSE]
                  </button>
                </div>
                <div className="mt-2 space-y-1 font-['JetBrains_Mono'] text-xs text-zinc-300">
                  <div>STATUS: {selectedPlayer.status}</div>
                  <div>SPEED: {selectedPlayer.speed_mps ?? 0} m/s</div>
                  <div>GPS ACC: ±{Math.round(selectedPlayer.accuracy ?? 0)}m</div>
                  {selectedPlayer.elimination_reason && (
                    <div className="text-rose-400">REASON: {selectedPlayer.elimination_reason}</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={mapContainerRef} className="h-full w-full" />
      </main>
    </div>
  );
}