import { useEffect, useRef } from 'react';

export default function Squares({
  direction = 'diagonal',
  speed = 0.45,
  borderColor = 'rgba(255, 255, 255, 0.06)',
  squareSize = 44,
  hoverFillColor = 'rgba(255, 0, 85, 0.14)',
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let gridOffsetX = 0;
    let gridOffsetY = 0;
    let hoveredSquare = null;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const col = Math.floor((mouseX + (gridOffsetX % squareSize)) / squareSize);
      const row = Math.floor((mouseY + (gridOffsetY % squareSize)) / squareSize);
      hoveredSquare = { col, row };
    };

    const handleMouseLeave = () => {
      hoveredSquare = null;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = -(gridOffsetX % squareSize);
      const startY = -(gridOffsetY % squareSize);

      if (hoveredSquare) {
        const hx = startX + hoveredSquare.col * squareSize;
        const hy = startY + hoveredSquare.row * squareSize;
        ctx.fillStyle = hoverFillColor;
        ctx.fillRect(hx, hy, squareSize, squareSize);
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const grad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(canvas.width, canvas.height) * 0.15,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.72
      );
      grad.addColorStop(0, 'rgba(9, 9, 11, 0.08)');
      grad.addColorStop(1, 'rgba(9, 9, 11, 0.92)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (direction === 'right' || direction === 'diagonal') gridOffsetX += speed;
      if (direction === 'left') gridOffsetX -= speed;
      if (direction === 'down' || direction === 'diagonal') gridOffsetY += speed;
      if (direction === 'up') gridOffsetY -= speed;

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [direction, speed, borderColor, squareSize, hoverFillColor]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} />;
}