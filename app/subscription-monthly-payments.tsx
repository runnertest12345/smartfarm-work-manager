import { ChevronDown } from 'lucide-react';

export function SubscriptionMonthlyPayments({
  months,
}: {
  months: readonly { label: string; count: number; amount: number }[];
}) {
  return (
    <details className="group mb-4 rounded-xl border border-slate-200 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
        <span className="font-semibold text-slate-800">최근 월별 입금</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className="group-open:hidden">펼치기</span>
          <span className="hidden group-open:inline">접기</span>
          <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-slate-100 p-4">
        <p className="mb-3 text-xs text-slate-500">입금 업무 히스토리 기준 · 기록이 있는 최근 6개 월</p>
        {months.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {months.map((month) => (
              <li key={month.label} className="rounded-xl bg-[#f5f8f4] p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <time dateTime={month.label} className="font-semibold">{month.label}</time>
                  <span className="rounded border border-slate-200 px-1.5 py-0.5">{month.count}건</span>
                </div>
                <p className="mt-2 font-bold tabular-nums text-[#39795b]">{month.amount.toLocaleString('ko-KR')}원</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">입금 기록이 없습니다.</p>
        )}
      </div>
    </details>
  );
}
