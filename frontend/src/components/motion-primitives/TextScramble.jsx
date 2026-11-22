import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789○△□#%';

export function TextScramble({ children, triggerKey, duration = 0.45, className = '' }) {
  const text = String(children ?? '');
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let frame = 0;
    const totalFrames = Math.max(1, Math.round(duration * 60));
    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const scrambled = text
        .split('')
        .map((char, idx) => {
          if (char === ' ') return ' ';
          if (idx / text.length < progress) return text[idx];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join('');

      setDisplayText(scrambled);
      if (frame >= totalFrames) {
        setDisplayText(text);
        clearInterval(interval);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [text, triggerKey, duration]);

  return (
    <motion.span className={className} initial={{ opacity: 0.85 }} animate={{ opacity: 1 }}>
      {displayText}
    </motion.span>
  );
}