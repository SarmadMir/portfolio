"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { TypeWriter } from "@/components/ui/TypeWriter";

const ParticleNetwork = dynamic(
  () =>
    import("@/components/three/ParticleNetwork").then(
      (mod) => mod.ParticleNetwork,
    ),
  { ssr: false },
);

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" as const },
  }),
};

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden">
      <ParticleNetwork />

      <div className="mx-auto max-w-6xl px-6 py-20 w-full">
        <div className="max-w-2xl">
          {/* Greeting */}
          <motion.p
            className="text-sm font-mono text-accent mb-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Hi, my name is
          </motion.p>

          {/* Name */}
          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Sarmad Mir
          </motion.h1>

          {/* Subtitle */}
          <motion.h2
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-muted mb-6"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            Software Engineer &<br />
            Creative Problem Solver
          </motion.h2>

          {/* Typing animation */}
          <motion.div
            className="text-lg text-muted mb-8 h-8"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <TypeWriter
              phrases={[
                "building browser extensions",
                "generating PDFs from data",
                "turning ideas into products",
                "solving real problems",
              ]}
            />
          </motion.div>

          {/* Description */}
          <motion.p
            className="text-base sm:text-lg text-muted max-w-lg mb-10 leading-relaxed"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            I build tools and systems that solve real problems — from Chrome
            extensions that analyze browsing patterns to custom PDF generation
            systems used by businesses worldwide.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={5}
          >
            <a
              href="#projects"
              className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-accent text-white font-medium text-sm transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/25 hover:-translate-y-0.5"
            >
              View My Work
            </a>
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-border bg-surface font-medium text-sm transition-all hover:border-accent hover:text-accent hover:-translate-y-0.5"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Resume
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <div className="flex flex-col items-center gap-2 text-muted">
          <span className="text-xs font-mono">scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-muted/30 flex justify-center pt-1.5">
            <motion.div
              className="w-1 h-1.5 rounded-full bg-accent"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
