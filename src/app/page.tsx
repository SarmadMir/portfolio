import { Hero } from "@/components/home/Hero";
import { ProblemSolver } from "@/components/home/ProblemSolver";
import { SkillsSection } from "@/components/home/SkillsSection";
import { CTASection } from "@/components/home/CTASection";

export default function Home() {
  return (
    <>
      <Hero />
      <div id="projects">
        <ProblemSolver />
      </div>
      <SkillsSection />
      <CTASection />
    </>
  );
}
