import { motion } from 'motion/react';

export function BorderTrail({ className = '', size = 80, duration = 4, color = '#ff0055' }) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={`absolute aspect-square ${className}`}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration, ease: 'linear' }}
      />
    </div>
  );
}