"use client";

import { motion } from "framer-motion";

const stories = [
  {
    emoji: "🔍",
    title: "TabDeep",
    story:
      "What started as an experiment to investigate suspected security issues across my synced devices turned into a full-fledged Chrome extension for deep tab history analysis.",
    tech: ["Chrome APIs", "JavaScript", "Manifest V3"],
    link: "/projects/tabdeep",
  },
  {
    emoji: "📄",
    title: "Input2PDFSolution",
    story:
      "Clients on Fiverr needed custom PDF systems — certificates, invoices, agreements — but existing tools were too rigid. So I built a tailored solution, one client at a time.",
    tech: ["PHP", "FPDI", "PDF Generation"],
    link: "/projects/input2pdf",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

export function ProblemSolver() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Problems I&apos;ve Solved
          </h2>
          <p className="text-muted text-lg max-w-xl">
            Every project starts with a real problem. Here&apos;s how curiosity
            and code came together.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {stories.map((story, i) => (
            <motion.a
              key={story.title}
              href={story.link}
              className="group relative rounded-2xl border border-border bg-surface p-8 transition-all hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              custom={i}
            >
              {/* Accent gradient on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative">
                <span className="text-3xl mb-4 block">{story.emoji}</span>

                <h3 className="text-xl font-bold mb-3 group-hover:text-accent transition-colors">
                  {story.title}
                </h3>

                <p className="text-muted leading-relaxed mb-6">
                  {story.story}
                </p>

                <div className="flex flex-wrap gap-2">
                  {story.tech.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-accent-muted text-accent"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Arrow */}
                <div className="absolute top-8 right-0 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
