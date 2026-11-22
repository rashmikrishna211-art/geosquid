import { useRef, useState } from 'react';
import { motion } from 'motion/react';

export default function Magnet({
  children,
  padding = 48,
  magnetStrength = 3.2,
  className = '',
}) {
  const wrapRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    if (
      Math.abs(dx) < rect.width / 2 + padding &&
      Math.abs(dy) < rect.height / 2 + padding
    ) {
      setOffset({ x: dx / magnetStrength, y: dy / magnetStrength });
    } else if (offset.x !== 0 || offset.y !== 0) {
      setOffset({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
    >
      <motion.div
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: 'spring', stiffness: 220, damping: 16, mass: 0.6 }}
      >
        {children}
      </motion.div>
    </div>
  );
}