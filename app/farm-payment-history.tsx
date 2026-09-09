'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FarmHistoryEntry, FarmWorkItem } from '@/lib/farm-types';

export function FarmPaymentHistory({
  payments,
  projectLabel,
  onOpen,
  onAdd,
  disabled,
}: {
  payments: { entry: FarmHistoryEntry; workItem: FarmWorkItem }[];
  projectLabel: (item: FarmWorkItem) => string;
  onOpen: (item: FarmWorkItem) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(payments.length / 20));
  const current = Math.min(page, pages - 1);
  const total = payments.reduce((sum, { entry }) => sum + entry.amount, 0);
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5"
      aria-label="농가 입금내역"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">입금내역 {payments.length}건</h3>
          <p className="mt-1 text-sm text-slate-600">
            현재 보는 사업 기준 · 총 {total.toLocaleString('ko-KR')}원
          </p>
        </div>
        <Button type="button" onClick={onAdd} disabled={disabled}>
          입금 등록
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>입금일</TableHead>
            <TableHead>사업</TableHead>
            <TableHead className="text-right">입금액</TableHead>
            <TableHead>처리 내용</TableHead>
            <TableHead>확인</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments
            .slice(current * 20, (current + 1) * 20)
            .map(({ entry, workItem }) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.occurredAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  {projectLabel(workItem)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {entry.amount.toLocaleString('ko-KR')}원
                </TableCell>
                <TableCell className="max-w-80 whitespace-normal">
                  {entry.actionContent || entry.receivedContent || '내용 없음'}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpen(workItem)}
                  >
                    입금 상세
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          {!payments.length && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-slate-600"
              >
                등록된 입금내역이 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            이전
          </Button>
          <span className="text-sm">
            {current + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </section>
  );
}
