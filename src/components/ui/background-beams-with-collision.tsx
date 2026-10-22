"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

type BeamOptions = {
  initialX?: number;
  translateX?: number;
  initialY?: number;
  translateY?: number;
  rotate?: number;
  className?: string;
  duration?: number;
  delay?: number;
  repeatDelay?: number;
};

// Upstream ships absolute-pixel X positions (10..1200) which push most beams
// off-screen on phones. Fractions of the measured container width keep the
// same spread at every viewport (7 beams across 390px and 1440px alike).
const BEAMS: {
  xFrac: number;
  duration: number;
  repeatDelay: number;
  delay?: number;
  className?: string;
}[] = [
  { xFrac: 0.02, duration: 7, repeatDelay: 3, delay: 2 },
  { xFrac: 0.47, duration: 3, repeatDelay: 3, delay: 4 },
  { xFrac: 0.1, duration: 7, repeatDelay: 7, className: "h-6" },
  { xFrac: 0.31, duration: 5, repeatDelay: 14, delay: 4 },
  { xFrac: 0.63, duration: 11, repeatDelay: 2, className: "h-20" },
  { xFrac: 0.78, duration: 4, repeatDelay: 2, className: "h-12" },
  { xFrac: 0.94, duration: 6, repeatDelay: 4, delay: 2, className: "h-6" },
];

/**
 * Aceternity "background beams with collision", adapted for the Hayaan hero:
 *  - beam X positions are fractions of the measured container width
 *    (ResizeObserver) so the spread survives mobile widths
 *  - brand-green gradient (from-emerald-600 via #14532d) instead of the
 *    upstream indigo/purple, which clashes with the green/cream palette
 *  - collision floor bar kept for collision math but rendered transparent
 *    (no neutral-100 band / boxShadow across the hero base)
 *  - beams mount only after width measure + while near the viewport
 *    (useInView) so rAF and the 50ms collision polls never burn CPU when
 *    scrolled away; nothing beam-related renders in SSR HTML
 *  - MotionConfig reducedMotion="user" disables the fall for users who
 *    prefer reduced motion
 *  - data-beams-root / data-beam / data-beams-floor probe attributes for
 *    the CDP verification harness
 */
export const BackgroundBeamsWithCollision = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState(0);
  const inView = useInView(parentRef, { margin: "160px" });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    setParentWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setParentWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={parentRef}
        data-beams-root=""
        className={cn(
          "relative flex h-96 w-full items-center justify-center overflow-hidden bg-gradient-to-b from-white to-neutral-100 dark:from-neutral-950 dark:to-neutral-800 md:h-[40rem]",
          className,
        )}
      >
        {parentWidth > 0 && inView
          ? BEAMS.map((beam, i) => (
              <CollisionMechanism
                key={`beam-${i}`}
                beamOptions={{
                  initialX: Math.round(beam.xFrac * parentWidth),
                  translateX: Math.round(beam.xFrac * parentWidth),
                  duration: beam.duration,
                  repeatDelay: beam.repeatDelay,
                  delay: beam.delay,
                  className: beam.className,
                }}
                containerRef={containerRef}
                parentRef={parentRef}
              />
            ))
          : null}

        {children}
        <div
          ref={containerRef}
          data-beams-floor=""
          className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
        ></div>
      </div>
    </MotionConfig>
  );
};

const CollisionMechanism = React.forwardRef<
  HTMLDivElement,
  {
    containerRef: React.RefObject<HTMLDivElement | null>;
    parentRef: React.RefObject<HTMLDivElement | null>;
    beamOptions?: BeamOptions;
  }
>(({ parentRef, containerRef, beamOptions = {} }, ref) => {
  const beamRef = useRef<HTMLDivElement>(null);
  const [collision, setCollision] = useState<{
    detected: boolean;
    coordinates: { x: number; y: number } | null;
  }>({
    detected: false,
    coordinates: null,
  });
  const [beamKey, setBeamKey] = useState(0);
  const [cycleCollisionDetected, setCycleCollisionDetected] = useState(false);

  useEffect(() => {
    const checkCollision = () => {
      if (
        beamRef.current &&
        containerRef.current &&
        parentRef.current &&
        !cycleCollisionDetected
      ) {
        const beamRect = beamRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = parentRef.current.getBoundingClientRect();

        if (beamRect.bottom >= containerRect.top) {
          const relativeX =
            beamRect.left - parentRect.left + beamRect.width / 2;
          const relativeY = beamRect.bottom - parentRect.top;

          setCollision({
            detected: true,
            coordinates: {
              x: relativeX,
              y: relativeY,
            },
          });
          setCycleCollisionDetected(true);
        }
      }
    };

    const animationInterval = setInterval(checkCollision, 50);

    return () => clearInterval(animationInterval);
  }, [cycleCollisionDetected, containerRef]);

  useEffect(() => {
    if (collision.detected && collision.coordinates) {
      setTimeout(() => {
        setCollision({ detected: false, coordinates: null });
        setCycleCollisionDetected(false);
      }, 2000);

      setTimeout(() => {
        setBeamKey((prevKey) => prevKey + 1);
      }, 2000);
    }
  }, [collision]);

  return (
    <>
      <motion.div
        key={beamKey}
        ref={beamRef}
        data-beam=""
        animate="animate"
        initial={{
          translateY: beamOptions.initialY || "-200px",
          translateX: beamOptions.initialX || "0px",
          rotate: beamOptions.rotate || 0,
        }}
        variants={{
          animate: {
            translateY: beamOptions.translateY || "1800px",
            translateX: beamOptions.translateX || "0px",
            rotate: beamOptions.rotate || 0,
          },
        }}
        transition={{
          duration: beamOptions.duration || 8,
          repeat: Infinity,
          repeatType: "loop",
          ease: "linear",
          delay: beamOptions.delay || 0,
          repeatDelay: beamOptions.repeatDelay || 0,
        }}
        className={cn(
          "absolute left-0 top-20 m-auto h-14 w-px rounded-full bg-gradient-to-t from-emerald-600 via-[#14532d] to-transparent",
          beamOptions.className,
        )}
      />
      <AnimatePresence>
        {collision.detected && collision.coordinates && (
          <Explosion
            key={`${collision.coordinates.x}-${collision.coordinates.y}`}
            className=""
            style={{
              left: `${collision.coordinates.x}px`,
              top: `${collision.coordinates.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
});

CollisionMechanism.displayName = "CollisionMechanism";

const Explosion = ({ ...props }: React.HTMLProps<HTMLDivElement>) => {
  const spans = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    initialX: 0,
    initialY: 0,
    directionX: Math.floor(Math.random() * 80 - 40),
    directionY: Math.floor(Math.random() * -50 - 10),
  }));

  return (
    <div {...props} className={cn("absolute z-50 h-2 w-2", props.className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute -inset-x-10 top-0 m-auto h-2 w-10 rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent blur-sm"
      ></motion.div>
      {spans.map((span) => (
        <motion.span
          key={span.id}
          initial={{ x: span.initialX, y: span.initialY, opacity: 1 }}
          animate={{
            x: span.directionX,
            y: span.directionY,
            opacity: 0,
          }}
          transition={{ duration: Math.random() * 1.5 + 0.5, ease: "easeOut" }}
          className="absolute h-1 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-[#14532d]"
        />
      ))}
    </div>
  );
};
