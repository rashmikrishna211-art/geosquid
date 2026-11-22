import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { motion } from 'motion/react';
import { GlowEffect } from '../components/motion-primitives/GlowEffect';
import { TextScramble } from '../components/motion-primitives/TextScramble';

export const AVATAR_OPTIONS = [
  { id: 'doll', icon: '👧', label: 'Young-hee' },
  { id: 'p456', icon: '🟢', label: 'No. 456' },
  { id: 'runner', icon: '🏃', label: 'Sprinter' },
  { id: 'squid', icon: '🦑', label: 'Squid' },
  { id: 'circle', icon: '○', label: 'Guard ○' },
  { id: 'triangle', icon: '△', label: 'Guard △' },
  { id: 'square', icon: '□', label: 'Guard □' },
  { id: 'vip', icon: '🎭', label: 'Front Man' },
];

export const AVATAR_COLORS = [
  { id: '#00e676', label: 'Emerald' },
  { id: '#00e5ff', label: 'Cyan' },
  { id: '#ff0055', label: 'Pink' },
  { id: '#ffb300', label: 'Gold' },
  { id: '#a855f7', label: 'Violet' },
];

function getDistanceAndBearing(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const cardinal = dirs[Math.round(bearing / 45) % 8];

  return { distance, bearing, cardinal };
}

