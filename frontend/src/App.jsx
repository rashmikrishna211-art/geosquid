import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Radar, Smartphone, ShieldCheck } from 'lucide-react';
import HostDashboard from './pages/HostDashboard';
import PlayerClient from './pages/PlayerClient';
import { GlowEffect } from './components/motion-primitives/GlowEffect';
import { TextScramble } from './components/motion-primitives/TextScramble';

function resolveView() {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/host')) return 'HOST';
  if (path.startsWith('/player')) return 'PLAYER';
  return 'HOME';
}

export default function App() {
  const [view, setView] = useState(resolveView);

  useEffect(() => {
    const onPopState = () => setView(resolveView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (target, path) => {
    window.history.pushState({}, '', path);
    setView(target);
  };

  if (view === 'HOST') return <HostDashboard />;
  if (view === 'PLAYER') return <PlayerClient />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-zinc-100">
      <div className="relative w-full max-w-md">
        <GlowEffect colors={['#ff0055', '#00e5ff']} />
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-7 text-center shadow-2xl">
          <div className="text-2xl tracking-[0.35em] text-[#ff0055]">○ △ □</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            <TextScramble triggerKey="title">GEOSQUID</TextScramble>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Real-Time GPS Red Light, Green Light Arena
          </p>

          <div className="mt-7 flex flex-col gap-3.5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('HOST', '/host')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-cyan-400 py-3.5 text-sm font-extrabold tracking-widest text-zinc-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-300"
            >
              <Radar className="h-4 w-4" /> HOST ARENA
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('PLAYER', '/player')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#ff0055] py-3.5 text-sm font-extrabold tracking-widest text-white shadow-lg shadow-pink-600/30 hover:bg-pink-500"
            >
              <Smartphone className="h-4 w-4" /> JOIN AS PLAYER
            </motion.button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Ephemeral RAM-Only GPS Telemetry
          </div>
        </div>
      </div>
    </div>
  );
}