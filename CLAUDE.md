@AGENTS.md

# Sarmad Mir — Personal Portfolio

## Project Overview
Interactive personal portfolio website for Sarmad Mir, a software engineer. Serves as CV/resume and central hub linking to TabDeep (Chrome extension) and Input2PDFSolution (custom PDF generation service).

## Tech Stack
- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **3D**: Three.js via `@react-three/fiber` + `@react-three/drei` (3D avatar in hero)
- **Animation**: Framer Motion (scroll-driven reveals, hover effects)
- **Sound**: Tone.js (opt-in ambient generative music, off by default)
- **Theme**: `next-themes` (dark mode default)
- **Email**: Resend (contact form)
- **Hosting**: Vercel

## Architecture
```
app/
├── layout.tsx           # Root layout: Nav, Footer, ThemeProvider, SoundProvider
├── page.tsx             # Home: 3D hero, problem-solver narrative, featured projects, skills
├── about/page.tsx       # Bio, experience timeline, resume download
├── projects/
│   ├── page.tsx         # Projects grid with filter chips
│   ├── tabdeep/         # TabDeep case study (Problem → Approach → Solution)
│   └── input2pdf/       # Input2PDF case study
├── contact/page.tsx     # Contact form
└── api/contact/route.ts # Resend email handler
```

## Design Principles
- **Dark mode default** — developer identity signal
- **Interactive experience** — not just a static website
- **Problem-solver narrative** — each project tells: Problem → Approach → Solution
- **Performance as a feature** — target Lighthouse 90+
- **Unique background** — particle constellation network or code rain (NOT floating shapes)
- **Content quality** — all copy carefully crafted, authentic voice

## Key Creative Elements
1. **3D Avatar**: Ready Player Me GLB model loaded with @react-three/fiber. Orbit controls. Fallback image on mobile/low-end.
2. **Tone.js Sound**: Toggle in nav, off by default. Ambient generative synths that react to scroll position.
3. **Typing Animation**: Terminal-style cycling through `> building TabDeep...` / `> generating PDFs...`
4. **Scroll Animations**: Framer Motion InView reveals, parallax layers

## Cross-Project Links
- Portfolio → Chrome Web Store (TabDeep listing)
- Portfolio → input2pdfsolution.com (product website)
- Input2PDF footer → back to portfolio ("Built by Sarmad Mir")

## Color Palette (Portfolio)
- Decide during design phase — should complement but differ from Input2PDF's pink/coral palette
- Dark mode: deep navy/charcoal base with vibrant accent color

## Related Projects
- TabDeep: `/Users/sarmadmir/Documents/My Data/Projects/Chrome Data Access/`
- Input2PDF: `/Users/sarmadmir/Documents/My Data/Projects/input2pdf-website/`
- Many other projects which will be included in this when we start working on my portfolio.
