'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  serviceDateLabel,
  serviceYear,
  serviceYearOptions,
} from '@/lib/service-work';

export type ServiceRow = {
  id: string;
  title: string;
  farmName: string;
  projectName: string;
  owner: string;
  statusLabel: string;
  statusClass: string;
  receivedAt: number;
  receivedContent: string;
  actionContent: string;
};

export type ServiceRegistrationOption = {
  recordId: string;
  farmId: string;
  farmLabel: string;
  projectLabel: string;
};

function ServiceRegistrationDialog({
  farms: availableFarms,
  options,
  onClose,
  onRegister,
}: {
  farms: { farmId: string; farmLabel: string }[];
  options: ServiceRegistrationOption[];
  onClose: () => void;
  onRegister: (recordId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [farmId, setFarmId] = useState('');
  const [recordId, setRecordId] = useState('');
  const farms = availableFarms
    .map(({ farmId, farmLabel }) => [farmId, farmLabel] as const)
    .sort((a, b) => a[1].localeCompare(b[1], 'ko'));
  const matchingFarms = farms.filter(([, label]) =>
    label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const records = options.filter((option) => option.farmId === farmId);
  const selected = records.find((option) => option.recordId === recordId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="farm-app farm-dialog max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>A/S 등록 · 농가 선택</DialogTitle>
          <DialogDescription>
            전체 농가에서 선택할 수 있습니다. 완료된 참여 사업에도 A/S를
            등록할 수 있으며, 사업의 완료 상태는 유지됩니다.
          </DialogDescription>
        </DialogHeader>
        {!farms.length ? (
          <p className="py-4 text-sm text-slate-600">
            등록된 농가가 없습니다. 농가 관리대장에서 농가를 먼저 등록해 주세요.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <label
                htmlFor="service-farm-search"
                className="text-sm font-medium"
              >
                농가 검색
              </label>
              <Input
                id="service-farm-search"
                placeholder="농가명 또는 농장번호"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <p className="text-sm text-slate-600">
                전체 농가 {farms.length}곳 · 검색 결과 {matchingFarms.length}곳
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="service-farm" className="text-sm font-medium">
                농가
              </label>
              <Select
                value={farmId}
                onValueChange={(value) => {
                  setFarmId(value ?? '');
                  setRecordId('');
                }}
              >
                <SelectTrigger id="service-farm" className="w-full">
                  <SelectValue>
                    {farms.find(([id]) => id === farmId)?.[1] ?? '농가 선택'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {matchingFarms.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!matchingFarms.length && (
                <p className="text-sm text-slate-600">검색 결과가 없습니다.</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="service-record" className="text-sm font-medium">
                참여 사업
              </label>
              <Select
                value={recordId}
                onValueChange={(value) => setRecordId(value ?? '')}
                disabled={!farmId || !records.length}
              >
                <SelectTrigger id="service-record" className="w-full">
                  <SelectValue>
                    {selected?.projectLabel ?? '참여 사업 선택'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {records.map((option) => (
                    <SelectItem key={option.recordId} value={option.recordId}>
                      {option.projectLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {farmId && !records.length && (
                <output className="block text-sm text-slate-600">
                  이 농가에 연결된 참여 사업이 없습니다. 농가 관리대장에서 참여
                  사업을 등록하거나 삭제된 사업을 복구한 뒤 A/S를 등록해 주세요.
                </output>
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onClose();
                onRegister(selected.recordId);
              }
            }}
          >
            A/S 내용 작성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceWorkPanel({
  rows,
  farms,
  registrationOptions,
  currentYear,
  onRegister,
  onOpen,
  onRegistrationOpenChange,
}: {
  rows: ServiceRow[];
  farms: { farmId: string; farmLabel: string }[];
  registrationOptions: ServiceRegistrationOption[];
  currentYear: string;
  onRegister: (recordId: string) => void;
  onOpen: (id: string) => void;
  onRegistrationOpenChange: (open: boolean) => void;
}) {
  const [year, setYear] = useState(currentYear);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  function changeRegistrationOpen(open: boolean) {
    onRegistrationOpenChange(open);
    setRegistering(open);
  }
  const years = serviceYearOptions(
    rows.map((row) => row.receivedAt),
    currentYear,
  );
  const visible = rows.filter(
    (row) => year === 'all' || serviceYear(row.receivedAt) === year,
  );
  const yearLabel =
    year === 'all'
      ? '전체 연도'
      : year === 'unknown'
        ? '접수일 미지정'
        : `${year}년`;
  return (
    <section aria-label="A/S 업무 관리">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#647568]">농가 장애 대응</p>
          <h1 className="mt-1 text-[28px] font-bold">A/S 업무 관리</h1>
          <p className="mt-2 text-sm text-slate-600">
            접수 연도별 A/S를 확인하고, 상세 보기를 펼쳐 수신·처리 내용을
            확인하세요.
          </p>
        </div>
        <Button onClick={() => changeRegistrationOpen(true)}>
          <Plus className="size-4" />
          A/S 등록
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="w-52 space-y-2">
          <label htmlFor="service-year" className="text-sm font-medium">
            접수 연도
          </label>
          <Select
            value={year}
            onValueChange={(value) => {
              if (value) {
                setYear(value);
                setExpanded([]);
              }
            }}
          >
            <SelectTrigger id="service-year" className="w-full">
              <SelectValue>{yearLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 연도</SelectItem>
              {years.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'unknown' ? '접수일 미지정' : `${value}년`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <output className="block pb-1 text-sm text-slate-600">
          {yearLabel} · A/S{' '}
          <span className="font-semibold text-slate-900">
            {visible.length}건
          </span>
        </output>
      </div>
      {visible.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table className="min-w-[860px] table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[116px]">접수일</TableHead>
                <TableHead className="w-[22%]">농가 · 프로젝트</TableHead>
                <TableHead className="w-[22%]">A/S 업무명</TableHead>
                <TableHead className="w-[90px]">상태</TableHead>
                <TableHead>최근 처리 내용</TableHead>
                <TableHead className="w-[100px]">상세</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const open = expanded.includes(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="py-3 text-xs text-slate-600">
                        {serviceDateLabel(row.receivedAt)}
                      </TableCell>
                      <TableCell className="py-3">
                        <p
                          className="truncate font-semibold"
                          title={row.farmName}
                        >
                          {row.farmName}
                        </p>
                        <p
                          className="mt-1 truncate text-xs text-slate-500"
                          title={row.projectName}
                        >
                          {row.projectName}
                        </p>
                      </TableCell>
                      <TableCell className="py-3">
                        <button
                          type="button"
                          onClick={() => onOpen(row.id)}
                          className="line-clamp-2 text-left font-semibold whitespace-normal break-words text-emerald-800 hover:underline"
                          title={row.title}
                        >
                          {row.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.statusClass}>
                          {row.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-sm whitespace-normal break-words text-slate-600">
                          {row.actionContent || '처리 내용 없음'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={open}
                          aria-controls={`service-detail-${row.id}`}
                          aria-label={`${row.title} 상세 ${open ? '접기' : '보기'}`}
                          onClick={() =>
                            setExpanded((previous) =>
                              open
                                ? previous.filter((id) => id !== row.id)
                                : [...previous, row.id],
                            )
                          }
                        >
                          {open ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                          {open ? '접기' : '보기'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow
                        id={`service-detail-${row.id}`}
                        className="bg-slate-50/80 hover:bg-slate-50/80"
                      >
                        <TableCell colSpan={6} className="p-4">
                          <p className="mb-3 whitespace-normal text-sm">
                            <span className="font-semibold">
                              {row.farmName}
                            </span>{' '}
                            · {row.projectName} · 담당 {row.owner || '미지정'}
                          </p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold text-slate-500">
                                마지막 받은 내용
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                {row.receivedContent || '받은 내용이 없습니다.'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                              <p className="text-xs font-semibold text-emerald-800">
                                마지막 처리 내용
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                {row.actionContent || '처리 내용이 없습니다.'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => onOpen(row.id)}
                          >
                            업무 상세 · 처리 이력
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
          <p className="font-semibold">
            {yearLabel}에 접수된 A/S 업무가 없습니다.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            다른 접수 연도를 선택하거나 새 A/S를 등록해 주세요.
          </p>
        </div>
      )}
      {registering && (
        <ServiceRegistrationDialog
          farms={farms}
          options={registrationOptions}
          onClose={() => changeRegistrationOpen(false)}
          onRegister={onRegister}
        />
      )}
    </section>
  );
}
