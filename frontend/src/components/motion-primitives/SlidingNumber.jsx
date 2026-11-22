import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

function Digit({ place, value }) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animatedValue = useSpring(valueRoundedToPlace, {
    stiffness: 280,
    damping: 26,
    mass: 0.8,
  });

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <span className="relative inline-block h-[1em] w-[0.65em] overflow-hidden leading-none">
      {Array.from({ length: 10 }, (_, i) => (
        <NumberSlot key={i} mv={animatedValue} number={i} />
      ))}
    </span>
  );
}

function NumberSlot({ mv, number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * 100;
    if (offset > 5) memo -= 1000;
    return `${memo}%`;
  });

  return (
    <motion.span style={{ y }} className="absolute inset-0 flex items-center justify-center">
      {number}
    </motion.span>
  );
}

export function SlidingNumber({ value = 0, padStart = false }) {
  const num = Math.max(0, Math.floor(Number(value) || 0));
  const digits =
    padStart && num < 10 ? [10, 1] : num >= 100 ? [100, 10, 1] : num >= 10 ? [10, 1] : [1];

  return (
    <span className="inline-flex items-center font-['JetBrains_Mono'] tabular-nums">
      {digits.map((place) => (
        <Digit key={place} place={place} value={num} />
      ))}
    </span>
  );
}