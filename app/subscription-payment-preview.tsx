import type { FarmRecord } from '@/lib/farm-types';
import { calculateSubscriptionPayment } from '@/lib/subscription-payment';

export function SubscriptionPaymentPreview({
  record,
  amount,
  paymentDate,
  today,
  paymentCount,
}: {
  record?: FarmRecord;
  amount: number;
  paymentDate: string;
  today: string;
  paymentCount: number;
}) {
  let message =
    '66,000원당 1년 · 66,000원 미만 불가. 금액 0은 입금 없이 업무 기록만 저장합니다.';
  let invalid = false;
  if (amount !== 0) {
    try {
      const plan = calculateSubscriptionPayment({
        amount,
        currentExpiryDate: record?.currentSubscriptionExpiresAt ?? '',
        paymentDate,
        today,
      });
      message = `현재 ${paymentCount === 0 ? '갱신 이력 없음' : `${paymentCount}차 갱신`} · 입금 ${paymentCount}건\n저장 후 ${paymentCount + 1}차 갱신 예정 · ${plan.years}년 연장\n${plan.basisExpiryDate} → ${plan.newExpiryDate}\n${plan.withinGrace ? '만료 전 또는 만료 후 2개월 이내: 기존 만료일 기준' : '만료 후 2개월 초과: 결제일부터 연장한 해당 월의 마지막 날'}`;
    } catch (error) {
      invalid = true;
      message =
        error instanceof Error
          ? error.message
          : '입금액과 파모스앱 기준 만료일을 확인해 주세요.';
    }
  }
  return (
    <div
      className={`mt-2 rounded-lg border p-3 text-sm leading-6 ${invalid ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}
      aria-live="polite"
    >
      <p className="font-semibold">입금 시 자동 구독 갱신</p>
      <p className="whitespace-pre-line">{message}</p>
      <p className="mt-1 text-xs">
        관리대장 만료일이 파모스앱과 같은지 확인하세요. 저장하면 입금과
        만료일·갱신 이력이 함께 반영됩니다.
      </p>
    </div>
  );
}
