import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'motion/react';
import { Radio, ShieldCheck } from 'lucide-react';
import { TextScramble } from '../components/motion-primitives/TextScramble';
import { BorderTrail } from '../components/motion-primitives/BorderTrail';
import { GlowEffect } from '../components/motion-primitives/GlowEffect';

export default function PlayerClient() {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [lightState, setLightState] = useState('LOBBY');
  const [terminalAlert, setTerminalAlert] = useState(null);
  const [gpsReadout, setGpsReadout] = useState('LOCKING SATELLITES...');

  const socketRef = useRef(null);
  const terminalRef = useRef(false);

  const playTone = (freq, ms) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), ms);
    } catch (_) {}
  };

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('join_error', (d) => setError(d.message));

    socket.on('joined_success', (d) => {
      setJoined(true);
      setLightState(d.light_state);
      try {
        navigator.wakeLock?.request('screen');
      } catch (_) {}
    });

    socket.on('light_changed', (d) => {
      if (terminalRef.current) return;
      setLightState(d.light_state);
      if (d.light_state === 'GREEN') playTone(660, 200);
      if (d.light_state === 'RED') {
        navigator.vibrate?.(300);
        playTone(280, 350);
      }
    });

    socket.on('player_alert', (alert) => {
      terminalRef.current = true;
      setTerminalAlert(alert);
      if (alert.event === 'eliminated') {
        navigator.vibrate?.([400, 150, 400]);
        playTone(200, 600);
      } else if (alert.event === 'winner') {
        playTone(880, 450);
      }
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!joined) return;
    if (!navigator.geolocation) {
      setGpsReadout('GEOLOCATION UNSUPPORTED');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsReadout(`${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`);
        socketRef.current?.emit('gps_ping', { lat: latitude, lon: longitude, accuracy });
      },
      (err) => setGpsReadout(`GPS ERR: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [joined]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !name.trim()) {
      setError('Room Code and Callsign are required.');
      return;
    }
    if (!consent) {
      setError('Please accept the ethical GPS privacy notice.');
      return;
    }
    setError('');
    socketRef.current?.emit('join_room_player', {
      room_code: roomCode.trim().toUpperCase(),
      name: name.trim(),
    });
  };

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-5">
        <div className="relative w-full max-w-md">
          <GlowEffect colors={['#ff0055', '#00e5ff']} />
          <form
            onSubmit={handleJoin}
            className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="text-xl tracking-[0.35em] text-[#ff0055]">○ △ □</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">GEOSQUID PLAYER</h1>
            <p className="mb-5 text-xs text-zinc-400">BCS501 Real-Time GPS Telemetry Node</p>

            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-400">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="SQ-0000"
              className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3.5 font-['JetBrains_Mono'] text-base uppercase text-white focus:border-[#ff0055] focus:outline-none"
            />

            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-400">Callsign</label>
            <input
              type="text"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your nickname"
              className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3.5 font-['JetBrains_Mono'] text-base text-white focus:border-[#ff0055] focus:outline-none"
            />

            <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#ff0055]"
              />
              <span>
                <strong>Ethical GPS Consent:</strong> Location data is held strictly in volatile server RAM during gameplay and purged automatically post-match.
              </span>
            </label>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="w-full rounded-xl bg-[#ff0055] py-3.5 text-sm font-extrabold tracking-widest text-white shadow-lg shadow-pink-600/30"
            >
              ENTER ARENA
            </motion.button>

            {error && <p className="mt-3 text-center text-xs font-semibold text-rose-400">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const effectiveState = terminalAlert
    ? terminalAlert.event === 'eliminated'
      ? 'ELIMINATED'
      : 'WINNER'
    : lightState;

  const screenThemes = {
    LOBBY: 'bg-zinc-950 text-zinc-100',
    GREEN: 'bg-[#00c853] text-zinc-950',
    RED: 'bg-[#ff1744] text-white',
    ELIMINATED: 'bg-zinc-950 text-[#ff1744]',
    WINNER: 'bg-amber-400 text-zinc-950',
    ENDED: 'bg-zinc-900 text-zinc-200',
  };

  const stateCopy = {
    LOBBY: { shape: '○', title: 'LOBBY', sub: 'Awaiting Host Start Signal...' },
    GREEN: { shape: '○', title: 'GREEN LIGHT', sub: 'SPRINT TOWARD FINISH LINE' },
    RED: { shape: '△', title: 'RED LIGHT', sub: 'FREEZE COMPLETELY' },
    ELIMINATED: {
      shape: '✕',
      title: 'ELIMINATED',
      sub: terminalAlert?.player?.elimination_reason || 'MOTION DETECTED',
    },
    WINNER: {
      shape: '□',
      title: 'SURVIVED',
      sub: `Cleared in ${terminalAlert?.player?.finish_time_s ?? 0}s`,
    },
    ENDED: { shape: '□', title: 'MATCH ENDED', sub: 'GPS coordinates purged from RAM' },
  };

  const current = stateCopy[effectiveState] || stateCopy.LOBBY;

  return (
    <motion.div
      key={effectiveState}
      animate={
        effectiveState === 'RED' || effectiveState === 'ELIMINATED'
          ? { x: [0, -10, 10, -6, 6, 0], scale: [1.03, 1] }
          : { scale: [0.98, 1] }
      }
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`flex min-h-screen flex-col items-center justify-center p-6 text-center transition-colors duration-200 ${
        screenThemes[effectiveState]
      }`}
    >
      <div className="text-7xl font-black leading-none">{current.shape}</div>

      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
        <TextScramble triggerKey={effectiveState} duration={0.35}>
          {current.title}
        </TextScramble>
      </h1>

      <p className="mt-2 text-base font-bold tracking-wide opacity-90">{current.sub}</p>

      <div className="relative mt-10 flex items-center gap-2 rounded-full border border-white/20 bg-zinc-950/80 px-4 py-2.5 font-['JetBrains_Mono'] text-xs text-zinc-100 backdrop-blur">
        <BorderTrail color="#00e5ff" size={45} duration={2.5} />
        <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
        <span>{gpsReadout}</span>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] opacity-75">
        <ShieldCheck className="h-3.5 w-3.5" /> Ephemeral RAM-Only Telemetry Active
      </div>
    </motion.div>
  );
}