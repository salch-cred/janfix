const TEXT =
  "JanFix is an independent citizen initiative designed to improve civic transparency. " +
  "Community Accountability Scores are calculated using publicly visible reports " +
  "and community verification. They do not represent official government evaluations or endorsements.";

export function Disclaimer({ variant = "banner" }: { variant?: "banner" | "inline" | "footer" }) {
  if (variant === "banner") {
    return (
      <div className="disclaimer-banner">
        <p>{TEXT}</p>
      </div>
    );
  }

  if (variant === "inline") {
    return <p className="disclaimer-inline">{TEXT}</p>;
  }

  return <p className="disclaimer-footer">{TEXT}</p>;
}