export default function PlayerClient() {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('p456');
  const [avatarColor, setAvatarColor] = useState('#00e676');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  const [joined, setJoined] = useState(false);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [lightState, setLightState] = useState('LOBBY');
  const [status, setStatus] = useState('ACTIVE');
  const [reason, setReason] = useState('');
  const [telemetry, setTelemetry] = useState({ acc: null, speed: 0, lat: null, lon: null });
  const [finishLine, setFinishLine] = useState(null);
  const [geofence, setGeofence] = useState([]);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const miniMapContainerRef = useRef(null);
  const miniMapRef = useRef(null);
  const miniLayersRef = useRef({
    playerMarker: null,
    finishMarker: null,
    finishCircle: null,
    guideLine: null,
    fencePolygon: null,
  });

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('joined_success', (data) => {
      setPlayerInfo(data.player);
      setLightState(data.light_state);
      setJoined(true);
      setError('');
      startGpsStream(socket);
    });

    socket.on('join_error', (data) => setError(data.message));

    socket.on('light_changed', (data) => {
      setLightState(data.light_state);
      navigator.vibrate?.(data.light_state === 'RED' ? [250, 80, 250] : 100);
    });

    socket.on('player_alert', (alert) => {
      if (alert.event === 'eliminated') {
        setStatus('ELIMINATED');
        setReason(alert.reason || 'MOTION_DETECTED');
        navigator.vibrate?.([500, 150, 500]);
      } else if (alert.event === 'winner') {
        setStatus('WINNER');
        navigator.vibrate?.([150, 80, 150, 80, 300]);
      }
    });

    socket.on('state_update', (snapshot) => {
      setLightState(snapshot.light_state);
      setFinishLine(snapshot.finish_line || null);
      setGeofence(snapshot.geofence || []);
      const me = snapshot.players.find((p) => p.player_id === socket.id);
      if (me) {
        setStatus(me.status);
        setReason(me.elimination_reason || '');
        setTelemetry((prev) => ({ ...prev, speed: me.speed_mps ?? 0 }));
      }
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      socket.disconnect();
    };
  }, []);

  const chosenAvatar = AVATAR_OPTIONS.find((a) => a.id === avatar) || AVATAR_OPTIONS[0];

  useEffect(() => {
    if (!joined || !miniMapContainerRef.current || miniMapRef.current) return;
    const map = L.map(miniMapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([12.9716, 77.5946], 19);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 21,
    }).addTo(map);

    miniMapRef.current = map;
    const resizeTimer = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      miniMapRef.current = null;
      miniLayersRef.current = {
        playerMarker: null,
        finishMarker: null,
        finishCircle: null,
        guideLine: null,
        fencePolygon: null,
      };
    };
  }, [joined]);

  useEffect(() => {
    const map = miniMapRef.current;
    if (!map) return;

    if (geofence.length >= 3) {
      if (miniLayersRef.current.fencePolygon) map.removeLayer(miniLayersRef.current.fencePolygon);
      miniLayersRef.current.fencePolygon = L.polygon(geofence, {
        color: '#00e5ff',
        weight: 2,
        dashArray: '5,5',
        fillOpacity: 0.08,
      }).addTo(map);
    }

    if (finishLine) {
      const fll = [finishLine.lat, finishLine.lon];
      if (!miniLayersRef.current.finishMarker) {
        const flagIcon = L.divIcon({
          className: '',
          html: `<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-amber-300 bg-zinc-950 text-sm shadow-lg">🏁</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        miniLayersRef.current.finishMarker = L.marker(fll, { icon: flagIcon })
          .addTo(map)
          .bindTooltip('FINISH', { permanent: true, direction: 'top', offset: [0, -14] });
        miniLayersRef.current.finishCircle = L.circle(fll, {
          radius: 5,
          color: '#ffb300',
          weight: 2,
          fillOpacity: 0.25,
        }).addTo(map);
      } else {
        miniLayersRef.current.finishMarker.setLatLng(fll);
        miniLayersRef.current.finishCircle.setLatLng(fll);
      }
    }

    if (telemetry.lat !== null && telemetry.lon !== null) {
      const pll = [telemetry.lat, telemetry.lon];
      if (!miniLayersRef.current.playerMarker) {
        const pIcon = L.divIcon({
          className: 'smooth-gps',
          html: `<div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-zinc-950 text-base shadow-lg" style="border-color:${avatarColor}"><span class="gps-pulse-ring absolute -inset-1 rounded-full border" style="border-color:${avatarColor}"></span><span>${chosenAvatar.icon}</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        miniLayersRef.current.playerMarker = L.marker(pll, { icon: pIcon }).addTo(map);
      } else {
        miniLayersRef.current.playerMarker.setLatLng(pll);
      }

      if (finishLine) {
        const fll = [finishLine.lat, finishLine.lon];
        if (!miniLayersRef.current.guideLine) {
          miniLayersRef.current.guideLine = L.polyline([pll, fll], {
            color: '#ffb300',
            weight: 2.5,
            dashArray: '6, 6',
          }).addTo(map);
        } else {
          miniLayersRef.current.guideLine.setLatLngs([pll, fll]);
        }
        map.fitBounds(L.latLngBounds([pll, fll]), { padding: [36, 36], maxZoom: 20 });
      } else {
        map.setView(pll, 19);
      }
    } else if (finishLine) {
      map.setView([finishLine.lat, finishLine.lon], 19);
    }
  }, [telemetry.lat, telemetry.lon, finishLine, geofence, avatarColor, chosenAvatar.icon]);

  const startGpsStream = (socket) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setTelemetry((prev) => ({
          ...prev,
          acc: Math.round(accuracy),
          lat: latitude,
          lon: longitude,
        }));
        socket.emit('gps_ping', {
          lat: latitude,
          lon: longitude,
          accuracy,
        });
      },
      (err) => setError(`GPS Error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !name.trim()) {
      setError('Enter both Room Code and Callsign.');
      return;
    }
    if (!consent) {
      setError('Accept Ethical GPS Consent to enter the arena.');
      return;
    }
    socketRef.current?.emit('join_room_player', {
      room_code: roomCode.trim().toUpperCase(),
      name: name.trim(),
      avatar: `${avatar}:${avatarColor}`,
    });
  };

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-zinc-100">
        <div className="relative w-full max-w-md">
          <GlowEffect colors={['#ff0055', '#00e5ff']} />
          <form
            onSubmit={handleJoin}
            className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="text-lg tracking-[0.3em] text-[#ff0055]">○ △ □</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
              GEOSQUID PLAYER
            </h1>
            <p className="text-xs text-zinc-400">BCS501 Real-Time GPS Telemetry Node</p>

            <div className="mt-4">
              <label className="block font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-zinc-400">
                Room Code
              </label>
              <input
                type="text"
                placeholder="SQ-0000"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-['JetBrains_Mono'] text-base uppercase tracking-widest text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <label className="block font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-zinc-400">
                Callsign
              </label>
              <input
                type="text"
                maxLength={20}
                placeholder="Enter your nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <label className="block font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-zinc-400">
                Customize Avatar &amp; Ring Color
              </label>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setAvatar(item.id)}
                    style={avatar === item.id ? { borderColor: avatarColor } : undefined}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2 text-xs transition ${
                      avatar === item.id
                        ? 'bg-zinc-800 text-white shadow-md'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span className="mt-1 text-[10px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="font-['JetBrains_Mono'] text-[10px] uppercase text-zinc-400">
                  Badge Aura
                </span>
                <div className="flex items-center gap-2.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      aria-label={c.label}
                      onClick={() => setAvatarColor(c.id)}
                      style={{ backgroundColor: c.id }}
                      className={`h-5 w-5 rounded-full transition-transform ${
                        avatarColor === c.id ? 'scale-125 ring-2 ring-white' : 'opacity-65 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#ff0055]"
              />
              <span>
                <strong className="text-white">Ethical GPS Consent:</strong> Location data is held
                strictly in volatile server RAM during gameplay and purged automatically post-match.
              </span>
            </label>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="mt-4 w-full rounded-xl bg-[#ff0055] py-3 text-sm font-extrabold tracking-widest text-white shadow-lg shadow-pink-600/30 hover:bg-pink-500"
            >
              ENTER ARENA
            </motion.button>

            {error && (
              <p className="mt-3 text-center font-['JetBrains_Mono'] text-xs text-rose-400">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

  const navInfo =
    finishLine && telemetry.lat !== null && telemetry.lon !== null
      ? getDistanceAndBearing(telemetry.lat, telemetry.lon, finishLine.lat, finishLine.lon)
      : null;

  const bgTheme =
    status === 'ELIMINATED'
      ? 'bg-rose-950 text-rose-100'
      : status === 'WINNER'
      ? 'bg-amber-950 text-amber-100'
      : lightState === 'GREEN'
      ? 'bg-emerald-950 text-emerald-100'
      : lightState === 'RED'
      ? 'bg-rose-950 text-rose-100'
      : 'bg-zinc-950 text-zinc-100';

  const headline =
    status === 'ELIMINATED'
      ? 'ELIMINATED'
      : status === 'WINNER'
      ? 'ESCAPED!'
      : lightState === 'GREEN'
      ? 'RUN!'
      : lightState === 'RED'
      ? 'FREEZE!'
      : 'STANDBY';

  return (
    <div className={`flex min-h-screen flex-col justify-between p-5 transition-colors duration-300 ${bgTheme}`}>
      <div className="flex items-center justify-between border-b border-white/15 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            style={{ borderColor: avatarColor }}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black/45 text-xl"
          >
            {chosenAvatar.icon}
          </span>
          <div>
            <div className="text-sm font-extrabold">
              #{playerInfo?.contestant_no} {playerInfo?.name}
            </div>
            <div className="font-['JetBrains_Mono'] text-[11px] opacity-75">
              ROOM {roomCode}
            </div>
          </div>
        </div>
        <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 font-['JetBrains_Mono'] text-xs font-bold">
          {status}
        </span>
      </div>

      <div className="my-3 text-center">
        <div
          style={{ borderColor: avatarColor }}
          className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 bg-black/35 text-3xl shadow-xl"
        >
          <span className={status === 'ACTIVE' && telemetry.speed > 0.4 ? 'runner-bob inline-block' : ''}>
            {chosenAvatar.icon}
          </span>
        </div>
        <h2 className="text-4xl font-black tracking-tight">
          <TextScramble triggerKey={headline}>{headline}</TextScramble>
        </h2>
        <p className="mt-1 font-['JetBrains_Mono'] text-[11px] uppercase tracking-widest opacity-85">
          {status === 'ELIMINATED'
            ? `REASON: ${reason}`
            : status === 'WINNER'
            ? 'FINISH LINE CROSSED'
            : lightState === 'GREEN'
            ? 'SPRINT TOWARD THE GOLD FLAG'
            : lightState === 'RED'
            ? 'DO NOT MOVE A MUSCLE'
            : 'WAITING FOR HOST SIGNAL'}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-3 py-1.5 font-['JetBrains_Mono'] text-[11px]">
          <span className="font-bold text-amber-300">🏁 DESTINATION RADAR</span>
          {navInfo ? (
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span>{navInfo.distance.toFixed(1)} m</span>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-300">
                {navInfo.cardinal}
              </span>
              <span
                className="inline-block text-amber-300"
                style={{ transform: `rotate(${navInfo.bearing}deg)` }}
              >
                ↑
              </span>
            </span>
          ) : (
            <span className="text-zinc-400">
              {finishLine ? 'LOCKING GPS...' : 'HOST SETTING FINISH...'}
            </span>
          )}
        </div>
        <div ref={miniMapContainerRef} className="h-48 w-full" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-black/35 p-3 font-['JetBrains_Mono'] text-xs">
        <div>
          <div className="text-[10px] opacity-60">LIVE SPEED</div>
          <div className="mt-0.5 text-sm font-bold">{telemetry.speed.toFixed(2)} m/s</div>
        </div>
        <div>
          <div className="text-[10px] opacity-60">GPS ACCURACY</div>
          <div className="mt-0.5 text-sm font-bold">
            {telemetry.acc !== null ? `±${telemetry.acc} m` : 'LOCKING...'}
          </div>
        </div>
      </div>
    </div>
  );
}