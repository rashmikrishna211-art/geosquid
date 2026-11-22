import { motion } from 'motion/react';

export default function BlurText({
  text = '',
  delay = 55,
  className = '',
  by = 'chars',
}) {
  const units = by === 'words' ? text.split(' ') : Array.from(text);

  return (
    <span className={`inline-flex flex-wrap justify-center ${className}`}>
      {units.map((unit, i) => (
        <motion.span
          key={`${unit}-${i}`}
          initial={{ opacity: 0, filter: 'blur(8px)', y: 10 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{
            duration: 0.45,
            delay: (i * delay) / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block whitespace-pre"
        >
          {unit}
          {by === 'words' && i < units.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}