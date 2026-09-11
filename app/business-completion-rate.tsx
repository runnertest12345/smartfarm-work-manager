export function BusinessCompletionRate({
  rate,
  className = '',
}: {
  rate: number | null;
  className?: string;
}) {
  return (
    <span
      className={[
        'font-semibold',
        rate !== null && rate < 100 ? 'text-red-700' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {rate === null ? '-' : `${rate}%`}
    </span>
  );
}
