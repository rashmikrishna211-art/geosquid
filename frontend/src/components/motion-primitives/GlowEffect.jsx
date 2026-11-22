import { motion } from 'motion/react';

export function GlowEffect({ colors = ['#ff0055', '#00e5ff'], className = '' }) {
  return (
    <motion.div
      className={`pointer-events-none absolute -inset-0.5 rounded-xl opacity-35 blur-md ${className}`}
      style={{
        background: `linear-gradient(120deg, ${colors.join(', ')})`,
        backgroundSize: '200% 200%',
      }}
      animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    />
  );
}