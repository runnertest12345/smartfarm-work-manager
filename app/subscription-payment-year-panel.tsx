import { Card, CardContent } from '@/components/ui/card';
import {
  buildPaymentYearReport,
  paymentOrdinalLabel,
} from '@/lib/subscription-payment-report';

export function SubscriptionPaymentYearPanel({
  report,
}: {
  report: ReturnType<typeof buildPaymentYearReport>;
}) {
  const cells = (row: typeof report.total) => (
    <>
      {row.ordinals.map((cell) => (
        <td key={cell.ordinal} className="p-3 text-right">
          {cell.count}
        </td>
      ))}
      {report.total.unknown > 0 && (
        <td className="p-3 text-right text-amber-800">{row.unknown}</td>
      )}
      <td className="p-3 text-right font-bold">{row.count}</td>
    </>
  );
  return (
    <section className="mb-6 space-y-3" aria-labelledby="payment-year-heading">
      <div>
        <h2 id="payment-year-heading" className="text-lg font-bold">
          전체 연도 · 입금연도별 갱신 차수
        </h2>
        <p className="mt-1 text-sm text-[#627269]">
          실제 입금한 연도별 1차·2차·3차 갱신 건수입니다. 만료 연도별 갱신율과는
          다른 표이며 사업 타입은 현재 연결된 사업 기준입니다.
        </p>
      </div>
      <Card className="border-0 bg-white ring-[#dfe6dd]">
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm tabular-nums">
              <caption className="sr-only">
                입금연도별 갱신 차수 · 단위 입금 건
              </caption>
              <thead className="bg-[#f3f6f3]">
                <tr>
                  <th scope="col" className="p-3 text-left">
                    입금 연도
                  </th>
                  {report.columns.map((ordinal) => (
                    <th
                      key={ordinal}
                      scope="col"
                      className="whitespace-nowrap p-3 text-right"
                    >
                      {paymentOrdinalLabel(ordinal)} 갱신
                    </th>
                  ))}
                  {report.total.unknown > 0 && (
                    <th scope="col" className="p-3 text-right">
                      차수 연결 필요
                    </th>
                  )}
                  <th scope="col" className="p-3 text-right">
                    입금 건수
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-emerald-200 bg-emerald-50">
                  <th scope="row" className="p-3 text-left">
                    전체 기간 총계
                  </th>
                  {cells(report.total)}
                </tr>
                {report.years.map((row) => (
                  <tr key={row.year} className="border-t">
                    <th scope="row" className="p-3 text-left">
                      {row.year}년
                    </th>
                    {cells(row)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#627269]">
            첫 입금은 1차, 다음 입금은 2차·3차입니다. 연도가 바뀌어도 1차로
            초기화하지 않습니다. 132,000원을 한 번에 입금해도 갱신은 1건입니다.
            한 농가가 같은 해에 여러 번 입금하면 각각 집계합니다.
          </p>
          {report.total.count === 0 && (
            <p className="mt-2 text-sm">
              선택한 사업 타입에 연결된 입금 기록이 없습니다.
            </p>
          )}
          {(report.possiblyLimited ||
            report.incompleteRecords > 0 ||
            report.total.unknown > 0) && (
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {report.total.unknown > 0 &&
                `차수 연결 필요 ${report.total.unknown}건은 입금 건수에는 포함하지만 임의로 차수를 지정하지 않습니다. `}
              {report.incompleteRecords > 0 &&
                `저장된 횟수보다 불러온 입금이 적은 참여 ${report.incompleteRecords}개소가 있습니다. `}
              {report.possiblyLimited && '기록 조회 한도에 도달했습니다. '}
              불러온 입금 기록 범위의 현황이며, 수기 갱신 기록만으로 입금 건수를
              늘리지 않습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
