export type SiteLink = {
  label: string;
  href: string;
  /** Link relation, e.g. "me" for profiles that identify the site owner. */
  rel?: string;
};

export const site = {
  name: "Sarmad Mir",
  role: "Software engineer",
  url: "https://sarmadmir.dev",
  description:
    "Sarmad Mir, software engineer. Projects: Input2PDF, a custom PDF generation service, and TabDeep, a Chrome extension for tab-level browser history analysis.",
  footer: "Full site in progress.",
  links: [
    { label: "Input2PDF", href: "https://input2pdfsolution.com" },
    {
      label: "TabDeep",
      href: "https://chromewebstore.google.com/detail/tabdeep/fnpiofolkbgakefloelllinjkgpgabpc",
    },
    { label: "GitHub", href: "https://github.com/SarmadMir", rel: "me" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/sarmadmir", rel: "me" },
  ] satisfies readonly SiteLink[],
} as const;
