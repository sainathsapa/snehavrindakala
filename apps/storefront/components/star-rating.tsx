/**
 * Star rating, drawn as filled/half/empty stars from a numeric value.
 *
 * Renders nothing to assistive tech itself — callers pair it with a text
 * description where the number matters — but exposes an aria-label here so a
 * lone rating is still announced sensibly.
 */
export function StarRating({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill =
          rounded >= star ? "full" : rounded >= star - 0.5 ? "half" : "empty";
        return (
          <svg
            key={star}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="text-terracotta"
          >
            <defs>
              <linearGradient id={`half-${star}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5z"
              fill={
                fill === "full"
                  ? "currentColor"
                  : fill === "half"
                    ? `url(#half-${star})`
                    : "none"
              }
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </span>
  );
}