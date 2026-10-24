import Link from "next/link";

type WordmarkProps = {
  /** When set, the mark links here (used on the 404 page to get home). */
  href?: string;
};

/** The `<SM />` wordmark. The angle brackets are decorative; assistive tech reads "SM". */
export function Wordmark({ href }: WordmarkProps) {
  const mark = (
    <>
      <span className="wordmark-accent" aria-hidden="true">
        {"<"}
      </span>
      SM
      <span className="wordmark-accent" aria-hidden="true">
        {" />"}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="wordmark" aria-label="Sarmad Mir, home">
        {mark}
      </Link>
    );
  }

  return <div className="wordmark">{mark}</div>;
}
