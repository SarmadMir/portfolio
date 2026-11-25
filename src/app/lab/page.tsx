import Link from "next/link";
import { LAB_SLOTS } from "./slots";

export default function LabIndex() {
  return (
    <>
      <h1 className="font-display text-title-1">Lab</h1>
      <ul className="flex flex-col gap-3">
        {LAB_SLOTS.map((slot) => (
          <li key={slot.slug}>
            <Link
              href={`/lab/${slot.slug}`}
              className="text-body-lg text-accent-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent-text"
            >
              {slot.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
