import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Radar, Smartphone, ShieldCheck } from 'lucide-react';
import HostDashboard from './pages/HostDashboard';
import PlayerClient from './pages/PlayerClient';
import Squares from './components/react_bits/Squares';
import BlurText from './components/react_bits/BlurText';
import Magnet from './components/react_bits/Magnet';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-5 text-zinc-100">
      <div className="pointer-events-auto absolute inset-0">
        <Squares
          direction="diagonal"
          speed={0.35}
          squareSize={48}
          borderColor="rgba(255, 255, 255, 0.05)"
          hoverFillColor="rgba(255, 0, 85, 0.14)"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800/90 bg-zinc-900/80 p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 px-3.5 py-1 font-['JetBrains_Mono'] text-[11px] tracking-widest text-zinc-400">
          <span className="text-[#ff0055]">○</span>
          <span className="text-cyan-400">△</span>
          <span className="text-amber-400">□</span>
          <span>RED LIGHT · GREEN LIGHT</span>
        </div>

        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
          <BlurText text="GEOSQUID" delay={55} />
        </h1>

        <p className="mt-2 text-xs text-zinc-400">
          <BlurText
            text="Real-time GPS arena for outdoor freeze-and-sprint matches"
            delay={22}
            by="words"
          />
        </p>

        <div className="mt-7 flex flex-col gap-3.5">
          <Magnet className="w-full">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('HOST', '/host')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-cyan-400 py-3.5 text-sm font-extrabold tracking-widest text-zinc-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
            >
              <Radar className="h-4 w-4" /> HOST ARENA
            </motion.button>
          </Magnet>

          <Magnet className="w-full">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('PLAYER', '/player')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#ff0055] py-3.5 text-sm font-extrabold tracking-widest text-white shadow-lg shadow-pink-600/30 transition hover:bg-pink-500"
            >
              <Smartphone className="h-4 w-4" /> JOIN AS PLAYER
            </motion.button>
          </Magnet>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 font-['JetBrains_Mono'] text-[11px] text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Volatile RAM Telemetry · Auto-Purged Post-Match</span>
        </div>
      </motion.div>
    </div>
  );
}