/** Farmos subscription policy. Dates are ISO calendar dates, not elapsed 24-hour days. */
export const SUBSCRIPTION_YEAR_PRICE = 66000;
export const SUBSCRIPTION_PAYMENT_POLICY = 'farmos-66000-2month-v1';

export interface SubscriptionPaymentRequest {
  operationId: string;
  expectedCurrentExpiryDate: string;
  expectedUpdatedAt: number;
}

function dateParts(value: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('파모스앱의 사용 만료일과 결제일을 확인해 주세요.');
  const parts = value.split('-').map(Number) as [number, number, number];
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    parts[0] < 1900
  ) {
    throw new Error('파모스앱의 사용 만료일과 결제일을 확인해 주세요.');
  }
  return parts;
}

export function addSubscriptionMonths(
  value: string,
  months: number,
  monthEnd = false,
): string {
  const [year, month, day] = dateParts(value);
  const destination = new Date(Date.UTC(year, month - 1 + months + 1, 0));
  if (
    !Number.isFinite(destination.getTime()) ||
    destination.getUTCFullYear() > 9999
  )
    throw new Error('구독 연장 기간을 확인해 주세요.');
  if (!monthEnd)
    destination.setUTCDate(Math.min(day, destination.getUTCDate()));
  return destination.toISOString().slice(0, 10);
}

export function calculateSubscriptionPayment(input: {
  amount: number;
  currentExpiryDate: string;
  paymentDate: string;
  today: string;
}) {
  const { amount, currentExpiryDate, paymentDate, today } = input;
  if (!Number.isSafeInteger(amount) || amount < SUBSCRIPTION_YEAR_PRICE) {
    throw new Error(
      '구독 입금은 66,000원 이상이어야 합니다. 금액을 확인해 주세요.',
    );
  }
  if (amount % SUBSCRIPTION_YEAR_PRICE !== 0) {
    throw new Error(
      '자동 연장은 66,000원당 1년입니다. 66,000원 단위의 입금액을 입력해 주세요.',
    );
  }
  dateParts(currentExpiryDate);
  dateParts(paymentDate);
  dateParts(today);
  if (paymentDate > today)
    throw new Error(
      '미래 결제일로 구독을 연장할 수 없습니다. 실제 입금일을 입력해 주세요.',
    );
  const years = amount / SUBSCRIPTION_YEAR_PRICE;
  const graceEndDate = addSubscriptionMonths(currentExpiryDate, 2);
  const withinGrace = paymentDate <= graceEndDate;
  const newExpiryDate = withinGrace
    ? addSubscriptionMonths(currentExpiryDate, years * 12)
    : addSubscriptionMonths(paymentDate, years * 12, true);
  return {
    amount,
    years,
    basisExpiryDate: currentExpiryDate,
    paymentDate,
    graceEndDate,
    withinGrace,
    newExpiryDate,
    policy: SUBSCRIPTION_PAYMENT_POLICY,
  };
}
