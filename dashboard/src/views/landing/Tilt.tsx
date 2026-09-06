import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

/**
 * Mouse-follow 3D tilt wrapper (pure CSS 3D transforms). Used on feature
 * cards so the hover tilt adds depth on top of the scroll-reveal animation.
 */
export default function Tilt({
  children,
  className,
  max = 9,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 180, damping: 20, mass: 0.5 });
  const rotateY = useSpring(ry, { stiffness: 180, damping: 20, mass: 0.5 });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        transformPerspective: 900,
      }}
    >
      {children}
    </motion.div>
  );
}