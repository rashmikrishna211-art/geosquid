import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '@avatune/react';
import kyuteTheme from '@avatune/kyute-theme/react';
import micahTheme from '@avatune/micah-theme/react';
import miniavsTheme from '@avatune/miniavs-theme/react';
import cyberpunkTheme from '@avatune/cyberpunk-theme/react';

export const AVATUNE_THEMES = {
  kyute: { id: 'kyute', label: 'Kyute', theme: kyuteTheme },
  micah: { id: 'micah', label: 'Micah', theme: micahTheme },
  miniavs: { id: 'miniavs', label: 'Miniavs', theme: miniavsTheme },
  cyberpunk: { id: 'cyberpunk', label: 'Cyberpunk', theme: cyberpunkTheme },
};

export const AVATAR_COLORS = [
  { id: '#00e676', label: 'Emerald' },
  { id: '#00e5ff', label: 'Cyan' },
  { id: '#ff0055', label: 'Pink' },
  { id: '#ffb300', label: 'Gold' },
  { id: '#a855f7', label: 'Violet' },
];

export function parsePlayerAvatar(raw) {
  const parts = (raw || 'kyute:player-01:#00e676').split(':');
  const themeKey = AVATUNE_THEMES[parts[0]] ? parts[0] : 'kyute';
  const seed = parts[1] || 'player-01';
  const color = parts[2] || '#00e676';
  return { themeKey, seed, color };
}

export function AvatuneSprite({
  themeKey = 'kyute',
  seed = 'player-01',
  size = 36,
  className = '',
}) {
  const selected = AVATUNE_THEMES[themeKey] || AVATUNE_THEMES.kyute;
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden ${className}`}>
      <Avatar theme={selected.theme} seed={seed} size={size} />
    </span>
  );
}

export function renderAvatuneSvgHtml(raw, size = 32) {
  const { themeKey, seed } = parsePlayerAvatar(raw);
  return renderToStaticMarkup(
    <AvatuneSprite themeKey={themeKey} seed={seed} size={size} />
  );
}