"use client";

import { motion } from "framer-motion";

const skillCategories = [
  {
    title: "Languages",
    skills: ["JavaScript", "TypeScript", "PHP", "HTML/CSS", "SQL"],
  },
  {
    title: "Frameworks",
    skills: ["Next.js", "React", "Node.js", "Bootstrap", "Tailwind CSS"],
  },
  {
    title: "Tools & APIs",
    skills: ["Chrome Extensions", "Three.js", "FPDI/FPDF", "Git", "Figma"],
  },
  {
    title: "Concepts",
    skills: [
      "PDF Generation",
      "Browser APIs",
      "Privacy-First Design",
      "Responsive UI",
      "REST APIs",
    ],
  },
];

export function SkillsSection() {
  return (
    <section className="py-24 px-6 bg-surface">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Tech I Work With
          </h2>
          <p className="text-muted text-lg max-w-xl">
            A mix of technologies I use to build products and solve problems.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {skillCategories.map((category, catIndex) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: catIndex * 0.1, duration: 0.5 }}
              className="rounded-xl border border-border bg-background p-6"
            >
              <h3 className="text-sm font-mono text-accent uppercase tracking-wider mb-4">
                {category.title}
              </h3>
              <ul className="space-y-2.5">
                {category.skills.map((skill) => (
                  <li
                    key={skill}
                    className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                    {skill}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
