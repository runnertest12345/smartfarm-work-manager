'use client';
import {
  ProjectSettlementDetails,
  ProjectSettlementEditor,
} from './project-settlement-panels';
import {
  emptySettlement,
  projectSettlementLabel,
  withSettlementRounds,
} from '@/lib/project-settlements';

import { ProjectWorkTree } from './project-work-tree';
import { FarmPaymentHistory } from './farm-payment-history';
import {
  ProjectFarmProgressCard,
  ProjectStageSummary,
} from './project-farm-progress';
import {
  summarizeProjectFarms,
  isFarmStageComplete,
} from '@/lib/project-farm-progress';
import { ProjectDeletionDialog } from './project-deletion-dialog';
import { WorkDeletionDialog, DeletedWorkList } from './work-deletion-controls';
import { isActiveWork, canManageWorkDeletion } from '@/lib/work-lifecycle';
import { useDetailNavigation } from './use-detail-navigation';
import type {
  DashboardView as View,
  DetailTarget,
  DetailNavigationSnapshot,
} from '@/lib/detail-navigation';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  CircleAlert,
  Check,
  CheckCircle2,
  ChevronDown,
  X,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileWarning,
  FileText,
  FolderOpen,
  Leaf,
  LayoutDashboard,
  Link2,
  List,
  LockKeyhole,
  LogOut,
  Loader2,
  Mail,
  MapPin,
  MessageCircleMore,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  Inbox,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Warehouse,
  Users,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent as BaseDialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import {
  FARM_HISTORY_CHANNEL_LABELS,
  FARM_INBOX_STATUS_LABELS,
  FARM_PROJECT_DOCUMENT_CATEGORY_LABELS,
  FARM_PROJECT_DOCUMENT_STATUS_LABELS,
  FARM_PROJECT_STAGE_LABELS,
  FARM_PROJECT_STATUS_LABELS,
  FARM_PROJECT_TYPE_LABELS,
  FARM_PROJECT_UPDATE_KIND_LABELS,
  FARM_SETTLEMENT_STATUS_LABELS,
  FARM_SUBSCRIPTION_EVENT_TYPE_LABELS,
  FARM_VISIT_STATUS_LABELS,
  FARM_WORK_STATUS_LABELS,
  FARM_WORK_PRIORITY_LABELS,
  FARM_WORK_TYPE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type Farm,
  type FarmHistoryEntry,
  type AddFarmHistoryEntryInput,
  type FarmInboxItem,
  type FarmInput,
  type FarmLedgerWorkspace,
  type FarmProjectInput,
  type FarmProject,
  type FarmProjectDocument,
  type FarmProjectDocumentCategory,
  type FarmProjectDocumentInput,
  type FarmProjectDocumentStatus,
  type FarmProjectUpdate,
  type FarmProjectUpdateKind,
  type FarmProjectStatus,
  type FarmProjectStage,
  type FarmProjectType,
  type FarmSettlementStatus,
  type FarmRecord,
  type FarmRecordInput,
  type FarmSubscriptionEventType,
  type FarmVisitStatus,
  type FarmWorkItem,
  type FarmWorkVisit,
  type FarmWorkPriority,
  type SubscriptionStatus,
} from '@/lib/farm-types';
import {
  farmLedgerFetch,
  subscribeFarmLedgerWorkspace,
  waitForFarmLedgerSync,
} from '@/lib/firebase/farm-ledger-store';
import { registerFarmLedgerTools } from '@/lib/webmcp/farm-ledger-tools';
import {
  isProjectTask,
  isOperationalWork,
  workProjectId,
} from '@/lib/project-work';
import type { ReceivedImage } from '@/lib/received-images';
import { ReceivedContentInput, ReceivedImages } from './received-images';
import { ProjectTaskDetail } from './project-task-detail';
import { OrganizationManagement } from './organization-management';
import { TaskRegistrationDialog } from './task-registration-dialog';
import { useOrganization } from '@/lib/firebase/organization-store';
import type { AppMember } from '@/lib/organization';
import {
  isInternalTask,
  isStandaloneWork,
  isHeadPriority,
} from '@/lib/project-work';
import {
  WorkTaskSurface,
  WorkQuickEditor,
  ChildTaskForm,
} from './work-task-controls';
import {
  buildWorkHierarchy,
  summarizeWorkHierarchy,
} from '@/lib/work-hierarchy';
import {
  farmRecordsInContext,
  hasProjectParticipation,
  workMatchesScope,
  type WorkListScope,
} from '@/lib/workspace-navigation';
import {
  paymentEvidenceByRecord,
  filterProjectsByScope,
  filterSubscriptionsByScope,
  subscriptionCycle,
  subscriptionPaymentCount,
  summarizeProjectKpis,
  summarizeSubscriptionCycles,
} from '@/lib/dashboard-kpis';
import {
  buildRenewalReport,
  groupRenewalCycles,
} from '@/lib/subscription-renewal-report';
import { SubscriptionRenewalPanel } from './subscription-renewal-panel';
import { SubscriptionPaymentYearPanel } from './subscription-payment-year-panel';
import {
  buildPaymentYearReport,
  paymentYearReportLines,
} from '@/lib/subscription-payment-report';
import { SubscriptionPaymentPreview } from './subscription-payment-preview';
import {
  calculateSubscriptionPayment,
  type SubscriptionPaymentRequest,
} from '@/lib/subscription-payment';
import {
  ProjectKpiPanel,
  ProjectTypeSelector,
  ProjectYearSelector,
  SubscriptionCyclePanel,
} from './farm-kpi-panels';

type DetailTrailEntry = {
  target: DetailTarget;
  scrollY: number;
  focusElement: HTMLElement | null;
  projectTab: string;
  farmTab: string;
};
type DialogKind =
  | 'farm'
  | 'farm_edit'
  | 'record_add'
  | 'record_edit'
  | 'project'
  | 'project_document'
  | 'project_update'
  | 'project_blocker_resolve'
  | 'subscription_event'
  | 'subscription_expiry'
  | 'work_item'
  | 'inbox'
  | 'inbox_route'
  | 'history'
  | 'visit'
  | null;
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<'form'>['onSubmit']>
>[0];
type WorkType = FarmWorkItem['workType'];
type WorkStatus = FarmWorkItem['status'];
type WorkMode = 'inbox' | 'control' | 'board' | 'list' | 'review';
type SubscriptionMode = 'management' | 'report';
type HistoryChannel = FarmHistoryEntry['channel'];

function DialogContent({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof BaseDialogContent>, 'className'> & {
  className?: string;
}) {
  return (
    <BaseDialogContent
      {...props}
      showCloseButton={false}
      className={`farm-app farm-dialog ${className ?? ''}`}
    >
      {children}
      <DialogClose
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="닫기"
            className="absolute right-2 top-2 z-30"
          />
        }
      >
        <X />
      </DialogClose>
    </BaseDialogContent>
  );
}

const FARM_LOG_TYPE_LABELS = FARM_WORK_TYPE_LABELS;
const FARM_LOG_STATUS_LABELS = FARM_WORK_STATUS_LABELS;
const FARM_LOG_CHANNEL_LABELS = FARM_HISTORY_CHANNEL_LABELS;
const SUBSCRIPTION_PAGE_SIZE = 20;
const SUBSCRIPTION_FILTER_LABELS: Record<
  'all' | 'unsubscribed' | SubscriptionStatus,
  string
> = {
  all: '모든 구독',
  active: '구독 중',
  unsubscribed: '미구독 전체',
  expired: '만료',
  unregistered: '미등록',
};

interface FarmForm extends FarmInput, FarmRecordInput {
  recorder: string;
}

type ProjectDocumentForm = FarmProjectDocumentInput;

interface ProjectUpdateForm {
  kind: Exclude<FarmProjectUpdateKind, 'system'>;
  title: string;
  channel: HistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: string;
  referenceUrl: string;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
}

interface ProjectBlockerResolutionForm {
  resolution: string;
  resolvedBy: string;
}

interface HistoryDraft {
  channel: HistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  amount: number;
  recorder: string;
  occurredAt: string;
  referenceUrl: string;
}

interface WorkItemForm extends HistoryDraft {
  paymentOperationId: string;
  farmRecordId: string;
  workType: WorkType;
  title: string;
  status: WorkStatus;
  owner: string;
  dueDate: string;
  description: string;
  expectedOutcome: string;
  nextAction: string;
  priority: FarmWorkPriority;
  reviewDate: string;
  responseDueAt: string;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
  checklistText: string;
}

interface HistoryForm extends HistoryDraft {
  paymentOperationId: string;
  newStatus: WorkStatus;
  nextAction: string;
  priority: FarmWorkPriority;
  reviewDate: string;
  owner: string;
  dueDate: string;
  expectedOutcome: string;
  responseDueAt: string;
  markResponded: boolean;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
}

interface VisitForm {
  id: string;
  scheduledAt: string;
  assignedTo: string;
  status: FarmVisitStatus;
  actualStartedAt: string;
  actualEndedAt: string;
  preparationNote: string;
  result: string;
  nextVisitAt: string;
  recordedBy: string;
}

interface SubscriptionEventForm {
  farmRecordId: string;
  expectedCurrentExpiryDate: string;
  expectedUpdatedAt: number;
  eventType: FarmSubscriptionEventType;
  basisExpiryDate: string;
  basisRenewalCount: string;
  processedAt: string;
  newExpiryDate: string;
  recorder: string;
  note: string;
}

interface SubscriptionExpiryForm {
  farmRecordId: string;
  expectedCurrentExpiryDate: string;
  expectedUpdatedAt: number;
  expiryDate: string;
  recorder: string;
  note: string;
}

interface InboxForm {
  projectId: string;
  taskTitle: string;
  operationId: string;
  channel: HistoryChannel;
  sender: string;
  content: string;
  capturedBy: string;
  receivedAt: string;
  referenceUrl: string;
}

interface QualityIssue {
  id: string;
  farmId: string;
  projectId?: string;
  category: 'duplicate' | 'contact' | 'installation' | 'subscription';
  title: string;
  description: string;
  severity: 'high' | 'medium';
}

const emptyWorkspace: FarmLedgerWorkspace = {
  projects: [],
  projectDocuments: [],
  projectUpdates: [],
  farms: [],
  records: [],
  subscriptionEvents: [],
  inboxItems: [],
  workItems: [],
  blockerEpisodes: [],
  visits: [],
  checklistItems: [],
  historyEntries: [],
};

const WORK_CHECKLIST_TEMPLATES: Partial<Record<WorkType, string[]>> = {
  installation: [
    '현장 일정과 출입 방법 확인',
    '설치 전 전원·통신 환경 확인',
    '이상 사항과 사진 링크 기록',
    '다음 점검 담당자·날짜 지정',
  ],
  service: [
    '증상과 발생 시점 확인',
    '원인·조치 내용 기록',
    '농가 정상 동작 확인',
    '후속 확인일 지정',
  ],
  subscription: [
    '갱신 조건을 농가에 안내',
    '의사 결정자와 회신 기한 확인',
    '입금 확인 요청 전달',
    '다음 확인 담당자·날짜 지정',
  ],
  payment: [
    '입금 근거 링크·메모 남기기',
    '대상 농가·사업 확인',
    '회계 담당자에게 반영 요청',
  ],
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function dateWithOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function responseTargetValue(
  priority: FarmWorkPriority = 'medium',
  base = new Date(),
) {
  const hours = priority === 'high' ? 24 : priority === 'medium' ? 72 : 168;
  return localDateTimeValue(new Date(base.getTime() + hours * 3600000));
}

function addYears(dateValue: string, years: number) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  date.setFullYear(date.getFullYear() + years);
  date.setDate(date.getDate() - 1);
  return localDateString(date);
}

function formatDate(value: string) {
  if (!value) return '미입력';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function formatTimestamp(value: number, compact = false) {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  if (localDateString(date) === localDateString()) return `오늘 ${time}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDateString(date) === localDateString(yesterday))
    return `어제 ${time}`;
  return new Intl.DateTimeFormat('ko-KR', {
    ...(compact ? {} : { year: 'numeric' as const }),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

function daysUntil(dateValue: string) {
  if (!dateValue) return null;
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  const today = new Date(`${localDateString()}T00:00:00`).getTime();
  return Math.round((target - today) / 86400000);
}

function dueLabel(dateValue: string, completed = false) {
  if (completed) return '완료';
  const days = daysUntil(dateValue);
  if (days === null) return '기한 없음';
  if (days < 0) return `${Math.abs(days)}일 지연`;
  if (days === 0) return '오늘 마감';
  return `D-${days}`;
}

function dueClass(dateValue: string, completed = false) {
  if (completed) return 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]';
  const days = daysUntil(dateValue);
  if (days !== null && days < 0)
    return 'border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]';
  if (days !== null && days <= 7)
    return 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]';
  return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
}

type ResponseRisk =
  | 'none'
  | 'stable'
  | 'warning'
  | 'urgent'
  | 'breached'
  | 'achieved'
  | 'failed';

function responseRisk(
  workItem: FarmWorkItem,
  referenceTimestamp: number,
): ResponseRisk {
  if (!workItem.responseDueAt) return 'none';
  if (workItem.respondedAt) {
    return workItem.respondedAt <= workItem.responseDueAt
      ? 'achieved'
      : 'failed';
  }
  const hours = (workItem.responseDueAt - referenceTimestamp) / 3600000;
  if (hours < 0) return 'breached';
  if (hours <= 24) return 'urgent';
  if (hours <= 72) return 'warning';
  return 'stable';
}

function responseRiskLabel(risk: ResponseRisk) {
  return {
    none: '응답 목표 없음',
    stable: '응답 여유',
    warning: '응답 주의',
    urgent: '24시간 이내',
    breached: '응답 목표 초과',
    achieved: '응답 목표 달성',
    failed: '응답 목표 실패',
  }[risk];
}

function responseRiskClass(risk: ResponseRisk) {
  if (risk === 'breached' || risk === 'failed')
    return 'border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]';
  if (risk === 'urgent') return 'border-[#ead0b2] bg-[#fff5e8] text-[#9c5c12]';
  if (risk === 'warning') return 'border-[#eadfba] bg-[#fffbea] text-[#8b6a20]';
  if (risk === 'achieved')
    return 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]';
  return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
}

const RESPONSE_RISK_ORDER: Record<ResponseRisk, number> = {
  breached: 0,
  urgent: 1,
  warning: 2,
  failed: 3,
  stable: 4,
  none: 5,
  achieved: 6,
};

function compareServiceWorkItems(
  left: FarmWorkItem,
  right: FarmWorkItem,
  referenceTimestamp: number,
) {
  const completionOrder =
    Number(left.status === 'completed') - Number(right.status === 'completed');
  if (completionOrder) return completionOrder;

  const riskOrder =
    RESPONSE_RISK_ORDER[responseRisk(left, referenceTimestamp)] -
    RESPONSE_RISK_ORDER[responseRisk(right, referenceTimestamp)];
  if (riskOrder) return riskOrder;

  if (left.status === 'waiting' && right.status === 'waiting') {
    const blockedOrder =
      (left.blockedAt || left.updatedAt) - (right.blockedAt || right.updatedAt);
    if (blockedOrder) return blockedOrder;
  }

  return right.lastActivityAt - left.lastActivityAt;
}

function elapsedDays(timestamp: number) {
  if (!timestamp) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value.trim() || '미입력';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko-KR'),
    );
}

function normalizedLedgerLabel(value: string, fallback: string) {
  return value.trim().replace(/\s+/g, ' ') || fallback;
}

function farmCropLabels(records: FarmRecord[]) {
  const labels = Array.from(
    new Set(
      records
        .map((record) => normalizedLedgerLabel(record.crop, ''))
        .filter(Boolean),
    ),
  );
  return labels.length ? labels : ['작목 미입력'];
}

function effectiveRecordSubscriptionStatus(
  record: FarmRecord,
  today: string,
): SubscriptionStatus {
  if (
    record.subscriptionStatus === 'active' &&
    Boolean(record.currentSubscriptionExpiresAt) &&
    record.currentSubscriptionExpiresAt >= today
  ) {
    return 'active';
  }
  if (
    record.subscriptionStatus === 'expired' ||
    (Boolean(record.currentSubscriptionExpiresAt) &&
      record.currentSubscriptionExpiresAt < today)
  ) {
    return 'expired';
  }
  return 'unregistered';
}

function effectiveFarmSubscriptionStatus(
  records: FarmRecord[],
  today: string,
): SubscriptionStatus {
  if (
    records.some(
      (record) => effectiveRecordSubscriptionStatus(record, today) === 'active',
    )
  ) {
    return 'active';
  }
  if (
    records.some(
      (record) =>
        effectiveRecordSubscriptionStatus(record, today) === 'expired',
    )
  ) {
    return 'expired';
  }
  return 'unregistered';
}

function emptyProjectForm(): FarmProjectInput {
  return {
    name: '',
    projectType: 'general',
    year: new Date().getFullYear(),
    institution: '',
    status: 'active',
    description: '',
    targetFarmCount: 0,
    manager: '',
    startDate: localDateString(),
    endDate: dateWithOffset(180),
    currentStage: 'agreement',
    settlementStatus: 'not_started',
    settlementDueDate: dateWithOffset(210),
    contractAmount: 0,
    settlementClaimAmount: 0,
    settlementApprovedAmount: 0,
    settlementPaidAmount: 0,
    settledAt: '',
    settlementOwner: '',
    settlementEvidenceUrl: '',
    settlementNote: '',
    settlementRounds: { first: emptySettlement(), second: emptySettlement() },
  };
}

function emptyProjectDocumentForm(owner = ''): ProjectDocumentForm {
  return {
    title: '',
    category: 'agreement',
    isRequired: true,
    status: 'not_started',
    owner,
    currentHandler: owner,
    dueDate: '',
    submittedAt: '',
    approvedAt: '',
    referenceUrl: '',
    revision: 1,
    note: '',
  };
}

function emptyProjectUpdateForm(owner = ''): ProjectUpdateForm {
  return {
    kind: 'communication',
    title: '',
    channel: 'email',
    sender: '',
    receivedContent: '',
    actionContent: '',
    recorder: owner,
    occurredAt: localDateTimeValue(),
    referenceUrl: '',
    blockedReason: '',
    blockedBy: '',
    expectedUnblockDate: '',
  };
}

function emptyFarmForm(projectId: string): FarmForm {
  return {
    farmCode: '',
    name: '',
    phone: '',
    address: '',
    region: '',
    businessNumber: '',
    folderUrl: '',
    locationUrl: '',
    specialNotes: '',
    projectId,
    crop: '',
    deviceType: '',
    productType: '',
    vendor: '',
    productionSetupDate: '',
    installationDate: '',
    commissioningDate: '',
    educationDate: '',
    internetType: '',
    warrantyYears: 1,
    warrantyExpiresAt: '',
    subscriptionYears: 1,
    initialSubscriptionExpiresAt: '',
    currentSubscriptionExpiresAt: '',
    lastPaymentDate: '',
    renewalCount: 0,
    subscriptionStatus: 'unregistered',
    notes: '',
    recorder: '',
  };
}

function emptyHistoryDraft(): HistoryDraft {
  return {
    channel: 'phone',
    sender: '',
    receivedContent: '',
    actionContent: '',
    amount: 0,
    recorder: '',
    occurredAt: localDateTimeValue(),
    referenceUrl: '',
  };
}

function emptyWorkItemForm(farmRecordId = ''): WorkItemForm {
  return {
    paymentOperationId: crypto.randomUUID(),
    ...emptyHistoryDraft(),
    farmRecordId,
    workType: 'communication',
    title: '',
    status: 'open',
    owner: '',
    dueDate: dateWithOffset(7),
    description: '',
    expectedOutcome: '',
    nextAction: '',
    priority: 'medium',
    reviewDate: dateWithOffset(3),
    responseDueAt: responseTargetValue('medium'),
    blockedReason: '',
    blockedBy: '',
    expectedUnblockDate: '',
    checklistText: '',
  };
}

function emptyHistoryForm(
  status: WorkStatus = 'in_progress',
  nextAction = '',
  priority: FarmWorkPriority = 'medium',
  reviewDate = '',
  owner = '',
  dueDate = '',
  expectedOutcome = '',
  responseDueAt = '',
  blockedReason = '',
  blockedBy = '',
  expectedUnblockDate = '',
): HistoryForm {
  return {
    paymentOperationId: crypto.randomUUID(),
    ...emptyHistoryDraft(),
    newStatus: status,
    nextAction,
    priority,
    reviewDate,
    owner,
    dueDate,
    expectedOutcome,
    responseDueAt,
    markResponded: false,
    blockedReason,
    blockedBy,
    expectedUnblockDate,
  };
}

function emptyVisitForm(owner = '', scheduledAt = ''): VisitForm {
  return {
    id: '',
    scheduledAt:
      scheduledAt || localDateTimeValue(new Date(Date.now() + 86400000)),
    assignedTo: owner,
    status: 'scheduled',
    actualStartedAt: '',
    actualEndedAt: '',
    preparationNote: '',
    result: '',
    nextVisitAt: '',
    recordedBy: owner,
  };
}

function emptyInboxForm(): InboxForm {
  return {
    projectId: '',
    taskTitle: '',
    operationId: crypto.randomUUID(),
    channel: 'kakao',
    sender: '',
    content: '',
    capturedBy: '',
    receivedAt: localDateTimeValue(),
    referenceUrl: '',
  };
}

function emptySubscriptionEventForm(
  record?: FarmRecord,
  recorder = '',
): SubscriptionEventForm {
  return {
    farmRecordId: record?.id ?? '',
    expectedCurrentExpiryDate: record?.currentSubscriptionExpiresAt ?? '',
    expectedUpdatedAt: record?.updatedAt ?? 0,
    eventType: 'renewed',
    basisExpiryDate: record?.currentSubscriptionExpiresAt ?? '',
    basisRenewalCount: '',
    processedAt: localDateString(),
    newExpiryDate: record?.currentSubscriptionExpiresAt
      ? addYears(record.currentSubscriptionExpiresAt, 1)
      : '',
    recorder,
    note: '',
  };
}

function emptySubscriptionExpiryForm(
  record?: FarmRecord,
  recorder = '',
): SubscriptionExpiryForm {
  return {
    farmRecordId: record?.id ?? '',
    expectedCurrentExpiryDate: record?.currentSubscriptionExpiresAt ?? '',
    expectedUpdatedAt: record?.updatedAt ?? 0,
    expiryDate: record?.currentSubscriptionExpiresAt ?? '',
    recorder,
    note: '',
  };
}

function subscriptionClass(status: SubscriptionStatus) {
  if (status === 'active')
    return 'border-[#bfe3cb] bg-[#edf8f1] text-[#28744f]';
  if (status === 'expired')
    return 'border-[#f0cdbb] bg-[#fff4ed] text-[#ac5a32]';
  return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
}

function projectStatusClass(status: FarmProjectStatus) {
  if (status === 'active')
    return 'border-[#bfe3cb] bg-[#edf8f1] text-[#28744f]';
  if (status === 'on_hold')
    return 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]';
  return 'border-[#d6dde8] bg-[#f2f5f9] text-[#5f6f83]';
}

function workStatusClass(status: WorkStatus) {
  if (status === 'completed')
    return 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]';
  if (status === 'in_progress')
    return 'border-[#c9d9ef] bg-[#f0f5fb] text-[#416c9c]';
  if (status === 'waiting')
    return 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]';
  return 'border-[#f0cdbb] bg-[#fff4ed] text-[#a75b35]';
}

function workPriorityClass(priority: FarmWorkPriority) {
  if (priority === 'high')
    return 'border-[#efc8bb] bg-[#fff1ec] text-[#a94f32]';
  if (priority === 'low') return 'border-[#d8dfdc] bg-[#f5f7f6] text-[#6d7972]';
  return 'border-[#d7d8b8] bg-[#fbfaed] text-[#7d762d]';
}

function visitStatusClass(status: FarmVisitStatus) {
  if (status === 'completed')
    return 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]';
  if (status === 'canceled')
    return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
  return 'border-[#c9d9ef] bg-[#f0f5fb] text-[#416c9c]';
}

function WorkIcon({
  type,
  className = 'size-4',
}: {
  type: WorkType;
  className?: string;
}) {
  if (type === 'service') return <Wrench className={className} />;
  if (type === 'payment') return <CreditCard className={className} />;
  if (type === 'installation') return <CalendarCheck2 className={className} />;
  if (type === 'subscription') return <CalendarClock className={className} />;
  if (type === 'communication')
    return <MessageSquareText className={className} />;
  return <FileText className={className} />;
}

function ChannelIcon({
  channel,
  className = 'size-4',
}: {
  channel: HistoryChannel;
  className?: string;
}) {
  if (channel === 'email') return <Mail className={className} />;
  if (channel === 'kakao') return <MessageCircleMore className={className} />;
  if (channel === 'phone') return <Phone className={className} />;
  if (channel === 'verbal' || channel === 'meeting')
    return <MessageSquareText className={className} />;
  return <FileText className={className} />;
}

function installProgress(record: FarmRecord) {
  const stages = [
    isFarmStageComplete(record, 'installationDate'),
    isFarmStageComplete(record, 'commissioningDate'),
    isFarmStageComplete(record, 'educationDate'),
  ];
  return { complete: stages.filter(Boolean).length, total: stages.length };
}

function averageRates(...values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null);
  return usable.length
    ? Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length)
    : null;
}

function documentCategoryProgress(
  documents: FarmProjectDocument[],
  category: FarmProjectDocumentCategory,
) {
  const items = documents.filter(
    (document) => document.category === category && document.isRequired,
  );
  return items.length
    ? Math.round(
        (items.filter((document) => document.status === 'approved').length /
          items.length) *
          100,
      )
    : null;
}

async function readResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & { error?: string };
}

function localizedProjectActionContent(
  activity: FarmProjectUpdate | FarmHistoryEntry | null | undefined,
) {
  if (!activity?.actionContent) return '';
  if (
    !('kind' in activity) ||
    activity.kind !== 'system' ||
    activity.title !== '제출서류 수정'
  ) {
    return activity.actionContent;
  }
  return activity.actionContent.replace(
    /\b(not_started|preparing|submitted|reviewing|revision|approved|rejected)\b/g,
    (status) =>
      FARM_PROJECT_DOCUMENT_STATUS_LABELS[status as FarmProjectDocumentStatus],
  );
}

interface FarmLedgerDashboardProps {
  member?: AppMember | null;
  accountName: string;
  accountEmail: string;
  onSignOut: () => void;
}

export function FarmLedgerDashboard({
  accountName,
  accountEmail,
  member = null,
  onSignOut,
}: FarmLedgerDashboardProps) {
  const organization = useOrganization(member);
  const [taskRegistrationOpen, setTaskRegistrationOpen] = useState(false);
  const [workSourceFilter, setWorkSourceFilter] = useState<
    'all' | 'internal' | 'project'
  >('all');
  const [workAccountFilter, setWorkAccountFilter] = useState<
    'all' | 'mine' | 'department' | 'head'
  >('all');
  const [workspace, setWorkspace] =
    useState<FarmLedgerWorkspace>(emptyWorkspace);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riskNow, setRiskNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewProjectStatus, setOverviewProjectStatus] = useState<
    'all' | FarmProjectStatus
  >('all');
  const [overviewExpandedTaskProjects, setOverviewExpandedTaskProjects] =
    useState<string[]>([]);
  const [projectYearFilter, setProjectYearFilter] = useState(() =>
    localDateString().slice(0, 4),
  );
  const [projectTypeFilter, setProjectTypeFilter] = useState<
    'all' | FarmProjectType
  >('all');
  const [projectRiskFilter, setProjectRiskFilter] = useState<
    'all' | 'blocked' | 'documents' | 'subscription' | 'settlement'
  >('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<
    'all' | 'unsubscribed' | SubscriptionStatus
  >('all');
  const [farmCropFilter, setFarmCropFilter] = useState('all');
  const [farmRegionFilter, setFarmRegionFilter] = useState('all');
  const [workSearch, setWorkSearch] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | WorkType>('all');
  const [workStatusFilter, setWorkStatusFilter] = useState<'all' | WorkStatus>(
    'all',
  );
  const [workMode, setWorkMode] = useState<WorkMode>('board');
  const [businessYearFilter, setBusinessYearFilter] = useState('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<
    'all' | FarmProjectType
  >('all');
  const [subscriptionReportYear, setSubscriptionReportYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [subscriptionReportProjectType, setSubscriptionReportProjectType] =
    useState<'all' | FarmProjectType>('all');
  const [subscriptionListProjectId, setSubscriptionListProjectId] =
    useState('all');
  const [subscriptionListProjectType, setSubscriptionListProjectType] =
    useState<'all' | FarmProjectType>('all');
  const [subscriptionMode, setSubscriptionMode] =
    useState<SubscriptionMode>('management');
  const [subscriptionListSearch, setSubscriptionListSearch] = useState('');
  const [subscriptionListStatus, setSubscriptionListStatus] = useState<
    'all' | SubscriptionStatus
  >('all');
  const [subscriptionListPage, setSubscriptionListPage] = useState(1);
  const [subscriptionFocus, setSubscriptionFocus] = useState<{
    recordIds: string[];
    label: string;
  } | null>(null);
  const [qualityFocus, setQualityFocus] = useState<{
    issueIds: string[];
    label: string;
  } | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('');
  const [farmContextProjectId, setFarmContextProjectId] = useState('');
  const [projectDetailTab, setProjectDetailTab] = useState('summary');
  const [farmDetailTab, setFarmDetailTab] = useState('work');
  const [workScope, setWorkScope] = useState<WorkListScope | null>(null);
  const [detailTrail, setDetailTrail] = useState<DetailTrailEntry[]>([]);
  const listScrollYRef = useRef(0);
  const listFocusRef = useRef<HTMLElement | null>(null);
  const pendingNavigationScrollRef = useRef<number | null>(null);
  const detailNavigation = useDetailNavigation(
    captureDetailNavigation,
    restoreDetailNavigation,
    canGoBackDetail,
  );
  const [editingProjectId, setEditingProjectId] = useState('');
  const [editingProjectDocumentId, setEditingProjectDocumentId] = useState('');
  const [resolvingProjectUpdateId, setResolvingProjectUpdateId] = useState('');
  const [editingRecordId, setEditingRecordId] = useState('');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [childTaskParent, setChildTaskParent] = useState<FarmWorkItem | null>(
    null,
  );
  const [childTaskBusy, setChildTaskBusy] = useState(false);
  const [quickDetailTaskId, setQuickDetailTaskId] = useState('');
  const [quickDetailBusy, setQuickDetailBusy] = useState(false);
  const [workQuickEditOpen, setWorkQuickEditOpen] = useState(false);
  const [workDeletionTarget, setWorkDeletionTarget] =
    useState<FarmWorkItem | null>(null);
  const [projectDeletionTarget, setProjectDeletionTarget] =
    useState<FarmProject | null>(null);
  const [deletedProjectToClose, setDeletedProjectToClose] = useState('');
  useEffect(() => {
    if (projectDeletionTarget || !deletedProjectToClose) return;
    setDeletedProjectToClose('');
    if (selectedProjectId === deletedProjectToClose) closeDetails();
  }, [projectDeletionTarget, deletedProjectToClose]);
  const projectExpectedVersion = useRef(0);
  const [projectForm, setProjectForm] =
    useState<FarmProjectInput>(emptyProjectForm);
  const [projectDocumentForm, setProjectDocumentForm] =
    useState<ProjectDocumentForm>(() => emptyProjectDocumentForm());
  const [projectUpdateForm, setProjectUpdateForm] = useState<ProjectUpdateForm>(
    () => emptyProjectUpdateForm(),
  );
  const [projectBlockerResolutionForm, setProjectBlockerResolutionForm] =
    useState<ProjectBlockerResolutionForm>({ resolution: '', resolvedBy: '' });
  const [farmForm, setFarmForm] = useState<FarmForm>(() => emptyFarmForm(''));
  const [farmLocationImages, setFarmLocationImages] = useState<ReceivedImage[]>(
    [],
  );
  const [farmLocationIds, setFarmLocationIds] = useState<string[]>([]);
  const [farmLocationExpectedIds, setFarmLocationExpectedIds] = useState<
    string[]
  >([]);
  const [farmLocationBusy, setFarmLocationBusy] = useState(false);
  const farmSaveBusyRef = useRef(false);
  const farmImageBusyRef = useRef(false);
  const [editingFarmId, setEditingFarmId] = useState('');
  const [editingFarmVersion, setEditingFarmVersion] = useState(0);
  const [workItemForm, setWorkItemForm] = useState<WorkItemForm>(() =>
    emptyWorkItemForm(),
  );
  const [historyForm, setHistoryForm] = useState<HistoryForm>(() =>
    emptyHistoryForm(),
  );
  const historyExpectedVersion = useRef<number | undefined>(undefined);
  const [visitForm, setVisitForm] = useState<VisitForm>(() => emptyVisitForm());
  const [inboxForm, setInboxForm] = useState<InboxForm>(() => emptyInboxForm());
  const [draftImages, setDraftImages] = useState<ReceivedImage[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [inboxRouteProjectId, setInboxRouteProjectId] = useState('');
  const [subscriptionEventForm, setSubscriptionEventForm] =
    useState<SubscriptionEventForm>(() => emptySubscriptionEventForm());
  const [subscriptionExpiryForm, setSubscriptionExpiryForm] =
    useState<SubscriptionExpiryForm>(() => emptySubscriptionExpiryForm());
  const [clarifyingInboxId, setClarifyingInboxId] = useState('');
  const [inboxRouteFarmId, setInboxRouteFarmId] = useState('');
  const [inboxRouteRecordId, setInboxRouteRecordId] = useState('');
  const [inboxFarmSearch, setInboxFarmSearch] = useState('');
  const [checklistActor, setChecklistActor] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);
  const [subscriptionEpoch, setSubscriptionEpoch] = useState(0);
  const workspaceRef = useRef(workspace);
  const paymentRequestsRef = useRef(
    new Map<string, SubscriptionPaymentRequest>(),
  );

  useEffect(() => {
    if (loading || pendingNavigationScrollRef.current === null) return;
    const top = pendingNavigationScrollRef.current;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: 'auto' });
      pendingNavigationScrollRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [
    loading,
    detailTrail,
    view,
    selectedProjectId,
    selectedFarmId,
    selectedWorkItemId,
  ]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    setSubscriptionEpoch((current) => current + 1);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeFarmLedgerWorkspace(
      (data) => {
        setWorkspace(data);
        setRiskNow(Date.now());
        setSelectedProjectId((current) =>
          data.projects.some((project) => project.id === current)
            ? current
            : '',
        );
        setSelectedFarmId((current) =>
          data.farms.some((farm) => farm.id === current) ? current : '',
        );
        setSelectedWorkItemId((current) =>
          data.workItems.some((workItem) => workItem.id === current)
            ? current
            : '',
        );
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsubscribe;
  }, [subscriptionEpoch]);

  useEffect(() => registerFarmLedgerTools(() => workspaceRef.current), []);

  useEffect(() => {
    const timer = window.setInterval(() => setRiskNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const recordsByFarm = useMemo(() => {
    const map = new Map<string, FarmRecord[]>();
    for (const record of workspace.records) {
      map.set(record.farmId, [...(map.get(record.farmId) ?? []), record]);
    }
    for (const records of map.values())
      records.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return map;
  }, [workspace.records]);

  const subscriptionToday = localDateString(new Date(riskNow));
  const farmLedgerSummary = useMemo(() => {
    const cropFarmIds = new Map<string, Set<string>>();
    const regionFarmIds = new Map<string, Set<string>>();
    let subscribed = 0;
    let expired = 0;
    let unregistered = 0;

    for (const farm of workspace.farms) {
      const records = recordsByFarm.get(farm.id) ?? [];
      const status = effectiveFarmSubscriptionStatus(
        records,
        subscriptionToday,
      );
      if (status === 'active') subscribed += 1;
      else if (status === 'expired') expired += 1;
      else unregistered += 1;

      for (const crop of farmCropLabels(records)) {
        const farmIds = cropFarmIds.get(crop) ?? new Set<string>();
        farmIds.add(farm.id);
        cropFarmIds.set(crop, farmIds);
      }

      const region = normalizedLedgerLabel(farm.region, '지역 미입력');
      const regionIds = regionFarmIds.get(region) ?? new Set<string>();
      regionIds.add(farm.id);
      regionFarmIds.set(region, regionIds);
    }

    const breakdown = (source: Map<string, Set<string>>) =>
      [...source.entries()]
        .map(([label, farmIds]) => ({ label, count: farmIds.size }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.label.localeCompare(right.label, 'ko-KR'),
        );
    const total = workspace.farms.length;
    return {
      total,
      subscribed,
      unsubscribed: total - subscribed,
      expired,
      unregistered,
      subscriptionRate: total ? Math.round((subscribed / total) * 100) : 0,
      crops: breakdown(cropFarmIds),
      regions: breakdown(regionFarmIds),
    };
  }, [recordsByFarm, subscriptionToday, workspace.farms]);

  const workItemsByFarm = useMemo(() => {
    const map = new Map<string, FarmWorkItem[]>();
    for (const workItem of workspace.workItems) {
      map.set(workItem.farmId, [...(map.get(workItem.farmId) ?? []), workItem]);
    }
    for (const workItems of map.values())
      workItems.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return map;
  }, [workspace.workItems]);

  const historiesByWorkItem = useMemo(() => {
    const map = new Map<string, FarmHistoryEntry[]>();
    for (const entry of workspace.historyEntries) {
      map.set(entry.workItemId, [...(map.get(entry.workItemId) ?? []), entry]);
    }
    for (const entries of map.values()) {
      entries.sort(
        (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
      );
    }
    return map;
  }, [workspace.historyEntries]);

  const checklistByWorkItem = useMemo(() => {
    const map = new Map<string, typeof workspace.checklistItems>();
    for (const item of workspace.checklistItems) {
      map.set(item.workItemId, [...(map.get(item.workItemId) ?? []), item]);
    }
    for (const items of map.values()) {
      items.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
      );
    }
    return map;
  }, [workspace.checklistItems]);

  const blockerEpisodesByWorkItem = useMemo(() => {
    const map = new Map<string, typeof workspace.blockerEpisodes>();
    for (const episode of workspace.blockerEpisodes) {
      map.set(episode.workItemId, [
        ...(map.get(episode.workItemId) ?? []),
        episode,
      ]);
    }
    for (const episodes of map.values()) {
      episodes.sort((a, b) => b.openedAt - a.openedAt);
    }
    return map;
  }, [workspace.blockerEpisodes]);

  const visitsByWorkItem = useMemo(() => {
    const map = new Map<string, FarmWorkVisit[]>();
    for (const visit of workspace.visits) {
      map.set(visit.workItemId, [...(map.get(visit.workItemId) ?? []), visit]);
    }
    for (const visits of map.values()) {
      visits.sort((a, b) => b.scheduledAt - a.scheduledAt);
    }
    return map;
  }, [workspace.visits]);

  const activeProjects = useMemo(
    () => workspace.projects.filter((project) => !project.deletedAt),
    [workspace.projects],
  );
  const deletedProjects = useMemo(
    () => workspace.projects.filter((project) => Boolean(project.deletedAt)),
    [workspace.projects],
  );
  const projectById = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project])),
    [workspace.projects],
  );
  const recordById = useMemo(
    () => new Map(workspace.records.map((record) => [record.id, record])),
    [workspace.records],
  );
  const farmById = useMemo(
    () => new Map(workspace.farms.map((farm) => [farm.id, farm])),
    [workspace.farms],
  );
  const workItemById = useMemo(
    () =>
      new Map(workspace.workItems.map((workItem) => [workItem.id, workItem])),
    [workspace.workItems],
  );
  const operationalWorkItems = useMemo(
    () =>
      workspace.workItems.filter((item) =>
        isOperationalWork(item, historiesByWorkItem.get(item.id)),
      ),
    [workspace.workItems, historiesByWorkItem],
  );
  const workHierarchy = useMemo(
    () => buildWorkHierarchy(operationalWorkItems),
    [operationalWorkItems],
  );
  const operationalLeafItems = workHierarchy.leaves;
  const documentsByProject = useMemo(() => {
    const map = new Map<string, FarmProjectDocument[]>();
    for (const document of workspace.projectDocuments) {
      map.set(document.projectId, [
        ...(map.get(document.projectId) ?? []),
        document,
      ]);
    }
    return map;
  }, [workspace.projectDocuments]);
  const updatesByProject = useMemo(() => {
    const map = new Map<string, FarmProjectUpdate[]>();
    for (const update of workspace.projectUpdates) {
      map.set(update.projectId, [...(map.get(update.projectId) ?? []), update]);
    }
    for (const updates of map.values()) {
      updates.sort(
        (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
      );
    }
    return map;
  }, [workspace.projectUpdates]);

  const selectedProject = projectById.get(selectedProjectId) ?? null;
  const selectedFarm = farmById.get(selectedFarmId) ?? null;
  const allSelectedRecords = selectedFarm
    ? (recordsByFarm.get(selectedFarm.id) ?? [])
    : [];
  const selectedRecords = farmRecordsInContext(
    allSelectedRecords,
    farmContextProjectId,
  );
  const selectedWorkItems = selectedFarm
    ? (workItemsByFarm.get(selectedFarm.id) ?? []).filter(
        (item) =>
          !farmContextProjectId ||
          selectedRecords.some((record) => record.id === item.farmRecordId),
      )
    : [];
  const selectedWorkItem = workItemById.get(selectedWorkItemId) ?? null;
  useEffect(() => {
    if (
      selectedWorkItem?.deletedAt &&
      !workDeletionTarget &&
      !dialog &&
      !quickDetailTaskId &&
      !workQuickEditOpen
    )
      closeDetails();
  }, [
    selectedWorkItem,
    workDeletionTarget,
    dialog,
    quickDetailTaskId,
    workQuickEditOpen,
  ]);
  const selectedServiceItems = selectedWorkItems.filter(
    (item) => isActiveWork(item) && item.workType === 'service',
  );
  const subscriptionExpiryRecord =
    recordById.get(subscriptionExpiryForm.farmRecordId) ?? null;
  const subscriptionExpiryFarm = subscriptionExpiryRecord
    ? (farmById.get(subscriptionExpiryRecord.farmId) ?? null)
    : null;
  const subscriptionExpiryProject = subscriptionExpiryRecord
    ? (projectById.get(subscriptionExpiryRecord.projectId) ?? null)
    : null;
  const selectedWorkHistory = selectedWorkItem
    ? (historiesByWorkItem.get(selectedWorkItem.id) ?? [])
    : [];
  const selectedChecklist = selectedWorkItem
    ? (checklistByWorkItem.get(selectedWorkItem.id) ?? [])
    : [];
  const selectedBlockerEpisodes = selectedWorkItem
    ? (blockerEpisodesByWorkItem.get(selectedWorkItem.id) ?? [])
    : [];
  const selectedVisits = selectedWorkItem
    ? (visitsByWorkItem.get(selectedWorkItem.id) ?? [])
    : [];

  function projectForWorkItem(workItem: FarmWorkItem) {
    return projectById.get(workProjectId(workItem, recordById)) ?? null;
  }

  function projectSelectLabel(projectId: string, includeYear = false) {
    const project = projectById.get(projectId);
    if (!project) return '사업 없음';
    return includeYear ? `${project.year} · ${project.name}` : project.name;
  }

  function farmSelectLabel(farmId: string) {
    const farm = farmById.get(farmId);
    return farm ? `${farm.name} · ${farm.farmCode}` : '농가 없음';
  }

  function recordSelectLabel(recordId: string) {
    const record = recordById.get(recordId);
    if (!record) return '사업 없음';
    return `${projectSelectLabel(record.projectId)} · ${record.deviceType || '장비 미입력'}`;
  }

  function subscriptionRecordSelectLabel(recordId: string) {
    const record = recordById.get(recordId);
    if (!record) return '농가·사업 없음';
    return `${farmById.get(record.farmId)?.name ?? '농가 없음'} · ${projectSelectLabel(record.projectId)} · ${record.currentSubscriptionExpiresAt || '만료일 미입력'}`;
  }

  function projectSnapshot(project: FarmProject) {
    const farmProgress = summarizeProjectFarms(workspace.records, project.id);
    const records = farmProgress.records;
    const workItems = workspace.workItems.filter(
      (item) =>
        isActiveWork(item) &&
        isProjectTask(item) &&
        item.projectId === project.id,
    );
    const hierarchy = summarizeWorkHierarchy(workItems);
    // Project activity includes farm records too; subtask progress uses workItems only.
    const workItemIds = new Set(
      workspace.workItems
        .filter((item) => workProjectId(item, recordById) === project.id)
        .map((item) => item.id),
    );
    const documents = documentsByProject.get(project.id) ?? [];
    const projectUpdates = updatesByProject.get(project.id) ?? [];
    const openProjectBlockers = projectUpdates.filter(
      (update) => update.kind === 'blocker' && !update.resolvedAt,
    );
    const requiredDocuments = documents.filter(
      (document) => document.isRequired,
    );
    const submittedDocuments = requiredDocuments.filter((document) =>
      Boolean(document.submittedAt || document.status === 'approved'),
    );
    const approvedDocuments = requiredDocuments.filter(
      (document) => document.status === 'approved',
    );
    const documentRisks = documents.filter((document) => {
      const due = daysUntil(document.dueDate);
      return (
        document.status === 'revision' ||
        document.status === 'rejected' ||
        (document.isRequired &&
          document.status !== 'approved' &&
          due !== null &&
          due < 0)
      );
    });
    const blockedItems = hierarchy.leaves.filter(
      (item) => item.status === 'waiting',
    );
    const activeSubscriptions = records.filter((record) => {
      const days = daysUntil(record.currentSubscriptionExpiresAt);
      return (
        record.subscriptionStatus === 'active' && days !== null && days >= 0
      );
    });
    const expiringSoon = activeSubscriptions.filter((record) => {
      const days = daysUntil(record.currentSubscriptionExpiresAt);
      return days !== null && days <= 90;
    });
    const expiredSubscriptions = records.filter((record) => {
      const days = daysUntil(record.currentSubscriptionExpiresAt);
      return (
        record.subscriptionStatus === 'expired' || (days !== null && days < 0)
      );
    });
    const missingSubscriptionExpiry = records.filter(
      (record) =>
        record.subscriptionStatus === 'active' &&
        !record.currentSubscriptionExpiresAt,
    );
    const rate = (complete: number, total: number) =>
      total ? Math.round((complete / total) * 100) : null;
    const farmCoverage = project.targetFarmCount
      ? Math.min(
          100,
          Math.round((records.length / project.targetFarmCount) * 100),
        )
      : null;
    const productionRate = rate(
      records.filter((record) => record.productionSetupDate).length,
      records.length,
    );
    const [installationRate, commissioningRate, educationRate] =
      farmProgress.stages.map((stage) => stage.rate);
    const subscriptionRate = rate(activeSubscriptions.length, records.length);
    const documentRate = rate(
      approvedDocuments.length,
      requiredDocuments.length,
    );
    const settlementProgress: Record<FarmSettlementStatus, number> = {
      not_started: 0,
      collecting: 20,
      submitted: 50,
      revision: 40,
      approved: 75,
      paid: 100,
      closed: 100,
    };
    const evidenceRates = [
      farmCoverage ?? 0,
      productionRate ?? 0,
      installationRate ?? 0,
      commissioningRate ?? 0,
      educationRate ?? 0,
      documentRate ?? 0,
      settlementProgress[project.settlementStatus],
    ];
    const overallProgress =
      project.status === 'completed'
        ? 100
        : Math.round(
            evidenceRates.reduce((sum, value) => sum + value, 0) /
              evidenceRates.length,
          );
    const projectFarmHistory = workspace.historyEntries
      .filter((entry) => workItemIds.has(entry.workItemId))
      .sort((a, b) => b.occurredAt - a.occurredAt);
    const recentHistory = projectFarmHistory.slice(0, 8);
    const recentActivity = [...projectUpdates, ...projectFarmHistory]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 12);
    const latestReceivedActivity = [...projectUpdates, ...projectFarmHistory]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .find((entry) => entry.receivedContent.trim());
    const latestActionActivity = [...projectUpdates, ...projectFarmHistory]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .find((entry) => entry.actionContent.trim());
    const latestActivityAt = Math.max(
      project.updatedAt,
      ...workItems.map((item) => item.lastActivityAt),
      ...projectFarmHistory.map((entry) => entry.occurredAt),
      ...projectUpdates.map((update) => update.occurredAt),
      ...documents.map((document) => document.updatedAt),
    );

    return {
      records,
      farmProgress,
      workItems,
      hierarchy,
      documents,
      projectUpdates,
      openProjectBlockers,
      requiredDocuments,
      submittedDocuments,
      approvedDocuments,
      documentRisks,
      blockedItems,
      activeSubscriptions,
      expiringSoon,
      expiredSubscriptions,
      missingSubscriptionExpiry,
      farmCoverage,
      productionRate,
      installationRate,
      commissioningRate,
      educationRate,
      subscriptionRate,
      documentRate,
      settlementProgress: settlementProgress[project.settlementStatus],
      overallProgress,
      recentHistory,
      recentActivity,
      latestReceivedActivity,
      latestActionActivity,
      latestActivityAt,
    };
  }

  const projectSnapshots = new Map(
    workspace.projects.map((project) => [project.id, projectSnapshot(project)]),
  );
  const yearProjects = filterProjectsByScope(
    activeProjects,
    projectYearFilter,
    projectTypeFilter,
  );
  const yearProjectKpis = summarizeProjectKpis(
    yearProjects,
    projectSnapshots,
    subscriptionToday,
  );

  const overviewQuery = overviewSearch.trim().toLocaleLowerCase('ko-KR');
  const overviewAllProjectRows = yearProjects
    .map((project) => {
      const snapshot = projectSnapshots.get(project.id)!;
      const workItems = [...snapshot.workItems].sort((left, right) => {
        const leftDays = daysUntil(left.dueDate);
        const rightDays = daysUntil(right.dueDate);
        const leftOverdue =
          left.status !== 'completed' && leftDays !== null && leftDays < 0;
        const rightOverdue =
          right.status !== 'completed' && rightDays !== null && rightDays < 0;
        const statusRank: Record<WorkStatus, number> = {
          waiting: 0,
          in_progress: 1,
          open: 2,
          completed: 3,
        };
        return (
          Number(rightOverdue) - Number(leftOverdue) ||
          statusRank[left.status] - statusRank[right.status] ||
          (left.dueDate || '9999').localeCompare(right.dueDate || '9999') ||
          right.lastActivityAt - left.lastActivityAt
        );
      });
      const counts = {
        open: snapshot.hierarchy.leaves.filter((item) => item.status === 'open')
          .length,
        inProgress: snapshot.hierarchy.leaves.filter(
          (item) => item.status === 'in_progress',
        ).length,
        waiting: snapshot.hierarchy.leaves.filter(
          (item) => item.status === 'waiting',
        ).length,
        completed: snapshot.hierarchy.leaves.filter(
          (item) => item.status === 'completed',
        ).length,
      };
      const overdue = snapshot.hierarchy.leaves.filter((item) => {
        const days = daysUntil(item.dueDate);
        return item.status !== 'completed' && days !== null && days < 0;
      }).length;
      const dueSoon = snapshot.hierarchy.leaves.filter((item) => {
        const days = daysUntil(item.dueDate);
        return (
          item.status !== 'completed' && days !== null && days >= 0 && days <= 7
        );
      }).length;
      const riskWorkItemCount = snapshot.hierarchy.leaves.filter((item) => {
        const days = daysUntil(item.dueDate);
        return (
          item.status === 'waiting' ||
          (item.status !== 'completed' && days !== null && days < 0)
        );
      }).length;
      const completionRate = snapshot.hierarchy.completionRate;
      const projectSearchableText = [
        project.name,
        project.institution,
        project.manager,
        FARM_PROJECT_STAGE_LABELS[project.currentStage],
      ]
        .join(' ')
        .toLocaleLowerCase('ko-KR');
      const searchableText = [
        projectSearchableText,
        ...workItems.flatMap((item) => [
          item.title,
          item.owner,
          item.nextAction,
          item.blockedReason,
          farmById.get(item.farmId)?.name ?? '',
        ]),
      ]
        .join(' ')
        .toLocaleLowerCase('ko-KR');
      return {
        project,
        snapshot,
        workItems,
        counts,
        overdue,
        dueSoon,
        completionRate,
        riskCount: riskWorkItemCount + snapshot.openProjectBlockers.length,
        projectSearchableText,
        searchableText,
      };
    })
    .sort((left, right) => {
      const projectRank: Record<FarmProjectStatus, number> = {
        active: 0,
        on_hold: 1,
        completed: 2,
      };
      return (
        projectRank[left.project.status] - projectRank[right.project.status] ||
        right.riskCount - left.riskCount ||
        right.snapshot.latestActivityAt - left.snapshot.latestActivityAt ||
        left.project.name.localeCompare(right.project.name, 'ko-KR')
      );
    });

  const overviewProjectRows = overviewAllProjectRows.filter(
    (row) =>
      (overviewProjectStatus === 'all' ||
        row.project.status === overviewProjectStatus) &&
      (!overviewQuery || row.searchableText.includes(overviewQuery)),
  );

  function latestEntryWith(
    workItem: FarmWorkItem,
    field: 'receivedContent' | 'actionContent',
  ) {
    return (
      (historiesByWorkItem.get(workItem.id) ?? []).find(
        (entry) =>
          entry[field].trim() ||
          (field === 'receivedContent' && entry.imageIds?.length),
      ) ?? null
    );
  }

  const farmLastActivity = useCallback(
    (farm: Farm) =>
      Math.max(
        farm.updatedAt,
        recordsByFarm.get(farm.id)?.[0]?.lastActivityAt ?? 0,
        workItemsByFarm.get(farm.id)?.[0]?.lastActivityAt ?? 0,
      ),
    [recordsByFarm, workItemsByFarm],
  );

  function primaryRecordForFarm(farm: Farm) {
    const records = recordsByFarm.get(farm.id) ?? [];
    return projectFilter === 'all'
      ? records[0]
      : (records.find((record) => record.projectId === projectFilter) ??
          records[0]);
  }

  function subscriptionRecordsForFarm(farm: Farm) {
    const records = recordsByFarm.get(farm.id) ?? [];
    const scoped =
      projectFilter === 'all'
        ? records
        : records.filter((record) => record.projectId === projectFilter);
    return [...scoped].sort((left, right) => {
      const leftMissing = left.currentSubscriptionExpiresAt ? 0 : 1;
      const rightMissing = right.currentSubscriptionExpiresAt ? 0 : 1;
      return (
        leftMissing - rightMissing ||
        left.currentSubscriptionExpiresAt.localeCompare(
          right.currentSubscriptionExpiresAt,
        ) ||
        left.id.localeCompare(right.id)
      );
    });
  }

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return workspace.farms
      .filter((farm) => {
        const records = recordsByFarm.get(farm.id) ?? [];
        const scopedRecords =
          projectFilter === 'all'
            ? records
            : records.filter((record) => record.projectId === projectFilter);
        const workItems = workItemsByFarm.get(farm.id) ?? [];
        const histories = workItems.flatMap(
          (workItem) => historiesByWorkItem.get(workItem.id) ?? [],
        );
        const text = [
          farm.farmCode,
          farm.name,
          farm.phone,
          farm.address,
          farm.region,
          farm.businessNumber,
          ...records.flatMap((record) => [
            record.crop,
            record.deviceType,
            record.productType,
            record.vendor,
            projectById.get(record.projectId)?.name ?? '',
          ]),
          ...workItems.flatMap((workItem) => [
            workItem.title,
            workItem.owner,
            workItem.description,
          ]),
          ...histories.flatMap((entry) => [
            entry.receivedContent,
            entry.actionContent,
            entry.sender,
          ]),
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        const matchesProject =
          projectFilter === 'all' || scopedRecords.length > 0;
        const effectiveSubscriptionStatus = effectiveFarmSubscriptionStatus(
          scopedRecords,
          subscriptionToday,
        );
        const matchesSubscription =
          subscriptionFilter === 'all' ||
          (subscriptionFilter === 'unsubscribed'
            ? effectiveSubscriptionStatus !== 'active'
            : effectiveSubscriptionStatus === subscriptionFilter);
        const crops = farmCropLabels(scopedRecords);
        const matchesCrop =
          farmCropFilter === 'all' || crops.includes(farmCropFilter);
        const region = normalizedLedgerLabel(farm.region, '지역 미입력');
        const matchesRegion =
          farmRegionFilter === 'all' || region === farmRegionFilter;
        return (
          (!query || text.includes(query)) &&
          matchesProject &&
          matchesSubscription &&
          matchesCrop &&
          matchesRegion
        );
      })
      .sort((a, b) => farmLastActivity(b) - farmLastActivity(a));
  }, [
    historiesByWorkItem,
    farmLastActivity,
    farmCropFilter,
    farmRegionFilter,
    projectById,
    projectFilter,
    recordsByFarm,
    search,
    subscriptionFilter,
    subscriptionToday,
    workItemsByFarm,
    workspace.farms,
  ]);

  const filteredWorkItems = useMemo(() => {
    const query = workSearch.trim().toLocaleLowerCase('ko-KR');
    return operationalWorkItems
      .filter((workItem) => {
        if (workScope && !isProjectTask(workItem)) return false;
        if (workSourceFilter === 'internal' && !isInternalTask(workItem))
          return false;
        if (workSourceFilter === 'project' && isInternalTask(workItem))
          return false;
        if (workAccountFilter === 'mine' && workItem.assigneeUid !== member?.id)
          return false;
        if (
          workAccountFilter === 'department' &&
          (!member?.departmentId ||
            workItem.departmentId !== member.departmentId)
        )
          return false;
        if (
          workAccountFilter === 'head' &&
          (!isHeadPriority(workItem) || workItem.assigneeUid !== member?.id)
        )
          return false;
        if (
          workScope &&
          workScope.status !== 'all' &&
          (workHierarchy.children.get(workItem.id)?.length ||
            workItem.childWorkItemIds?.length)
        )
          return false;
        const farm = farmById.get(workItem.farmId);
        const project = projectById.get(workProjectId(workItem, recordById));
        const entries = historiesByWorkItem.get(workItem.id) ?? [];
        const text = [
          workItem.title,
          workItem.owner,
          workItem.description,
          workItem.expectedOutcome,
          workItem.nextAction,
          workItem.blockedReason,
          workItem.blockedBy,
          farm?.name ?? '',
          project?.name ?? '',
          ...entries.flatMap((entry) => [
            entry.sender,
            entry.receivedContent,
            entry.actionContent,
          ]),
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        return (
          (!query || text.includes(query)) &&
          workMatchesScope(
            workItem,
            project?.id,
            workScope,
            subscriptionToday,
          ) &&
          (workTypeFilter === 'all' || workItem.workType === workTypeFilter) &&
          (workMode !== 'list' ||
            workStatusFilter === 'all' ||
            workItem.status === workStatusFilter)
        );
      })
      .sort((a, b) => {
        const directiveOrder =
          Number(isHeadPriority(b)) - Number(isHeadPriority(a));
        if (directiveOrder) return directiveOrder;
        const aDays =
          a.status === 'completed'
            ? Number.POSITIVE_INFINITY
            : daysUntil(a.dueDate);
        const bDays =
          b.status === 'completed'
            ? Number.POSITIVE_INFINITY
            : daysUntil(b.dueDate);
        const safeA = aDays === null ? Number.POSITIVE_INFINITY : aDays;
        const safeB = bDays === null ? Number.POSITIVE_INFINITY : bDays;
        return safeA - safeB || b.lastActivityAt - a.lastActivityAt;
      });
  }, [
    farmById,
    historiesByWorkItem,
    workSearch,
    workStatusFilter,
    workMode,
    workTypeFilter,
    workScope,
    workSourceFilter,
    workAccountFilter,
    member?.id,
    member?.departmentId,
    subscriptionToday,
    operationalWorkItems,
    workHierarchy,
    projectById,
    recordById,
  ]);

  const unprocessedInboxItems = workspace.inboxItems.filter(
    (item) => item.status === 'unprocessed',
  );
  const referenceInboxItems = workspace.inboxItems.filter(
    (item) => item.status === 'reference',
  );
  const convertedInboxItems = workspace.inboxItems.filter(
    (item) => item.status === 'converted',
  );
  const inboxRouteFarmQuery = inboxFarmSearch.trim().toLocaleLowerCase('ko-KR');
  const inboxRouteFarmOptions = workspace.farms.filter((farm) => {
    if ((recordsByFarm.get(farm.id) ?? []).length === 0) return false;
    if (!inboxRouteFarmQuery) return true;
    return [
      farm.name,
      farm.farmCode,
      farm.businessNumber,
      farm.region,
      farm.address,
    ]
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(inboxRouteFarmQuery);
  });
  const today = localDateString();
  const sevenDaysAgo =
    new Date(`${today}T00:00:00`).getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentCompletedWorkItems = operationalLeafItems.filter(
    (item) => item.status === 'completed' && item.completedAt >= sevenDaysAgo,
  );
  const missingNextActionWorkItems = operationalLeafItems.filter(
    (item) => item.status !== 'completed' && !item.nextAction.trim(),
  );
  const reviewDueWorkItems = operationalLeafItems.filter(
    (item) =>
      item.status !== 'completed' &&
      item.reviewDate &&
      item.reviewDate <= today,
  );
  const staleWaitingWorkItems = operationalLeafItems.filter(
    (item) => item.status === 'waiting' && item.blockedAt < sevenDaysAgo,
  );
  const overdueWorkItems = operationalLeafItems.filter((workItem) => {
    const days = daysUntil(workItem.dueDate);
    return workItem.status !== 'completed' && days !== null && days < 0;
  });
  const dueSoonWorkItems = operationalLeafItems.filter((workItem) => {
    const days = daysUntil(workItem.dueDate);
    return (
      workItem.status !== 'completed' && days !== null && days >= 0 && days <= 7
    );
  });
  const pendingResponseWorkItems = operationalLeafItems
    .filter(
      (item) =>
        item.status !== 'completed' &&
        item.responseDueAt > 0 &&
        item.respondedAt === 0,
    )
    .sort((a, b) => a.responseDueAt - b.responseDueAt);
  const untargetedResponseWorkItems = operationalLeafItems
    .filter(
      (item) =>
        item.status !== 'completed' &&
        item.responseDueAt === 0 &&
        (historiesByWorkItem.get(item.id) ?? []).some((entry) =>
          entry.receivedContent.trim(),
        ),
    )
    .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
  const breachedResponseWorkItems = pendingResponseWorkItems.filter(
    (item) => responseRisk(item, riskNow) === 'breached',
  );
  const urgentResponseWorkItems = pendingResponseWorkItems.filter((item) =>
    ['urgent', 'warning'].includes(responseRisk(item, riskNow)),
  );
  const blockedWorkItems = operationalLeafItems
    .filter((item) => item.status === 'waiting')
    .sort(
      (a, b) => (a.blockedAt || a.updatedAt) - (b.blockedAt || b.updatedAt),
    );
  const controlRiskCount = new Set([
    ...breachedResponseWorkItems.map((item) => item.id),
    ...blockedWorkItems.map((item) => item.id),
  ]).size;
  const startOfToday = new Date(`${today}T00:00:00`).getTime();
  const endOfToday = startOfToday + 86400000;
  const visitQueue = workspace.visits
    .filter(
      (visit) =>
        Boolean(
          workItemById.get(visit.workItemId) &&
          isActiveWork(workItemById.get(visit.workItemId)!),
        ) &&
        visit.status === 'scheduled' &&
        visit.scheduledAt < startOfToday + 8 * 86400000,
    )
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const todayVisits = visitQueue.filter(
    (visit) =>
      visit.scheduledAt >= startOfToday && visit.scheduledAt < endOfToday,
  );
  const ownerLoadSummaries = [
    ...operationalWorkItems
      .filter((item) => item.status !== 'completed')
      .reduce(
        (map, item) => {
          const current = map.get(item.owner) ?? {
            owner: item.owner,
            active: 0,
            high: 0,
            overdue: 0,
            blocked: 0,
          };
          current.active += 1;
          if (item.priority === 'high') current.high += 1;
          if ((daysUntil(item.dueDate) ?? 0) < 0) current.overdue += 1;
          if (item.status === 'waiting') current.blocked += 1;
          map.set(item.owner, current);
          return map;
        },
        new Map<
          string,
          {
            owner: string;
            active: number;
            high: number;
            overdue: number;
            blocked: number;
          }
        >(),
      )
      .values(),
  ].sort(
    (a, b) => b.overdue - a.overdue || b.high - a.high || b.active - a.active,
  );
  const projectHealthSummaries = activeProjects
    .filter((project) => project.status === 'active')
    .map((project) => {
      const items = operationalLeafItems.filter(
        (item) => workProjectId(item, recordById) === project.id,
      );
      const activeItems = items.filter((item) => item.status !== 'completed');
      const hasOffTrack = activeItems.some(
        (item) =>
          responseRisk(item, riskNow) === 'breached' ||
          (item.priority === 'high' && (daysUntil(item.dueDate) ?? 0) < 0) ||
          (item.status === 'waiting' && elapsedDays(item.blockedAt) >= 5),
      );
      const hasRisk = activeItems.some(
        (item) =>
          ['urgent', 'warning'].includes(responseRisk(item, riskNow)) ||
          (daysUntil(item.dueDate) ?? 0) < 0 ||
          item.status === 'waiting',
      );
      return {
        project,
        items: activeItems,
        health: hasOffTrack ? 'off_track' : hasRisk ? 'at_risk' : 'on_track',
      } as const;
    })
    .sort((a, b) => {
      const rank = { off_track: 0, at_risk: 1, on_track: 2 };
      return rank[a.health] - rank[b.health] || b.items.length - a.items.length;
    });
  const weeklyReviewItems = [
    ...new Map(
      [
        ...missingNextActionWorkItems,
        ...overdueWorkItems,
        ...reviewDueWorkItems,
        ...staleWaitingWorkItems,
        ...breachedResponseWorkItems,
      ].map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => a.lastActivityAt - b.lastActivityAt);

  const businessYears = [
    ...new Set(activeProjects.map((project) => project.year)),
  ].sort((a, b) => b - a);
  const businessBaseProjects = activeProjects.filter(
    (project) =>
      businessTypeFilter === 'all' ||
      project.projectType === businessTypeFilter,
  );
  const businessProjects = businessBaseProjects.filter(
    (project) =>
      businessYearFilter === 'all' ||
      project.year === Number(businessYearFilter),
  );
  const summarizeBusinessProject = (project: FarmProject) => {
    const snapshot = projectSnapshots.get(project.id)!;
    const records = snapshot.records;
    const production = records.filter(
      (record) => record.productionSetupDate,
    ).length;
    const installation = records.filter((record) =>
      isFarmStageComplete(record, 'installationDate'),
    ).length;
    const commissioning = records.filter((record) =>
      isFarmStageComplete(record, 'commissioningDate'),
    ).length;
    const education = records.filter((record) =>
      isFarmStageComplete(record, 'educationDate'),
    ).length;
    const subscription = snapshot.activeSubscriptions.length;
    const progress =
      averageRates(
        snapshot.installationRate,
        snapshot.commissioningRate,
        snapshot.educationRate,
        snapshot.subscriptionRate,
      ) ?? 0;
    return {
      project,
      records,
      production,
      installation,
      commissioning,
      education,
      subscription,
      installationRate: snapshot.installationRate,
      commissioningRate: snapshot.commissioningRate,
      educationRate: snapshot.educationRate,
      subscriptionRate: snapshot.subscriptionRate,
      progress,
    };
  };
  const businessProjectSummaries = businessProjects.map(
    summarizeBusinessProject,
  );
  const businessRecords = businessProjectSummaries.flatMap(
    (summary) => summary.records,
  );
  const businessRate = (complete: number, total: number) =>
    total ? Math.round((complete / total) * 100) : null;
  const businessInstallation = businessProjectSummaries.reduce(
    (sum, summary) => sum + summary.installation,
    0,
  );
  const businessCommissioning = businessProjectSummaries.reduce(
    (sum, summary) => sum + summary.commissioning,
    0,
  );
  const businessEducation = businessProjectSummaries.reduce(
    (sum, summary) => sum + summary.education,
    0,
  );
  const businessSubscriptions = businessProjectSummaries.reduce(
    (sum, summary) => sum + summary.subscription,
    0,
  );
  const businessInstallationRate = businessRate(
    businessInstallation,
    businessRecords.length,
  );
  const businessCommissioningRate = businessRate(
    businessCommissioning,
    businessRecords.length,
  );
  const businessEducationRate = businessRate(
    businessEducation,
    businessRecords.length,
  );
  const businessSubscriptionRate = businessRate(
    businessSubscriptions,
    businessRecords.length,
  );
  const annualBusinessSummaries = businessYears
    .map((year) => {
      const projects = businessBaseProjects.filter(
        (project) => project.year === year,
      );
      const summaries = projects.map(summarizeBusinessProject);
      const participationCount = summaries.reduce(
        (sum, summary) => sum + summary.records.length,
        0,
      );
      const installation = summaries.reduce(
        (sum, summary) => sum + summary.installation,
        0,
      );
      const commissioning = summaries.reduce(
        (sum, summary) => sum + summary.commissioning,
        0,
      );
      const education = summaries.reduce(
        (sum, summary) => sum + summary.education,
        0,
      );
      const subscription = summaries.reduce(
        (sum, summary) => sum + summary.subscription,
        0,
      );
      return {
        year,
        projects,
        participationCount,
        activeProjects: projects.filter(
          (project) => project.status === 'active',
        ).length,
        completedProjects: projects.filter(
          (project) => project.status === 'completed',
        ).length,
        onHoldProjects: projects.filter(
          (project) => project.status === 'on_hold',
        ).length,
        installation,
        commissioning,
        education,
        subscription,
        installationRate: businessRate(installation, participationCount),
        commissioningRate: businessRate(commissioning, participationCount),
        educationRate: businessRate(education, participationCount),
        subscriptionRate: businessRate(subscription, participationCount),
      };
    })
    .filter((summary) => summary.projects.length > 0);
  const regionBreakdown = countValues(
    businessRecords.map((record) => farmById.get(record.farmId)?.region ?? ''),
  );
  const cropBreakdown = countValues(
    businessRecords.map((record) => record.crop),
  );
  const productBreakdown = countValues(
    businessRecords.map((record) => record.productType),
  );

  const paymentHistory = workspace.historyEntries
    .map((entry) => ({ entry, workItem: workItemById.get(entry.workItemId) }))
    .filter(
      (item): item is { entry: FarmHistoryEntry; workItem: FarmWorkItem } =>
        item.workItem?.workType === 'payment' && item.entry.amount > 0,
    );

  const qualityIssues = useMemo(() => {
    const issues: QualityIssue[] = [];
    const codeGroups = new Map<string, Farm[]>();
    const nameGroups = new Map<string, Farm[]>();
    for (const farm of workspace.farms) {
      const code = farm.farmCode.trim().toLocaleLowerCase('ko-KR');
      const name = farm.name.trim().toLocaleLowerCase('ko-KR');
      if (code) codeGroups.set(code, [...(codeGroups.get(code) ?? []), farm]);
      if (name) nameGroups.set(name, [...(nameGroups.get(name) ?? []), farm]);
      if (!farm.address.trim()) {
        issues.push({
          id: `address-${farm.id}`,
          farmId: farm.id,
          category: 'contact',
          title: '주소 미입력',
          description: `${farm.name}의 현장 주소를 확인해 주세요.`,
          severity: 'medium',
        });
      }
    }
    for (const [code, farms] of codeGroups) {
      if (farms.length < 2) continue;
      for (const farm of farms) {
        issues.push({
          id: `code-${code}-${farm.id}`,
          farmId: farm.id,
          category: 'duplicate',
          title: '농장번호 중복',
          description: `${farm.farmCode} 번호를 ${farms.length}개 농가가 사용 중입니다.`,
          severity: 'high',
        });
      }
    }
    for (const [name, farms] of nameGroups) {
      if (farms.length < 2) continue;
      for (const farm of farms) {
        issues.push({
          id: `name-${name}-${farm.id}`,
          farmId: farm.id,
          category: 'duplicate',
          title: '농가명 중복',
          description: `${farm.name} 이름이 ${farms.length}건 있습니다. 동일 농가인지 확인해 주세요.`,
          severity: 'high',
        });
      }
    }
    const participationGroups = new Map<string, FarmRecord[]>();
    for (const record of workspace.records) {
      const key = `${record.farmId}:${record.projectId}`;
      participationGroups.set(key, [
        ...(participationGroups.get(key) ?? []),
        record,
      ]);
    }
    for (const records of participationGroups.values()) {
      if (records.length < 2) continue;
      const record = records[0];
      const farm = farmById.get(record.farmId);
      const project = projectById.get(record.projectId);
      issues.push({
        id: `participation-${record.farmId}-${record.projectId}`,
        farmId: record.farmId,
        projectId: record.projectId,
        category: 'duplicate',
        title: '같은 프로젝트에 농가 중복 등록',
        description: `${farm?.name ?? '농가'}가 ${project?.name ?? '프로젝트'}에 ${records.length}번 연결되어 있습니다. 참여 정보를 확인해 주세요.`,
        severity: 'high',
      });
    }
    for (const record of workspace.records) {
      const farm = farmById.get(record.farmId);
      if (!isFarmStageComplete(record, 'installationDate')) {
        issues.push({
          id: `installation-${record.id}`,
          farmId: record.farmId,
          projectId: record.projectId,
          category: 'installation',
          title: '설치일 미입력',
          description: `${farm?.name ?? '농가'}의 ${projectById.get(record.projectId)?.name ?? '사업'} 설치일이 없습니다.`,
          severity: 'medium',
        });
      }
      if (
        record.subscriptionYears <= 0 ||
        !record.currentSubscriptionExpiresAt
      ) {
        issues.push({
          id: `subscription-${record.id}`,
          farmId: record.farmId,
          projectId: record.projectId,
          category: 'subscription',
          title: '구독 기준 누락',
          description: `${farm?.name ?? '농가'}의 구독기간 또는 현재 만료일을 확인해 주세요.`,
          severity: 'medium',
        });
      }
    }
    return issues.sort((a, b) =>
      a.severity === b.severity
        ? a.title.localeCompare(b.title, 'ko-KR')
        : a.severity === 'high'
          ? -1
          : 1,
    );
  }, [farmById, projectById, workspace.farms, workspace.records]);

  const subscriptionPaymentYears = useMemo(
    () =>
      buildPaymentYearReport(
        workspace.records,
        workspace.projects,
        workspace.workItems,
        workspace.historyEntries,
        { asOf: riskNow, projectType: subscriptionReportProjectType },
      ),
    [
      workspace.records,
      workspace.projects,
      workspace.workItems,
      workspace.historyEntries,
      riskNow,
      subscriptionReportProjectType,
    ],
  );

  const subscriptionReportYears = useMemo(() => {
    const years = new Set<number>([
      Number(subscriptionReportYear),
      new Date().getFullYear(),
      ...subscriptionPaymentYears.years.map((row) => row.year),
    ]);
    for (const event of workspace.subscriptionEvents) {
      const basisYear = Number(event.basisExpiryDate.slice(0, 4));
      const processedYear = Number(event.processedAt.slice(0, 4));
      if (basisYear) years.add(basisYear);
      if (processedYear) years.add(processedYear);
    }
    for (const record of workspace.records) {
      const year = Number(record.currentSubscriptionExpiresAt.slice(0, 4));
      if (year) years.add(year);
    }
    return [...years].filter(Boolean).sort((a, b) => b - a);
  }, [
    subscriptionReportYear,
    workspace.records,
    workspace.subscriptionEvents,
    subscriptionPaymentYears.years,
  ]);

  const subscriptionReport = useMemo(() => {
    const year = Number(
      subscriptionReportYear === 'all'
        ? subscriptionToday.slice(0, 4)
        : subscriptionReportYear,
    );
    const projectMatches = (projectId: string) =>
      subscriptionReportProjectType === 'all' ||
      projectById.get(projectId)?.projectType === subscriptionReportProjectType;
    const relevantRecords = workspace.records.filter((record) =>
      projectMatches(record.projectId),
    );
    const relevantEvents = workspace.subscriptionEvents.filter((event) =>
      projectMatches(event.projectId),
    );
    const renewal = buildRenewalReport(
      workspace.records,
      workspace.subscriptionEvents,
      workspace.projects,
      {
        year,
        today: subscriptionToday,
        projectType: subscriptionReportProjectType,
        workItems: workspace.workItems,
        historyEntries: workspace.historyEntries,
      },
    );

    const upcomingRecords = relevantRecords.filter(
      (record) =>
        effectiveRecordSubscriptionStatus(record, subscriptionToday) ===
          'active' &&
        Boolean(record.currentSubscriptionExpiresAt) &&
        record.currentSubscriptionExpiresAt > subscriptionToday,
    );
    const yearMap = new Map<number, Map<number, Map<string, FarmRecord[]>>>();
    for (const record of upcomingRecords) {
      const expiryYear = Number(
        record.currentSubscriptionExpiresAt.slice(0, 4),
      );
      const expiryMonth = Number(
        record.currentSubscriptionExpiresAt.slice(5, 7),
      );
      if (!expiryYear || !expiryMonth) continue;
      const monthMap = yearMap.get(expiryYear) ?? new Map();
      const projectMap = monthMap.get(expiryMonth) ?? new Map();
      projectMap.set(record.projectId, [
        ...(projectMap.get(record.projectId) ?? []),
        record,
      ]);
      monthMap.set(expiryMonth, projectMap);
      yearMap.set(expiryYear, monthMap);
    }
    const upcoming = [...yearMap.entries()]
      .sort(([left], [right]) => left - right)
      .map(([expiryYear, monthMap]) => {
        const months = [...monthMap.entries()]
          .sort(([left], [right]) => left - right)
          .map(([month, projectMap]) => {
            const projects = [...projectMap.entries()]
              .map(([projectId, records]) => ({
                projectId,
                name: projectById.get(projectId)?.name ?? '사업 없음',
                count: records.length,
                records: [...records].sort((left, right) =>
                  (farmById.get(left.farmId)?.name ?? '').localeCompare(
                    farmById.get(right.farmId)?.name ?? '',
                    'ko-KR',
                  ),
                ),
              }))
              .sort(
                (left, right) =>
                  right.count - left.count ||
                  left.name.localeCompare(right.name, 'ko-KR'),
              );
            return {
              month,
              count: projects.reduce((sum, project) => sum + project.count, 0),
              projects,
            };
          });
        return {
          year: expiryYear,
          count: months.reduce((sum, month) => sum + month.count, 0),
          months,
        };
      });

    return {
      year,
      asOfDate: subscriptionToday,
      currentNonRenewed: renewal.currentNonRenewed,
      renewal,
      ...renewal.overall,
      rejoined: renewal.rejoined,
      upcomingCount: upcomingRecords.length,
      missingExpiry: relevantRecords.filter(
        (record) =>
          record.subscriptionStatus !== 'unregistered' &&
          !record.currentSubscriptionExpiresAt,
      ).length,
      upcoming,
      recentEvents: [...relevantEvents]
        .sort(
          (left, right) =>
            right.processedAt.localeCompare(left.processedAt) ||
            right.createdAt - left.createdAt,
        )
        .slice(0, 8),
    };
  }, [
    farmById,
    projectById,
    subscriptionReportProjectType,
    subscriptionReportYear,
    subscriptionToday,
    workspace.records,
    workspace.subscriptionEvents,
    workspace.projects,
    workspace.workItems,
    workspace.historyEntries,
  ]);

  const subscriptionListProjects = filterProjectsByScope(
    workspace.projects,
    'all',
    subscriptionListProjectType,
  );
  const subscriptionScopedRecords = useMemo(
    () =>
      filterSubscriptionsByScope(
        workspace.records,
        workspace.projects,
        subscriptionListProjectType,
        subscriptionListProjectId,
      ).filter(
        (record) =>
          !subscriptionFocus || subscriptionFocus.recordIds.includes(record.id),
      ),
    [
      subscriptionListProjectId,
      subscriptionListProjectType,
      subscriptionFocus,
      workspace.records,
      workspace.projects,
    ],
  );
  const recordedPayments = useMemo(
    () =>
      paymentEvidenceByRecord(
        workspace.workItems,
        workspace.historyEntries,
        riskNow,
      ),
    [workspace.workItems, workspace.historyEntries, riskNow],
  );
  const subscriptionCycleRecords =
    subscriptionMode === 'management'
      ? subscriptionScopedRecords
      : workspace.records.filter(
          (record) =>
            subscriptionReportProjectType === 'all' ||
            projectById.get(record.projectId)?.projectType ===
              subscriptionReportProjectType,
        );
  const subscriptionCycleCounts = summarizeSubscriptionCycles(
    subscriptionCycleRecords,
    recordedPayments,
  );
  const subscriptionListRecords = useMemo(() => {
    const query = subscriptionListSearch.trim().toLocaleLowerCase('ko-KR');
    return subscriptionScopedRecords
      .filter((record) => {
        const farm = farmById.get(record.farmId);
        const project = projectById.get(record.projectId);
        const status = effectiveRecordSubscriptionStatus(
          record,
          subscriptionToday,
        );
        const searchable = [
          farm?.farmCode ?? '',
          farm?.name ?? '',
          farm?.region ?? '',
          project?.name ?? '',
          record.currentSubscriptionExpiresAt,
          record.lastPaymentDate,
          recordedPayments.get(record.id)?.latestPaidAt
            ? localDateString(
                new Date(recordedPayments.get(record.id)!.latestPaidAt),
              )
            : '',
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        return (
          (!query || searchable.includes(query)) &&
          (subscriptionListStatus === 'all' ||
            status === subscriptionListStatus)
        );
      })
      .sort((left, right) => {
        const expiry = (
          left.currentSubscriptionExpiresAt || '9999-12-31'
        ).localeCompare(right.currentSubscriptionExpiresAt || '9999-12-31');
        if (expiry) return expiry;
        const leftFarm = farmById.get(left.farmId)?.name ?? '';
        const rightFarm = farmById.get(right.farmId)?.name ?? '';
        return leftFarm.localeCompare(rightFarm, 'ko-KR');
      });
  }, [
    farmById,
    projectById,
    subscriptionListSearch,
    subscriptionListStatus,
    subscriptionScopedRecords,
    subscriptionToday,
    recordedPayments,
  ]);
  const subscriptionPageCount = Math.max(
    1,
    Math.ceil(subscriptionListRecords.length / SUBSCRIPTION_PAGE_SIZE),
  );
  const effectiveSubscriptionListPage = Math.min(
    subscriptionListPage,
    subscriptionPageCount,
  );
  const subscriptionPageRecords = subscriptionListRecords.slice(
    (effectiveSubscriptionListPage - 1) * SUBSCRIPTION_PAGE_SIZE,
    effectiveSubscriptionListPage * SUBSCRIPTION_PAGE_SIZE,
  );
  const subscriptionScopedRecordIds = new Set(
    subscriptionScopedRecords.map((record) => record.id),
  );
  const subscriptionScopedPayments = paymentHistory.filter(({ workItem }) =>
    subscriptionScopedRecordIds.has(workItem.farmRecordId),
  );
  const subscriptionPaymentFarmCount = new Set(
    subscriptionScopedPayments.map(({ workItem }) => workItem.farmId),
  ).size;
  const subscriptionPaymentTotal = subscriptionScopedPayments.reduce(
    (sum, { entry }) => sum + entry.amount,
    0,
  );
  const subscriptionAveragePayment = subscriptionPaymentFarmCount
    ? Math.round(subscriptionPaymentTotal / subscriptionPaymentFarmCount)
    : 0;
  const subscriptionActiveCount = subscriptionScopedRecords.filter(
    (record) =>
      effectiveRecordSubscriptionStatus(record, subscriptionToday) === 'active',
  ).length;
  const subscriptionExpiringSoon = subscriptionScopedRecords.filter(
    (record) => {
      const days = daysUntil(record.currentSubscriptionExpiresAt);
      return (
        effectiveRecordSubscriptionStatus(record, subscriptionToday) ===
          'active' &&
        days !== null &&
        days >= 0 &&
        days <= 90
      );
    },
  );
  const subscriptionMonthlyPayments = countValues(
    subscriptionScopedPayments.map(({ entry }) =>
      localDateString(new Date(entry.occurredAt)).slice(0, 7),
    ),
  )
    .map((month) => ({
      ...month,
      amount: subscriptionScopedPayments
        .filter(({ entry }) =>
          localDateString(new Date(entry.occurredAt)).startsWith(month.label),
        )
        .reduce((sum, { entry }) => sum + entry.amount, 0),
    }))
    .sort((left, right) => right.label.localeCompare(left.label))
    .slice(0, 6);

  const activeSubscriptions = workspace.records.filter(
    (record) =>
      effectiveRecordSubscriptionStatus(record, subscriptionToday) === 'active',
  ).length;
  const expiredSubscriptions = workspace.records.length - activeSubscriptions;
  const overviewRecords = yearProjects.flatMap(
    (project) => projectSnapshots.get(project.id)?.records ?? [],
  );
  const overviewWorkIds = new Set(
    yearProjects.flatMap(
      (project) =>
        projectSnapshots.get(project.id)?.workItems.map((item) => item.id) ??
        [],
    ),
  );
  const overviewFarmIds = new Set(
    overviewRecords.map((record) => record.farmId),
  );
  const overviewInactiveSubscriptions = overviewRecords.filter(
    (record) =>
      effectiveRecordSubscriptionStatus(record, subscriptionToday) !== 'active',
  ).length;
  const overviewProjectIds = new Set(yearProjects.map((project) => project.id));
  const overviewQualityCount = qualityIssues.filter((issue) =>
    issue.projectId
      ? overviewProjectIds.has(issue.projectId)
      : overviewFarmIds.has(issue.farmId),
  ).length;
  const visibleQualityIssues = qualityIssues.filter(
    (issue) => !qualityFocus || qualityFocus.issueIds.includes(issue.id),
  );
  const installFollowups = overviewRecords.filter(
    (record) =>
      !isFarmStageComplete(record, 'commissioningDate') ||
      !isFarmStageComplete(record, 'educationDate'),
  ).length;
  const serviceWorkItems = workspace.workItems.filter(
    (workItem) => isActiveWork(workItem) && workItem.workType === 'service',
  );
  const openServices = serviceWorkItems.filter(
    (workItem) => workItem.status !== 'completed',
  ).length;
  const openWorkItems = operationalLeafItems.filter(
    (workItem) => workItem.status !== 'completed',
  ).length;
  const recentHistoryEntries = workspace.historyEntries
    .filter((entry) => overviewWorkIds.has(entry.workItemId))
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
    .slice(0, 6);

  const selectedFarmHistory = selectedFarm
    ? selectedWorkItems
        .flatMap((workItem) =>
          (historiesByWorkItem.get(workItem.id) ?? []).map((entry) => ({
            entry,
            workItem,
          })),
        )
        .sort(
          (a, b) =>
            b.entry.occurredAt - a.entry.occurredAt ||
            b.entry.createdAt - a.entry.createdAt,
        )
    : [];

  const selectedFarmPayments = selectedFarmHistory.filter(
    ({ entry, workItem }) =>
      workItem.workType === 'payment' && entry.amount > 0,
  );

  const navItems: Array<{
    id: View;
    label: string;
    icon: typeof Warehouse;
    count?: number;
  }> = [
    ...(organization.admin
      ? [{ id: 'organization' as View, label: '직원·부서 관리', icon: Users }]
      : []),
    { id: 'overview', label: '통합 현황', icon: Leaf },
    {
      id: 'work',
      label: '업무 현황',
      icon: ClipboardList,
      count: openWorkItems,
    },
    {
      id: 'farms',
      label: '농가 관리대장',
      icon: Warehouse,
      count: workspace.farms.length,
    },
    {
      id: 'projects',
      label: '프로젝트 관리',
      icon: BriefcaseBusiness,
      count: activeProjects.length,
    },
    { id: 'business', label: '사업 집계', icon: BarChart3 },
    {
      id: 'subscriptions',
      label: '구독·입금',
      icon: CreditCard,
      count: expiredSubscriptions,
    },
    { id: 'service', label: 'A/S 업무', icon: Wrench, count: openServices },
    {
      id: 'quality',
      label: '데이터 점검',
      icon: ShieldCheck,
      count: qualityIssues.length,
    },
  ];

  function currentDetailTarget(): DetailTarget | null {
    if (selectedWorkItemId) {
      return {
        kind: 'work',
        farmId: selectedFarmId,
        workItemId: selectedWorkItemId,
        projectId: farmContextProjectId,
      };
    }
    if (selectedFarmId)
      return {
        kind: 'farm',
        farmId: selectedFarmId,
        projectId: farmContextProjectId,
      };
    if (selectedProjectId)
      return { kind: 'project', projectId: selectedProjectId };
    return null;
  }

  function sameDetailTarget(left: DetailTarget | null, right: DetailTarget) {
    if (!left || left.kind !== right.kind) return false;
    if (left.kind === 'project' && right.kind === 'project')
      return left.projectId === right.projectId;
    if (left.kind === 'farm' && right.kind === 'farm')
      return left.farmId === right.farmId && left.projectId === right.projectId;
    return (
      left.kind === 'work' &&
      right.kind === 'work' &&
      left.farmId === right.farmId &&
      left.workItemId === right.workItemId &&
      left.projectId === right.projectId
    );
  }

  function applyDetailTarget(target: DetailTarget | null) {
    setFarmContextProjectId(
      target && target.kind !== 'project' ? (target.projectId ?? '') : '',
    );
    if (!target) {
      setSelectedProjectId('');
      setSelectedFarmId('');
      setSelectedWorkItemId('');
      return;
    }
    if (target.kind === 'project') {
      setSelectedProjectId(target.projectId);
      setSelectedFarmId('');
      setSelectedWorkItemId('');
      return;
    }
    setSelectedProjectId('');
    setSelectedFarmId(target.farmId);
    setSelectedWorkItemId(target.kind === 'work' ? target.workItemId : '');
  }

  function openDetail(target: DetailTarget) {
    const current = currentDetailTarget();
    if (sameDetailTarget(current, target)) return;
    const nextTrail: DetailTrailEntry[] = current
      ? [
          ...detailTrail,
          {
            target: current,
            scrollY: Math.max(0, window.scrollY),
            focusElement:
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null,
            projectTab: projectDetailTab,
            farmTab: farmDetailTab,
          },
        ]
      : [];
    const next: DetailNavigationSnapshot = {
      ...captureDetailNavigation(),
      target,
      trail: nextTrail.map(({ target, scrollY, projectTab, farmTab }) => ({
        target,
        scrollY,
        projectTab,
        farmTab,
      })),
      scrollY: 0,
      listScrollY: Math.max(
        0,
        current ? listScrollYRef.current : window.scrollY,
      ),
      projectTab: target.kind === 'project' ? 'summary' : projectDetailTab,
      farmTab: target.kind === 'farm' ? 'work' : farmDetailTab,
    };
    if (detailNavigation.current && !detailNavigation.current.push(next))
      return;
    setDetailTrail(nextTrail);
    setProjectDetailTab(next.projectTab);
    setFarmDetailTab(next.farmTab);
    if (!current) {
      listScrollYRef.current = Math.max(0, window.scrollY);
      listFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    applyDetailTarget(target);
    focusActiveHeading();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }

  function closeDetails() {
    setDetailTrail([]);
    applyDetailTarget(null);
  }

  function backDetail() {
    if (detailNavigation.current?.back()) return;
    const previous = detailTrail.at(-1) ?? null;
    detailNavigation.current?.replace(
      {
        ...captureDetailNavigation(),
        target: previous?.target ?? null,
        trail: detailTrail
          .slice(0, -1)
          .map(({ target, scrollY, projectTab, farmTab }) => ({
            target,
            scrollY,
            projectTab,
            farmTab,
          })),
        projectTab: previous?.projectTab ?? projectDetailTab,
        farmTab: previous?.farmTab ?? farmDetailTab,
        scrollY: previous?.scrollY ?? listScrollYRef.current,
      },
      !previous,
    );
    setDetailTrail((trail) => trail.slice(0, -1));
    applyDetailTarget(previous?.target ?? null);
    if (previous) {
      setProjectDetailTab(previous.projectTab);
      setFarmDetailTab(previous.farmTab);
    }
    requestAnimationFrame(() => {
      const previousFocus = previous?.focusElement ?? listFocusRef.current;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length)
        previousFocus.focus({ preventScroll: true });
      else focusActiveHeading();
    });
    requestAnimationFrame(() =>
      window.scrollTo({
        top: previous?.scrollY ?? listScrollYRef.current,
        behavior: 'auto',
      }),
    );
  }

  function changeView(next: View) {
    if (
      detailNavigation.current &&
      !detailNavigation.current.replace(
        {
          ...captureDetailNavigation(),
          view: next,
          target: null,
          trail: [],
          scrollY: 0,
          listScrollY: 0,
        },
        true,
      )
    )
      return false;
    closeDetails();
    setView(next);
    setWorkScope(null);
    setSubscriptionFocus(null);
    setQualityFocus(null);
    focusActiveHeading();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    return true;
  }

  function focusActiveHeading() {
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(
        '[data-active-content="true"] h1',
      );
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    });
  }

  function captureDetailNavigation(): DetailNavigationSnapshot {
    return {
      view,
      target: currentDetailTarget(),
      projectTab: projectDetailTab,
      farmTab: farmDetailTab,
      trail: detailTrail.map(({ target, scrollY, projectTab, farmTab }) => ({
        target,
        scrollY,
        projectTab,
        farmTab,
      })),
      scrollY:
        pendingNavigationScrollRef.current ?? Math.max(0, window.scrollY),
      listScrollY: Math.max(0, listScrollYRef.current),
    };
  }

  function canGoBackDetail() {
    if (
      dialog ||
      childTaskParent ||
      taskRegistrationOpen ||
      quickDetailTaskId ||
      workQuickEditOpen ||
      projectDeletionTarget ||
      workDeletionTarget ||
      submitting
    ) {
      toast.add({
        title: '열려 있는 입력창을 저장하거나 닫은 뒤 이동해 주세요.',
        type: 'error',
      });
      return false;
    }
    return true;
  }

  function restoreDetailNavigation(snapshot: DetailNavigationSnapshot) {
    setView(snapshot.view);
    applyDetailTarget(snapshot.target);
    setDetailTrail(
      snapshot.trail.map((entry) => ({ ...entry, focusElement: null })),
    );
    setProjectDetailTab(snapshot.projectTab);
    setFarmDetailTab(snapshot.farmTab);
    listScrollYRef.current = snapshot.listScrollY;
    pendingNavigationScrollRef.current = snapshot.scrollY;
    requestAnimationFrame(() => {
      const focus = !snapshot.target ? listFocusRef.current : null;
      if (focus?.isConnected && focus.getClientRects().length)
        focus.focus({ preventScroll: true });
      else focusActiveHeading();
    });
  }

  function openScopedWork(status: 'all' | 'open' | 'overdue' = 'all') {
    if (!changeView('work')) return;
    setWorkMode('list');
    setWorkSourceFilter('all');
    setWorkAccountFilter('all');
    setWorkSearch('');
    setWorkTypeFilter('all');
    setWorkStatusFilter('all');
    setWorkScope({
      projectIds: yearProjects.map((project) => project.id),
      label: `${projectYearFilter === 'all' ? '전체 연도' : `${projectYearFilter}년`} · ${projectTypeFilter === 'all' ? '전체 사업 타입' : FARM_PROJECT_TYPE_LABELS[projectTypeFilter]}`,
      status,
    });
  }

  function selectProjectKpi(target: 'projects' | 'tasks' | 'attention') {
    if (target === 'projects') {
      if (!changeView('projects')) return;
      setProjectSearch('');
      setProjectRiskFilter('all');
    } else openScopedWork(target === 'attention' ? 'open' : 'all');
  }

  function resetFarmLedgerFilters() {
    setSearch('');
    setProjectFilter('all');
    setSubscriptionFilter('all');
    setFarmCropFilter('all');
    setFarmRegionFilter('all');
  }

  function openProjectDetail(projectId: string) {
    openDetail({ kind: 'project', projectId });
  }

  function workContextLabel(item: FarmWorkItem) {
    return isInternalTask(item)
      ? `내부 업무 · ${organization.departments.find((dept) => dept.id === item.departmentId)?.name || '부서'}`
      : projectForWorkItem(item)?.name || '사업 없음';
  }

  function addChildTask(parent: FarmWorkItem) {
    if (isInternalTask(parent) && !organization.personal) {
      toast.add({
        title: '개인 계정이 필요합니다',
        description: '내부 업무 배정은 승인된 개인 계정으로 로그인해 주세요.',
      });
      return;
    }
    setChildTaskParent(parent);
  }

  function openFarm(farmId: string, workItemId = '', sourceProjectId?: string) {
    const directTask = workItemById.get(workItemId);
    if (directTask && isStandaloneWork(directTask)) {
      openDetail({
        kind: 'work',
        farmId: '',
        workItemId,
        projectId: directTask.projectId,
      });
      return;
    }
    const workRecord = workItemId
      ? recordById.get(workItemById.get(workItemId)?.farmRecordId ?? '')
      : null;
    const inheritedProject = selectedProjectId || farmContextProjectId;
    const projectId =
      sourceProjectId ??
      workRecord?.projectId ??
      ((recordsByFarm.get(farmId) ?? []).some(
        (record) => record.projectId === inheritedProject,
      )
        ? inheritedProject
        : '');
    openDetail(
      workItemId
        ? { kind: 'work', farmId, workItemId, projectId }
        : { kind: 'farm', farmId, projectId },
    );
  }

  function openFarmDialog() {
    setEditingFarmId('');
    setFarmLocationImages([]);
    setFarmLocationIds([]);
    setFarmLocationExpectedIds([]);
    setFarmLocationBusy(false);
    farmImageBusyRef.current = false;
    setFarmForm(
      emptyFarmForm(
        activeProjects.find((project) => project.status === 'active')?.id ??
          activeProjects[0]?.id ??
          '',
      ),
    );
    setFormError('');
    setDialog('farm');
  }

  function openFarmEditDialog() {
    if (!selectedFarm) return;
    setEditingFarmId(selectedFarm.id);
    setEditingFarmVersion(selectedFarm.updatedAt);
    setFarmLocationImages([]);
    setFarmLocationIds([...(selectedFarm.locationImageIds ?? [])]);
    setFarmLocationExpectedIds([...(selectedFarm.locationImageIds ?? [])]);
    setFarmLocationBusy(false);
    farmImageBusyRef.current = false;
    const form = emptyFarmForm(
      selectedRecords[0]?.projectId ?? activeProjects[0]?.id ?? '',
    );
    setFarmForm({
      ...form,
      farmCode: selectedFarm.farmCode,
      name: selectedFarm.name,
      phone: selectedFarm.phone,
      address: selectedFarm.address,
      region: selectedFarm.region,
      businessNumber: selectedFarm.businessNumber,
      folderUrl: selectedFarm.folderUrl,
      locationUrl: selectedFarm.locationUrl,
      specialNotes: selectedFarm.specialNotes,
    });
    setEditingRecordId('');
    setFormError('');
    setDialog('farm_edit');
  }

  function openRecordAddDialog() {
    if (!selectedFarm) return;
    const existingProjectIds = new Set(
      allSelectedRecords.map((record) => record.projectId),
    );
    const availableProject = activeProjects.find(
      (project) => !existingProjectIds.has(project.id),
    );
    if (!availableProject) {
      toast.add({
        title: '추가할 사업이 없습니다',
        description: '등록된 모든 사업에 이미 참여 중입니다.',
        type: 'warning',
      });
      return;
    }
    setFarmForm(emptyFarmForm(availableProject.id));
    setEditingRecordId('');
    setFormError('');
    setDialog('record_add');
  }

  function openRecordEditDialog(record: FarmRecord) {
    setFarmForm({
      ...emptyFarmForm(record.projectId),
      projectId: record.projectId,
      crop: record.crop,
      deviceType: record.deviceType,
      productType: record.productType,
      vendor: record.vendor,
      productionSetupDate: record.productionSetupDate,
      installationDate: record.installationDate,
      commissioningDate: record.commissioningDate,
      educationDate: record.educationDate,
      internetType: record.internetType,
      warrantyYears: record.warrantyYears,
      warrantyExpiresAt: record.warrantyExpiresAt,
      subscriptionYears: record.subscriptionYears,
      initialSubscriptionExpiresAt: record.initialSubscriptionExpiresAt,
      currentSubscriptionExpiresAt: record.currentSubscriptionExpiresAt,
      lastPaymentDate: record.lastPaymentDate,
      renewalCount: record.renewalCount,
      subscriptionStatus: record.subscriptionStatus,
      notes: record.notes,
    });
    setEditingRecordId(record.id);
    setFormError('');
    setDialog('record_edit');
  }

  function openProjectDialog() {
    projectExpectedVersion.current = 0;
    setEditingProjectId('');
    setProjectForm(emptyProjectForm());
    setFormError('');
    setDialog('project');
  }

  function openProjectEditDialog(project: FarmProject) {
    projectExpectedVersion.current = project.updatedAt;
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      projectType: project.projectType,
      year: project.year,
      institution: project.institution,
      status: project.status,
      description: project.description,
      targetFarmCount: project.targetFarmCount,
      manager: project.manager,
      startDate: project.startDate,
      endDate: project.endDate,
      currentStage: project.currentStage,
      settlementStatus: project.settlementStatus,
      settlementDueDate: project.settlementDueDate,
      contractAmount: project.contractAmount,
      settlementClaimAmount: project.settlementClaimAmount,
      settlementApprovedAmount: project.settlementApprovedAmount,
      settlementPaidAmount: project.settlementPaidAmount,
      settledAt: project.settledAt,
      settlementOwner: project.settlementOwner,
      settlementEvidenceUrl: project.settlementEvidenceUrl,
      settlementNote: project.settlementNote,
      ...(project.settlementRounds
        ? { settlementRounds: structuredClone(project.settlementRounds) }
        : {}),
    });
    setFormError('');
    setDialog('project');
  }

  function openProjectDocumentDialog(
    project: FarmProject,
    document?: FarmProjectDocument,
  ) {
    setSelectedProjectId(project.id);
    setEditingProjectDocumentId(document?.id ?? '');
    setProjectDocumentForm(
      document
        ? {
            title: document.title,
            category: document.category,
            isRequired: document.isRequired,
            status: document.status,
            owner: document.owner,
            currentHandler: document.currentHandler,
            dueDate: document.dueDate,
            submittedAt: document.submittedAt,
            approvedAt: document.approvedAt,
            referenceUrl: document.referenceUrl,
            revision: document.revision,
            note: document.note,
          }
        : emptyProjectDocumentForm(project.manager),
    );
    setFormError('');
    setDialog('project_document');
  }

  function openProjectUpdateDialog(
    project: FarmProject,
    kind: ProjectUpdateForm['kind'] = 'communication',
  ) {
    setSelectedProjectId(project.id);
    setProjectUpdateForm({
      ...emptyProjectUpdateForm(accountName || accountEmail || project.manager),
      kind,
      channel: kind === 'decision' ? 'meeting' : 'email',
    });
    setFormError('');
    setDialog('project_update');
  }

  function openProjectBlockerResolveDialog(update: FarmProjectUpdate) {
    setSelectedProjectId(update.projectId);
    setResolvingProjectUpdateId(update.id);
    setProjectBlockerResolutionForm({
      resolution: '',
      resolvedBy: projectById.get(update.projectId)?.manager || update.recorder,
    });
    setFormError('');
    setDialog('project_blocker_resolve');
  }

  function openWorkItemDialog(
    farmRecordId = '',
    workType: WorkType = 'communication',
  ) {
    setDraftImages([]);
    if (!selectedFarm || !selectedRecords.length) return;
    const safeRecordId = selectedRecords.some(
      (record) => record.id === farmRecordId,
    )
      ? farmRecordId
      : selectedRecords.length === 1
        ? selectedRecords[0].id
        : '';
    setWorkItemForm({
      ...emptyWorkItemForm(safeRecordId),
      workType,
      checklistText: (WORK_CHECKLIST_TEMPLATES[workType] ?? []).join('\n'),
      ...(workType === 'payment'
        ? { title: '구독료 입금', dueDate: localDateString() }
        : {}),
    });
    setClarifyingInboxId('');
    setFormError('');
    setDialog('work_item');
  }

  function openQuickWorkItem(
    record: FarmRecord,
    workType: WorkType,
    title: string,
  ) {
    setDraftImages([]);
    openFarm(record.farmId, '', record.projectId);
    setWorkItemForm({
      ...emptyWorkItemForm(record.id),
      workType,
      title,
      checklistText: (WORK_CHECKLIST_TEMPLATES[workType] ?? []).join('\n'),
      status: 'open',
      dueDate: workType === 'payment' ? localDateString() : dateWithOffset(7),
      channel: 'other',
    });
    setClarifyingInboxId('');
    setFormError('');
    setDialog('work_item');
  }

  function openSubscriptionEventDialog(record?: FarmRecord) {
    const target =
      record ??
      [...workspace.records]
        .filter((item) => item.currentSubscriptionExpiresAt)
        .sort((left, right) =>
          left.currentSubscriptionExpiresAt.localeCompare(
            right.currentSubscriptionExpiresAt,
          ),
        )[0] ??
      workspace.records[0];
    if (!target) {
      toast.add({
        title: '먼저 농가·사업 구독을 등록해 주세요',
        description: '구독 처리 결과를 연결할 농가가 없습니다.',
        type: 'warning',
      });
      return;
    }
    setSubscriptionEventForm(
      emptySubscriptionEventForm(
        target,
        projectById.get(target.projectId)?.manager ?? '',
      ),
    );
    setFormError('');
    setDialog('subscription_event');
  }

  function openSubscriptionExpiryDialog(record: FarmRecord) {
    const manager = projectById.get(record.projectId)?.manager ?? '';
    setSubscriptionExpiryForm(
      emptySubscriptionExpiryForm(
        record,
        manager && !manager.includes('미지정') ? manager : accountName,
      ),
    );
    setFormError('');
    setDialog('subscription_expiry');
  }

  async function copySubscriptionReport() {
    const shortYear = String(subscriptionReport.year).slice(-2);
    const projectTypeLabel =
      subscriptionReportProjectType === 'all'
        ? '전체 사업 타입'
        : FARM_PROJECT_TYPE_LABELS[subscriptionReportProjectType];
    const lines =
      subscriptionReportYear === 'all'
        ? paymentYearReportLines(subscriptionPaymentYears, projectTypeLabel)
        : [
            '구독 실적',
            '',
            `- 사업 타입 : ${projectTypeLabel}`,
            `- 연간 만료 대상 ('${shortYear}.1~12) : ${subscriptionReport.annualTarget}개소`,
            `- 만료 경과 ${subscriptionReport.target}개소 중 갱신 ${subscriptionReport.renewed}개소, 미갱신 ${subscriptionReport.notRenewed}개소, 기록 확인 ${subscriptionReport.conflict}개소`,
            `- 재가입 ${subscriptionReport.rejoined}개소 (갱신율과 별도)`,
            `- 첫 갱신율 : ${subscriptionReport.renewal.first.rate ?? '-'}${subscriptionReport.renewal.first.rate === null ? '' : '%'} (갱신 ${subscriptionReport.renewal.first.renewed} / 만료 경과 ${subscriptionReport.renewal.first.target})`,
            `- 반복 갱신율 : ${subscriptionReport.renewal.repeat.rate ?? '-'}${subscriptionReport.renewal.repeat.rate === null ? '' : '%'} (갱신 ${subscriptionReport.renewal.repeat.renewed} / 만료 경과 ${subscriptionReport.renewal.repeat.target})`,
            `- 전체 갱신율 : ${subscriptionReport.renewal.overall.rate ?? '-'}${subscriptionReport.renewal.overall.rate === null ? '' : '%'} (갱신 ${subscriptionReport.renewed} / 만료 경과 ${subscriptionReport.target})`,
            `- 과거 입금 연결 필요 대상 ${subscriptionReport.renewal.unknown.target}개소는 전체에만 포함`,
            `- 올해 오늘 만료 ${subscriptionReport.dueToday}개소, 만료 예정 ${subscriptionReport.renewal.overall.upcoming}개소는 갱신율 분모에서 제외`,
            `- 기준: 확인 가능한 농가×사업×만료 회차. 오늘(${subscriptionReport.asOfDate}) 이전 만료일 경과 대상 / 오늘까지 확인된 갱신. 결과가 없으면 미갱신.`,
            '- 월별 실적 (만료 농가 / 경과 / 갱신 / 미갱신 / 갱신율 / 예정[오늘 포함])',
            ...groupRenewalCycles(
              subscriptionReport.renewal.cycles,
              'month',
              workspace.projects,
              subscriptionReport.year,
            ).map(
              (month) =>
                `  ${Number(month.key.slice(5))}월: ${month.annualTarget} / ${month.target} / ${month.renewed} / ${month.notRenewed} / ${month.rate === null ? '-' : `${month.rate}%`} / ${month.upcoming + month.dueToday}`,
            ),
            `- 현재 사용 중 만료 예정 (내일부터, 전체 기간) : ${subscriptionReport.upcomingCount}개소`,
          ];
    if (
      subscriptionReportYear !== 'all' &&
      !subscriptionReport.upcoming.length
    ) {
      lines.push('  없음');
    }
    for (const year of subscriptionReportYear === 'all'
      ? []
      : subscriptionReport.upcoming) {
      lines.push(`  ${String(year.year).slice(-2)}년 : ${year.count}개소`);
      for (const month of year.months) {
        const projects = month.projects
          .map((project) => `${project.name} ${project.count}`)
          .join(', ');
        lines.push(
          `  → ${month.month}월 ${month.count}개소${projects ? ` : ${projects}` : ''}`,
        );
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.add({
        title: '구독 실적 보고문을 복사했습니다',
        description: '보고서나 메신저에 바로 붙여넣을 수 있습니다.',
        type: 'success',
      });
    } catch {
      toast.add({
        title: '보고문을 복사하지 못했습니다',
        description: '브라우저의 클립보드 권한을 확인해 주세요.',
        type: 'warning',
      });
    }
  }

  async function saveQuickWork(
    input: AddFarmHistoryEntryInput,
    images: ReceivedImage[],
  ) {
    const response = await farmLedgerFetch('/api/farm-ledger', {
      method: 'POST',
      body: JSON.stringify({ kind: 'history', history: input, images }),
    });
    const data = await readResponse(response);
    if (!response.ok)
      throw new Error(data.error || '업무 변경을 저장하지 못했습니다.');
    await waitForFarmLedgerSync();
    toast.add({ title: '업무 상태·처리 기록을 저장했습니다', type: 'success' });
  }

  async function createChildTask(
    title: string,
    owner: string,
    dueDate: string,
    content: string,
    images: ReceivedImage[],
    operationId: string,
    occurredAt: number,
  ) {
    if (!childTaskParent) throw new Error('상위 업무를 다시 선택해 주세요.');
    const response = await farmLedgerFetch('/api/farm-ledger', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'work_item',
        images,
        checklist: [],
        sourceInboxId: '',
        operationId,
        workItem: {
          ...emptyWorkItemForm(),
          projectId: childTaskParent.projectId,
          parentWorkItemId: childTaskParent.id,
          farmRecordId: '',
          workType: 'communication',
          title,
          owner,
          dueDate,
          status: 'open',
          responseDueAt: 0,
        },
        history: {
          channel: content || images.length ? 'other' : 'system',
          sender: '',
          receivedContent: content,
          actionContent:
            content || images.length ? '' : '세부 업무를 등록했습니다.',
          amount: 0,
          recorder: accountName || accountEmail,
          occurredAt,
          referenceUrl: '',
        },
      }),
    });
    const data = await readResponse(response);
    if (!response.ok)
      throw new Error(data.error || '세부 업무를 등록하지 못했습니다.');
    await waitForFarmLedgerSync();
    toast.add({ title: '세부 업무를 추가했습니다', type: 'success' });
  }

  function openHistoryDialog(workItem: FarmWorkItem, advanced = false) {
    if (!advanced && workItem.workType !== 'payment') {
      setQuickDetailTaskId(workItem.id);
      return;
    }
    setDraftImages([]);
    historyExpectedVersion.current = workItem.updatedAt;
    setSelectedWorkItemId(workItem.id);
    setHistoryForm(
      emptyHistoryForm(
        workItem.status,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.owner,
        workItem.dueDate,
        workItem.expectedOutcome,
        workItem.responseDueAt
          ? localDateTimeValue(new Date(workItem.responseDueAt))
          : '',
        workItem.blockedReason,
        workItem.blockedBy,
        workItem.expectedUnblockDate,
      ),
    );
    setFormError('');
    setDialog('history');
  }

  function openVisitDialog(visit?: FarmWorkVisit) {
    if (!selectedWorkItem) return;
    if (selectedWorkItem.status === 'completed') {
      toast.add({
        title: '완료된 업무입니다',
        description: '업무를 다시 진행 상태로 바꾼 뒤 방문을 추가해 주세요.',
        type: 'warning',
      });
      return;
    }
    if (visit && visit.status !== 'scheduled') {
      toast.add({
        title: '완료·취소 기록은 잠겨 있습니다',
        description: '현장 증빙을 보존하기 위해 사후 수정할 수 없습니다.',
        type: 'warning',
      });
      return;
    }
    setVisitForm(
      visit
        ? {
            id: visit.id,
            scheduledAt: localDateTimeValue(new Date(visit.scheduledAt)),
            assignedTo: visit.assignedTo,
            status: visit.status,
            actualStartedAt: visit.actualStartedAt
              ? localDateTimeValue(new Date(visit.actualStartedAt))
              : '',
            actualEndedAt: visit.actualEndedAt
              ? localDateTimeValue(new Date(visit.actualEndedAt))
              : '',
            preparationNote: visit.preparationNote,
            result: visit.result,
            nextVisitAt: visit.nextVisitAt
              ? localDateTimeValue(new Date(visit.nextVisitAt))
              : '',
            recordedBy: visit.recordedBy,
          }
        : emptyVisitForm(selectedWorkItem.owner),
    );
    setFormError('');
    setDialog('visit');
  }

  function openInboxDialog(projectId = '') {
    setDraftImages([]);
    setInboxForm({
      ...emptyInboxForm(),
      projectId,
      capturedBy: accountName || accountEmail,
    });
    setFormError('');
    setDialog('inbox');
  }

  function openInboxRoute(item: FarmInboxItem) {
    setInboxRouteProjectId(item.projectId || '');
    const defaultFarmId = selectedFarm?.id ?? '';
    const records = defaultFarmId
      ? (recordsByFarm.get(defaultFarmId) ?? [])
      : [];
    setClarifyingInboxId(item.id);
    setInboxRouteFarmId(defaultFarmId);
    setInboxRouteRecordId(records.length === 1 ? records[0].id : '');
    setInboxFarmSearch('');
    setFormError('');
    setDialog('inbox_route');
  }

  function continueInboxRoute() {
    setDraftImages([]);
    if (inboxRouteProjectId) {
      void convertInboxToProjectTask();
      return;
    }
    const inboxItem = workspace.inboxItems.find(
      (item) => item.id === clarifyingInboxId,
    );
    const record = recordById.get(inboxRouteRecordId);
    if (!inboxItem || !record || record.farmId !== inboxRouteFarmId) {
      setFormError('농가와 연결 사업을 선택해 주세요.');
      return;
    }
    openFarm(inboxRouteFarmId);
    setWorkItemForm({
      ...emptyWorkItemForm(record.id),
      title: inboxItem.content.replace(/\s+/g, ' ').slice(0, 70),
      description: '수신함에서 정리한 요청입니다.',
      expectedOutcome:
        '요청 사항을 처리하고 농가 또는 사업 담당자에게 결과를 확인받습니다.',
      responseDueAt: responseTargetValue(
        'medium',
        new Date(inboxItem.receivedAt),
      ),
      channel: inboxItem.channel,
      sender: inboxItem.sender,
      receivedContent: inboxItem.content,
      recorder: inboxItem.capturedBy,
      occurredAt: localDateTimeValue(new Date(inboxItem.receivedAt)),
      referenceUrl: inboxItem.referenceUrl,
    });
    setFormError('');
    setDialog('work_item');
  }

  async function convertInboxToProjectTask() {
    if (submitting) return;
    const source = workspace.inboxItems.find(
      (item) => item.id === clarifyingInboxId,
    );
    if (!source || !inboxRouteProjectId) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'work_item',
          sourceInboxId: source.id,
          checklist: [],
          workItem: {
            ...emptyWorkItemForm(),
            farmRecordId: '',
            projectId: inboxRouteProjectId,
            title:
              source.content.replace(/\s+/g, ' ').slice(0, 100) ||
              '첨부 이미지 확인 및 처리',
            owner: accountName || accountEmail,
            responseDueAt: 0,
          },
          history: {
            channel: source.channel,
            sender: source.sender,
            receivedContent: source.content,
            actionContent: '',
            amount: 0,
            recorder: accountName || accountEmail,
            occurredAt: source.receivedAt,
            referenceUrl: source.referenceUrl,
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.workItem)
        throw new Error(data.error || '업무로 연결하지 못했습니다.');
      await waitForFarmLedgerSync();
      setDialog(null);
      setWorkMode('board');
      openDetail({
        kind: 'work',
        farmId: '',
        workItemId: (data.workItem as FarmWorkItem).id,
        projectId: inboxRouteProjectId,
      });
      toast.add({
        title: '프로젝트 하위 업무로 연결했습니다',
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : '업무로 연결하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSubscriptionEvent(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'subscription_event',
          subscriptionEvent: {
            ...subscriptionEventForm,
            basisRenewalCount:
              subscriptionEventForm.basisRenewalCount === ''
                ? null
                : Number(subscriptionEventForm.basisRenewalCount),
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.subscriptionEvent) {
        throw new Error(data.error || '구독 처리 결과를 저장하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title: `구독 ${FARM_SUBSCRIPTION_EVENT_TYPE_LABELS[subscriptionEventForm.eventType]} 처리를 등록했습니다`,
        description: '기간 실적과 만료 예정 현황에 자동 반영했습니다.',
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '구독 처리 결과를 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSubscriptionExpiry(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'subscription_expiry_correction',
          correction: subscriptionExpiryForm,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.record) {
        throw new Error(data.error || '구독 만료일을 저장하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title: '구독 만료일을 저장했습니다',
        description: '관리대장과 만료 예정 현황에 바로 반영했습니다.',
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '구독 만료일을 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInbox(event: FormSubmitEvent) {
    event.preventDefault();
    if (imagesBusy || submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'inbox',
          inboxItem: {
            ...inboxForm,
            images: draftImages,
            receivedAt: new Date(inboxForm.receivedAt).getTime(),
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.inboxItem) {
        throw new Error(data.error || '수신 내용을 저장하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      setWorkMode(inboxForm.projectId ? 'board' : 'inbox');
      setDialog(null);
      toast.add({
        title: inboxForm.projectId
          ? '프로젝트 하위 업무로 등록했습니다'
          : '수신함에 담았습니다',
        description: inboxForm.projectId
          ? '수신 원문과 첨부 이미지는 업무의 첫 기록에 연결했습니다.'
          : '업무로 정리할 때까지 원문과 이미지를 보관합니다.',
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '수신 내용을 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function changeInboxStatus(
    item: FarmInboxItem,
    status: 'reference' | 'discarded',
  ) {
    setSubmitting(true);
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'inbox_status',
          inboxItemId: item.id,
          status,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.inboxItem) {
        throw new Error(data.error || '수신함 상태를 바꾸지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      toast.add({
        title:
          status === 'reference'
            ? '참고 자료로 보관했습니다'
            : '처리 대상에서 제외했습니다',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: '수신함을 정리하지 못했습니다',
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleChecklistItem(itemId: string, isCompleted: boolean) {
    if (!selectedWorkItem) return;
    if (checklistSubmitting || selectedWorkItem.status === 'completed') return;
    if (!checklistActor.trim()) {
      toast.add({ title: '확인 담당자를 먼저 입력해 주세요', type: 'error' });
      return;
    }
    setChecklistSubmitting(true);
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'checklist',
          workItemId: selectedWorkItem.id,
          checklistItemId: itemId,
          isCompleted,
          completedBy: checklistActor,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.checklistItem) {
        throw new Error(data.error || '체크리스트를 저장하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
    } catch (error) {
      toast.add({
        title: '체크리스트를 저장하지 못했습니다',
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
      });
    } finally {
      setChecklistSubmitting(false);
    }
  }

  function exportFarmLedgerCsv() {
    const header = [
      '농장번호',
      '농가명',
      '연락처',
      '지역',
      '주소',
      '사업명',
      '사업연도',
      '작물',
      '장비',
      '제품',
      '설치일',
      '시운전일',
      '교육일',
      '구독상태',
      '구독만료일',
      '마지막입금일',
      '갱신횟수',
    ];
    const rows = workspace.records.map((record) => {
      const farm = farmById.get(record.farmId);
      const project = projectById.get(record.projectId);
      return [
        farm?.farmCode ?? '',
        farm?.name ?? '',
        farm?.phone ?? '',
        farm?.region ?? '',
        farm?.address ?? '',
        project?.name ?? '',
        project?.year ?? '',
        record.crop,
        record.deviceType,
        record.productType,
        record.installationDate,
        record.commissioningDate,
        record.educationDate,
        SUBSCRIPTION_STATUS_LABELS[record.subscriptionStatus],
        record.currentSubscriptionExpiresAt,
        record.lastPaymentDate,
        record.renewalCount,
      ];
    });
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `팜로그_관리대장_${localDateString()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.add({
      title: '관리대장을 내보냈습니다',
      description: `${rows.length}개 사업 참여 행`,
      type: 'success',
    });
  }

  async function submitProject(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: editingProjectId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'project',
          projectId: editingProjectId,
          expectedUpdatedAt: projectExpectedVersion.current,
          project: projectForm.settlementRounds
            ? withSettlementRounds(projectForm, projectForm.settlementRounds)
            : projectForm,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.project)
        throw new Error(data.error || '사업을 저장하지 못했습니다.');
      const saved = data.project as FarmProject;
      await waitForFarmLedgerSync();
      openProjectDetail(saved.id);
      setDialog(null);
      toast.add({
        title: editingProjectId
          ? '사업 정보를 수정했습니다'
          : '사업을 등록했습니다',
        description: projectForm.name,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : '사업을 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmProjectDeletion(
    project: FarmProject,
    deleted: boolean,
  ) {
    const response = await farmLedgerFetch('/api/farm-ledger', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'project_lifecycle',
        projectId: project.id,
        expectedUpdatedAt: project.updatedAt,
        deleted,
      }),
    });
    const data = await readResponse(response);
    if (!response.ok || !data.project)
      throw new Error(
        data.error || '프로젝트 삭제·복구를 저장하지 못했습니다.',
      );
    await waitForFarmLedgerSync();
    if (deleted && selectedProjectId === project.id)
      setDeletedProjectToClose(project.id);
    toast.add({
      title: deleted ? '프로젝트를 삭제했습니다' : '프로젝트를 복구했습니다',
      description: deleted
        ? '연결된 기록은 보존되며 삭제한 프로젝트에서 복구할 수 있습니다.'
        : project.name,
      type: 'success',
    });
  }

  function workDeleteAction(item: FarmWorkItem, disabled = false) {
    if (!isActiveWork(item) || !canManageWorkDeletion(item, member))
      return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-red-700 hover:text-red-800"
        disabled={disabled}
        aria-label={`${item.title} 삭제`}
        onClick={() => setWorkDeletionTarget(item)}
      >
        삭제
      </Button>
    );
  }

  async function confirmWorkDeletion(
    task: FarmWorkItem,
    deleted: boolean,
    operationId: string,
  ) {
    const response = await farmLedgerFetch('/api/farm-ledger', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'work_lifecycle',
        workItemId: task.id,
        expectedUpdatedAt: task.updatedAt,
        deleted,
        operationId,
      }),
    });
    const data = await readResponse(response);
    if (!response.ok || !data.workItem)
      throw new Error(data.error || '업무 삭제·복원을 저장하지 못했습니다.');
    await waitForFarmLedgerSync();
    toast.add({
      title: deleted ? '업무를 삭제했습니다' : '업무를 복원했습니다',
      description: deleted
        ? '처리 이력은 보존됩니다. 업무 현황의 삭제된 업무에서 복원할 수 있습니다.'
        : task.title,
      type: 'success',
    });
  }

  async function submitProjectDocument(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: editingProjectDocumentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'project_document',
          projectId: selectedProject.id,
          documentId: editingProjectDocumentId,
          document: projectDocumentForm,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.document)
        throw new Error(data.error || '제출서류를 저장하지 못했습니다.');
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title: editingProjectDocumentId
          ? '제출서류를 수정했습니다'
          : '제출서류를 추가했습니다',
        description: projectDocumentForm.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '제출서류를 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProjectUpdate(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'project_update',
          projectId: selectedProject.id,
          update: {
            ...projectUpdateForm,
            occurredAt: new Date(projectUpdateForm.occurredAt).getTime(),
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.update)
        throw new Error(data.error || '프로젝트 기록을 저장하지 못했습니다.');
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title:
          projectUpdateForm.kind === 'blocker'
            ? '프로젝트 막힘을 등록했습니다'
            : '프로젝트 기록을 저장했습니다',
        description: projectUpdateForm.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '프로젝트 기록을 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProjectBlockerResolution(event: FormSubmitEvent) {
    event.preventDefault();
    if (!resolvingProjectUpdateId) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'project_blocker_resolve',
          updateId: resolvingProjectUpdateId,
          ...projectBlockerResolutionForm,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.update)
        throw new Error(data.error || '막힘을 해결 처리하지 못했습니다.');
      await waitForFarmLedgerSync();
      setDialog(null);
      setResolvingProjectUpdateId('');
      toast.add({ title: '프로젝트 막힘을 해결했습니다', type: 'success' });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '막힘을 해결 처리하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFarm(event: FormSubmitEvent) {
    event.preventDefault();
    if (submitting || farmSaveBusyRef.current || farmImageBusyRef.current)
      return;
    const mode = dialog;
    const farmPayload: FarmInput = {
      farmCode: farmForm.farmCode,
      name: farmForm.name,
      phone: farmForm.phone,
      address: farmForm.address,
      region: farmForm.region,
      businessNumber: farmForm.businessNumber,
      folderUrl: farmForm.folderUrl,
      locationUrl: farmForm.locationUrl,
      specialNotes: farmForm.specialNotes,
    };
    const recordPayload: FarmRecordInput = {
      projectId: farmForm.projectId,
      crop: farmForm.crop,
      deviceType: farmForm.deviceType,
      productType: farmForm.productType,
      vendor: farmForm.vendor,
      productionSetupDate: farmForm.productionSetupDate,
      installationDate: farmForm.installationDate,
      commissioningDate: farmForm.commissioningDate,
      educationDate: farmForm.educationDate,
      internetType: farmForm.internetType,
      warrantyYears: farmForm.warrantyYears,
      warrantyExpiresAt: farmForm.warrantyExpiresAt,
      subscriptionYears: farmForm.subscriptionYears,
      initialSubscriptionExpiresAt: farmForm.initialSubscriptionExpiresAt,
      currentSubscriptionExpiresAt: farmForm.currentSubscriptionExpiresAt,
      lastPaymentDate: farmForm.lastPaymentDate,
      renewalCount: farmForm.renewalCount,
      subscriptionStatus: farmForm.subscriptionStatus,
      notes: farmForm.notes,
    };
    if ((mode === 'record_add' || mode === 'record_edit') && !selectedFarm)
      return;
    if (
      mode === 'record_add' &&
      hasProjectParticipation(allSelectedRecords, recordPayload.projectId)
    ) {
      setFormError('이미 참여 중인 사업입니다. 다른 사업을 선택해 주세요.');
      return;
    }
    if (
      mode === 'record_edit' &&
      hasProjectParticipation(
        allSelectedRecords,
        recordPayload.projectId,
        editingRecordId,
      )
    ) {
      setFormError('같은 농가에 동일 사업을 중복 연결할 수 없습니다.');
      return;
    }
    farmSaveBusyRef.current = true;
    setSubmitting(true);
    setFormError('');
    try {
      const isFarmCreate = mode === 'farm';
      const isFarmEdit = mode === 'farm_edit';
      const isRecordAdd = mode === 'record_add';
      const responseBody = isFarmCreate
        ? {
            kind: 'farm',
            farm: farmPayload,
            record: recordPayload,
            recorder: farmForm.recorder,
            locationImages: farmLocationImages,
            locationImageIds: farmLocationIds,
            expectedLocationImageIds: farmLocationExpectedIds,
          }
        : isFarmEdit
          ? {
              kind: 'farm',
              farmId: editingFarmId,
              expectedFarmUpdatedAt: editingFarmVersion,
              farm: farmPayload,
              locationImages: farmLocationImages,
              locationImageIds: farmLocationIds,
              expectedLocationImageIds: farmLocationExpectedIds,
            }
          : isRecordAdd
            ? {
                kind: 'record',
                farmId: selectedFarm?.id,
                record: recordPayload,
                recorder: farmForm.recorder,
              }
            : {
                kind: 'record',
                recordId: editingRecordId,
                record: recordPayload,
                recorder: farmForm.recorder,
              };
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: isFarmCreate || isRecordAdd ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseBody),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        throw new Error(data.error || '관리대장 정보를 저장하지 못했습니다.');
      }
      const createdFarmId =
        isFarmCreate && data.farm && typeof data.farm === 'object'
          ? (data.farm as { id: string }).id
          : isFarmEdit
            ? editingFarmId
            : selectedFarm?.id;
      await waitForFarmLedgerSync();
      if (createdFarmId)
        openFarm(
          createdFarmId,
          '',
          isFarmEdit ? farmContextProjectId : recordPayload.projectId,
        );
      setDialog(null);
      const title = isFarmCreate
        ? '농가를 등록했습니다'
        : isFarmEdit
          ? '농가 기본정보를 수정했습니다'
          : isRecordAdd
            ? '참여 사업을 추가했습니다'
            : '설치·구독 정보를 수정했습니다';
      toast.add({
        title,
        description:
          isFarmCreate || isFarmEdit
            ? farmForm.name
            : projectById.get(recordPayload.projectId)?.name,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '관리대장 정보를 저장하지 못했습니다.',
      );
    } finally {
      farmSaveBusyRef.current = false;
      setSubmitting(false);
    }
  }

  function preparePaymentRequest(
    operationId: string,
    recordId: string,
    amount: number,
    occurredAt: string,
    isPayment: boolean,
  ) {
    if (!isPayment || amount === 0) return undefined;
    const record = recordById.get(recordId);
    if (!record) throw new Error('입금을 연결할 농가·사업을 확인해 주세요.');
    calculateSubscriptionPayment({
      amount,
      currentExpiryDate: record.currentSubscriptionExpiresAt,
      paymentDate: occurredAt.slice(0, 10),
      today: localDateString(),
    });
    const prior = paymentRequestsRef.current.get(operationId);
    if (prior) return prior;
    const request = {
      operationId,
      expectedCurrentExpiryDate: record.currentSubscriptionExpiresAt,
      expectedUpdatedAt: record.updatedAt,
    };
    if (paymentRequestsRef.current.size > 30)
      paymentRequestsRef.current.clear();
    paymentRequestsRef.current.set(operationId, request);
    return request;
  }

  async function submitWorkItem(event: FormSubmitEvent) {
    event.preventDefault();
    if (imagesBusy || submitting) return;
    if (!selectedFarm) return;
    if (!workItemForm.farmRecordId) {
      setFormError('업무를 연결할 참여 사업을 선택해 주세요.');
      return;
    }
    if (
      !workItemForm.receivedContent.trim() &&
      !workItemForm.actionContent.trim() &&
      !draftImages.length &&
      !clarifyingInboxId
    ) {
      setFormError('최초 받은 내용 또는 처리 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'work_item',
          images: draftImages,
          paymentRequest: preparePaymentRequest(
            workItemForm.paymentOperationId,
            workItemForm.farmRecordId,
            workItemForm.amount,
            workItemForm.occurredAt,
            workItemForm.workType === 'payment',
          ),
          workItem: {
            farmId: selectedFarm.id,
            farmRecordId: workItemForm.farmRecordId,
            workType: workItemForm.workType,
            title: workItemForm.title,
            status: workItemForm.status,
            owner: workItemForm.owner,
            dueDate: workItemForm.dueDate,
            description: workItemForm.description,
            expectedOutcome: workItemForm.expectedOutcome,
            nextAction:
              workItemForm.status === 'completed'
                ? ''
                : workItemForm.nextAction,
            priority: workItemForm.priority,
            reviewDate:
              workItemForm.status === 'completed'
                ? ''
                : workItemForm.reviewDate,
            responseDueAt: workItemForm.responseDueAt
              ? new Date(workItemForm.responseDueAt).getTime()
              : 0,
            blockedReason:
              workItemForm.status === 'waiting'
                ? workItemForm.blockedReason
                : '',
            blockedBy:
              workItemForm.status === 'waiting' ? workItemForm.blockedBy : '',
            expectedUnblockDate:
              workItemForm.status === 'waiting'
                ? workItemForm.expectedUnblockDate
                : '',
          },
          history: {
            channel: workItemForm.channel,
            sender: workItemForm.sender,
            receivedContent: workItemForm.receivedContent,
            actionContent: workItemForm.actionContent,
            amount: workItemForm.amount,
            recorder: workItemForm.recorder,
            occurredAt: new Date(workItemForm.occurredAt).getTime(),
            referenceUrl: workItemForm.referenceUrl,
          },
          checklist: workItemForm.checklistText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          sourceInboxId: clarifyingInboxId,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.workItem)
        throw new Error(data.error || '업무를 등록하지 못했습니다.');
      const savedWorkItem = data.workItem as FarmWorkItem;
      await waitForFarmLedgerSync();
      openFarm(savedWorkItem.farmId, savedWorkItem.id);
      setClarifyingInboxId('');
      setDialog(null);
      toast.add({
        title: '업무를 등록했습니다',
        description:
          workItemForm.workType === 'payment' && workItemForm.amount > 0
            ? '입금과 구독 자동 갱신을 함께 저장했습니다.'
            : workItemForm.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : '업무를 등록하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitHistory(event: FormSubmitEvent) {
    event.preventDefault();
    if (imagesBusy || submitting) return;
    if (!selectedWorkItem) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'history',
          images: draftImages,
          paymentRequest: preparePaymentRequest(
            historyForm.paymentOperationId,
            selectedWorkItem.farmRecordId,
            historyForm.amount,
            historyForm.occurredAt,
            selectedWorkItem.workType === 'payment',
          ),
          history: {
            workItemId: selectedWorkItem.id,
            expectedUpdatedAt: historyExpectedVersion.current,
            channel: historyForm.channel,
            sender: historyForm.sender,
            receivedContent: historyForm.receivedContent,
            actionContent: historyForm.actionContent,
            amount: historyForm.amount,
            recorder: historyForm.recorder,
            occurredAt: new Date(historyForm.occurredAt).getTime(),
            referenceUrl: historyForm.referenceUrl,
            newStatus: historyForm.newStatus,
            nextAction:
              historyForm.newStatus === 'completed'
                ? ''
                : historyForm.nextAction,
            reviewDate:
              historyForm.newStatus === 'completed'
                ? ''
                : historyForm.reviewDate,
            priority: historyForm.priority,
            owner: historyForm.owner,
            dueDate: historyForm.dueDate,
            expectedOutcome: historyForm.expectedOutcome,
            responseDueAt: historyForm.responseDueAt
              ? new Date(historyForm.responseDueAt).getTime()
              : 0,
            markResponded: historyForm.markResponded,
            blockedReason:
              historyForm.newStatus === 'waiting'
                ? historyForm.blockedReason
                : '',
            blockedBy:
              historyForm.newStatus === 'waiting' ? historyForm.blockedBy : '',
            expectedUnblockDate:
              historyForm.newStatus === 'waiting'
                ? historyForm.expectedUnblockDate
                : '',
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.historyEntry) {
        throw new Error(data.error || '진행 기록을 추가하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title: '진행 기록을 추가했습니다',
        description:
          selectedWorkItem.workType === 'payment' && historyForm.amount > 0
            ? '입금과 구독 자동 갱신을 함께 저장했습니다.'
            : selectedWorkItem.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '진행 기록을 추가하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVisit(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedWorkItem) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await farmLedgerFetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'visit',
          visit: {
            id: visitForm.id,
            workItemId: selectedWorkItem.id,
            scheduledAt: new Date(visitForm.scheduledAt).getTime(),
            assignedTo: visitForm.assignedTo,
            status: visitForm.status,
            actualStartedAt: visitForm.actualStartedAt
              ? new Date(visitForm.actualStartedAt).getTime()
              : 0,
            actualEndedAt: visitForm.actualEndedAt
              ? new Date(visitForm.actualEndedAt).getTime()
              : 0,
            preparationNote: visitForm.preparationNote,
            result: visitForm.result,
            nextVisitAt: visitForm.nextVisitAt
              ? new Date(visitForm.nextVisitAt).getTime()
              : 0,
            recordedBy: visitForm.recordedBy,
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.visit) {
        throw new Error(data.error || '현장 방문 기록을 저장하지 못했습니다.');
      }
      await waitForFarmLedgerSync();
      setDialog(null);
      toast.add({
        title: visitForm.id
          ? '현장 방문 기록을 수정했습니다'
          : '현장 방문 일정을 등록했습니다',
        description: selectedWorkItem.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '현장 방문 기록을 저장하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function farmRow(farm: Farm) {
    const record = primaryRecordForFarm(farm);
    const records = recordsByFarm.get(farm.id) ?? [];
    const scopedRecords =
      projectFilter === 'all'
        ? records
        : records.filter((item) => item.projectId === projectFilter);
    return {
      record,
      project: record ? projectById.get(record.projectId) : null,
      latestWorkItem: workItemsByFarm.get(farm.id)?.find(isActiveWork) ?? null,
      subscriptionStatus: effectiveFarmSubscriptionStatus(
        scopedRecords,
        subscriptionToday,
      ),
    };
  }

  function WorkItemCard({
    workItem,
    compact = false,
  }: {
    workItem: FarmWorkItem;
    compact?: boolean;
  }) {
    const project = projectForWorkItem(workItem);
    const latestReceived = latestEntryWith(workItem, 'receivedContent');
    const latestAction = latestEntryWith(workItem, 'actionContent');
    const checklist = checklistByWorkItem.get(workItem.id) ?? [];
    const completedChecklist = checklist.filter(
      (item) => item.isCompleted,
    ).length;
    const responseState = responseRisk(workItem, riskNow);
    const nextVisit = (visitsByWorkItem.get(workItem.id) ?? [])
      .filter((visit) => visit.status === 'scheduled')
      .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    const isSelected = selectedWorkItemId === workItem.id;
    return (
      <button
        type="button"
        onClick={() => openFarm(workItem.farmId, workItem.id)}
        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
          isSelected
            ? 'border-[#8ec5a1] bg-[#f3faf5] shadow-sm'
            : 'border-[#dfe6dd] bg-white hover:border-[#bdd8c5]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <WorkIcon type={workItem.workType} className="size-3" />
                {FARM_WORK_TYPE_LABELS[workItem.workType]}
              </Badge>
              <Badge
                variant="outline"
                className={workStatusClass(workItem.status)}
              >
                {FARM_WORK_STATUS_LABELS[workItem.status]}
              </Badge>
              <Badge
                variant="outline"
                className={workPriorityClass(workItem.priority)}
              >
                {FARM_WORK_PRIORITY_LABELS[workItem.priority]}
              </Badge>
              {responseState !== 'none' && (
                <Badge
                  variant="outline"
                  className={responseRiskClass(responseState)}
                >
                  {responseRiskLabel(responseState)}
                </Badge>
              )}
            </div>
            <h4 className="mt-2 font-semibold text-[#29382f]">
              {workItem.title}
            </h4>
            <p className="mt-1 truncate text-xs text-[#7b877f]">
              {project?.name ?? '사업 미연결'} · 담당{' '}
              {workItem.owner || '미지정'}
            </p>
          </div>
          <time className="shrink-0 text-[11px] text-[#929b94]">
            {formatTimestamp(workItem.lastActivityAt, true)}
          </time>
        </div>
        <div className="mt-3 rounded-xl bg-[#f4f8f2] p-3">
          {workItem.status === 'waiting' && (
            <div className="mb-3 rounded-lg border border-[#efc9bd] bg-[#fff3ef] p-2.5">
              <p className="text-[11px] font-semibold text-[#a34e33]">
                막힌 지 {elapsedDays(workItem.blockedAt)}일 ·{' '}
                {workItem.blockedBy || '해제 주체 미입력'}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#744d40]">
                {workItem.blockedReason || '막힘 사유를 확인해 주세요.'}
              </p>
            </div>
          )}
          <p className="text-[11px] font-semibold text-[#4e765b]">다음 행동</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#435349]">
            {workItem.status === 'completed'
              ? '완료된 업무입니다.'
              : workItem.nextAction || '다음 행동을 정해 주세요.'}
          </p>
          {checklist.length > 0 && (
            <p className="mt-2 text-[11px] text-[#7b877f]">
              체크리스트 {completedChecklist}/{checklist.length}
            </p>
          )}
          {nextVisit && (
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#4f6f5a]">
              <MapPin className="size-3" /> 다음 현장 방문{' '}
              {formatTimestamp(nextVisit.scheduledAt, true)} ·{' '}
              {nextVisit.assignedTo}
            </p>
          )}
        </div>
        {!compact && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f6f8f6] p-3">
              <p className="text-[11px] font-semibold text-[#78847c]">
                마지막 받은 내용
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4e5c53]">
                {latestReceived?.receivedContent ||
                  (latestReceived?.imageIds?.length
                    ? `첨부 이미지 ${latestReceived.imageIds.length}장`
                    : '받은 내용이 없습니다.')}
              </p>
            </div>
            <div className="rounded-xl bg-[#eef6f0] p-3">
              <p className="text-[11px] font-semibold text-[#477356]">
                마지막 처리 내용
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4e5c53]">
                {latestAction?.actionContent || '처리 내용이 없습니다.'}
              </p>
            </div>
          </div>
        )}
      </button>
    );
  }

  const projectHasSettlementRisk = (project: FarmProject) => {
    const due = daysUntil(project.settlementDueDate);
    return (
      project.settlementStatus === 'revision' ||
      (!['paid', 'closed'].includes(project.settlementStatus) &&
        due !== null &&
        due < 0)
    );
  };
  const projectRiskCount = (project: FarmProject) => {
    const snapshot = projectSnapshots.get(project.id);
    if (!snapshot) return 0;
    return (
      snapshot.openProjectBlockers.length +
      snapshot.blockedItems.length +
      snapshot.documentRisks.length +
      snapshot.expiringSoon.length +
      snapshot.expiredSubscriptions.length +
      snapshot.missingSubscriptionExpiry.length +
      (projectHasSettlementRisk(project) ? 1 : 0)
    );
  };
  const normalizedProjectSearch = projectSearch.trim().toLocaleLowerCase();
  const filteredProjects = yearProjects
    .filter((project) => {
      const snapshot = projectSnapshots.get(project.id);
      const matchesSearch =
        !normalizedProjectSearch ||
        [
          project.name,
          project.institution,
          project.manager,
          String(project.year),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedProjectSearch);
      if (!matchesSearch || !snapshot) return false;
      if (projectRiskFilter === 'blocked')
        return (
          snapshot.openProjectBlockers.length + snapshot.blockedItems.length > 0
        );
      if (projectRiskFilter === 'documents')
        return snapshot.documentRisks.length > 0;
      if (projectRiskFilter === 'subscription')
        return (
          snapshot.expiringSoon.length +
            snapshot.expiredSubscriptions.length +
            snapshot.missingSubscriptionExpiry.length >
          0
        );
      if (projectRiskFilter === 'settlement')
        return projectHasSettlementRisk(project);
      return true;
    })
    .sort(
      (a, b) =>
        projectRiskCount(b) - projectRiskCount(a) || b.updatedAt - a.updatedAt,
    );
  const selectedProjectSnapshot = selectedProject
    ? (projectSnapshots.get(selectedProject.id) ?? null)
    : null;
  const selectedProjectStageCards: Array<{
    label: string;
    progress: number | null;
    evidence: string;
  }> =
    selectedProject && selectedProjectSnapshot
      ? [
          {
            label: '협약·계약',
            progress: documentCategoryProgress(
              selectedProjectSnapshot.documents,
              'agreement',
            ),
            evidence: '협약·계약 서류 승인 기준',
          },
          {
            label: '참여농가 확정',
            progress: selectedProjectSnapshot.farmCoverage,
            evidence: selectedProject.targetFarmCount
              ? `${selectedProjectSnapshot.records.length}/${selectedProject.targetFarmCount}곳`
              : '목표 농가 수 미입력',
          },
          {
            label: '설치·시운전',
            progress: averageRates(
              selectedProjectSnapshot.productionRate,
              selectedProjectSnapshot.installationRate,
              selectedProjectSnapshot.commissioningRate,
            ),
            evidence: `제작 ${selectedProjectSnapshot.productionRate ?? '-'}% · 설치 ${selectedProjectSnapshot.installationRate ?? '-'}% · 시운전 ${selectedProjectSnapshot.commissioningRate ?? '-'}%`,
          },
          {
            label: '검수·교육',
            progress: averageRates(
              selectedProjectSnapshot.commissioningRate,
              selectedProjectSnapshot.educationRate,
            ),
            evidence: `시운전 ${selectedProjectSnapshot.commissioningRate ?? '-'}% · 교육 ${selectedProjectSnapshot.educationRate ?? '-'}%`,
          },
          {
            label: '운영·구독',
            progress: selectedProjectSnapshot.records.length
              ? Math.round(
                  (selectedProjectSnapshot.activeSubscriptions.length /
                    selectedProjectSnapshot.records.length) *
                    100,
                )
              : null,
            evidence: `유효 구독 ${selectedProjectSnapshot.activeSubscriptions.length}/${selectedProjectSnapshot.records.length}곳`,
          },
          {
            label: '정산·서류',
            progress: averageRates(
              selectedProjectSnapshot.documentRate,
              selectedProjectSnapshot.settlementProgress,
            ),
            evidence: `서류 승인 ${selectedProjectSnapshot.approvedDocuments.length}/${selectedProjectSnapshot.requiredDocuments.length} · 정산 ${projectSettlementLabel(selectedProject)}`,
          },
          {
            label: '사업 마감',
            progress: selectedProject.status === 'completed' ? 100 : 0,
            evidence:
              selectedProject.status === 'completed'
                ? '사업 완료 처리됨'
                : '필수서류·정산·막힘 확인 필요',
          },
        ]
      : [];
  const selectedProjectLatestReceived =
    selectedProjectSnapshot?.latestReceivedActivity;
  const selectedProjectLatestAction =
    selectedProjectSnapshot?.latestActionActivity;

  return (
    <Toaster toastManager={toast} timeout={4500}>
      <main className="farm-app min-h-screen">
        <a className="skip-link" href="#workspace-content">
          본문으로 바로가기
        </a>
        <div className="mx-auto flex min-h-screen max-w-[1920px]">
          <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col overflow-y-auto bg-[#15382e] px-3 py-5 text-white lg:flex">
            <div className="mb-7 flex items-center gap-3 px-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[#62b982] shadow-[0_10px_24px_rgba(98,185,130,0.24)]">
                <Leaf className="size-5" />
              </div>
              <div>
                <p className="font-bold">팜로그</p>
                <p className="text-xs text-white/70">스마트팜 업무관리</p>
              </div>
            </div>
            <nav aria-label="주요 메뉴" className="space-y-5">
              {[
                { label: '현황과 실행', ids: ['overview', 'projects', 'work'] },
                {
                  label: '농가와 운영',
                  ids: ['farms', 'subscriptions', 'service'],
                },
                {
                  label: '집계와 점검',
                  ids: ['business', 'quality', 'organization'],
                },
              ].map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 text-xs font-semibold text-white/60">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.ids
                      .map((id) => navItems.find((item) => item.id === id)!)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => changeView(item.id)}
                          aria-current={view === item.id ? 'page' : undefined}
                          className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm ${
                            view === item.id
                              ? 'bg-white font-semibold text-[#15382e] shadow-sm'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <item.icon className="size-[18px]" />
                          <span>{item.label}</span>
                          {item.count !== undefined && (
                            <span
                              className="ml-auto rounded-md bg-current/5 px-2 py-0.5 text-xs"
                              title={`${item.label} 전체 건수`}
                            >
                              {item.count}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#a9dfb9]" />
                <p className="text-xs font-semibold text-white/80">
                  팀 관리대장
                </p>
              </div>
              <p className="mt-3 truncate text-xs font-semibold text-white/85">
                {accountName}
              </p>
              {organization.personal && member && (
                <p className="mt-1 text-xs text-white/80">
                  {organization.departments.some(
                    (dept) =>
                      dept.id === member.departmentId &&
                      dept.headUid === member.id,
                  )
                    ? '부서장'
                    : member.jobTitle}
                  {member.admin ? ' · 관리자' : ''}
                </p>
              )}
              <p
                className="mt-1 truncate text-xs text-white/70"
                title={accountEmail}
              >
                {accountEmail}
              </p>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[#a9dfb9] hover:text-white"
              >
                <LogOut className="size-3" />
                로그아웃
              </button>
            </div>
          </aside>

          <section
            id="workspace-content"
            tabIndex={-1}
            className="min-w-0 flex-1"
          >
            <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-2 border-b border-[#d8e0e7] bg-white px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="grid size-9 place-items-center rounded-xl bg-[#2f7b59] text-white">
                  <Leaf className="size-5" />
                </div>
                <Select
                  value={view}
                  onValueChange={(value) => changeView(value as View)}
                >
                  <SelectTrigger
                    aria-label="화면 선택"
                    className="h-9 border-0 bg-transparent font-semibold shadow-none"
                  >
                    <SelectValue>
                      {navItems.find((item) => item.id === view)?.label ??
                        '화면 선택'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {navItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold">
                  {navItems.find((item) => item.id === view)?.label}
                  {selectedProject
                    ? ' / 프로젝트 상세'
                    : selectedWorkItem
                      ? ' / 업무 상세'
                      : selectedFarm
                        ? ' / 농가 상세'
                        : ''}
                </p>
                <p className="text-xs text-[#586777]">
                  {refreshing
                    ? '최신 내용을 확인하고 있습니다'
                    : `${activeProjects.length}개 사업 · ${workspace.farms.length}개 농가`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={onSignOut}
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`${accountName} 로그아웃`}
                  className="rounded-xl text-[#6e7c73] lg:hidden"
                >
                  <LogOut />
                </Button>
                <Button
                  onClick={() => void loadWorkspace(true)}
                  variant="ghost"
                  size="icon-lg"
                  aria-label="새로고침"
                  disabled={refreshing}
                  className="rounded-xl text-[#6e7c73]"
                >
                  {refreshing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                </Button>
              </div>
            </header>

            <div
              data-active-content={
                !selectedProject && !selectedFarm && !selectedWorkItem
                  ? 'true'
                  : 'false'
              }
              className={
                selectedProject || selectedFarm || selectedWorkItem
                  ? 'hidden'
                  : 'page-content'
              }
            >
              {loading ? (
                <div className="grid min-h-[60vh] place-items-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto size-7 animate-spin text-[#2f7b59]" />
                    <p className="mt-3 text-sm text-[#748178]">
                      농가 관리대장을 불러오는 중입니다.
                    </p>
                  </div>
                </div>
              ) : loadError ? (
                <div className="grid min-h-[60vh] place-items-center">
                  <div className="max-w-sm text-center">
                    <AlertCircle className="mx-auto size-8 text-[#b65e3a]" />
                    <h1 className="mt-3 font-bold">
                      관리대장을 불러오지 못했습니다
                    </h1>
                    <p className="mt-2 text-sm text-[#748178]">{loadError}</p>
                    <Button
                      onClick={() => void loadWorkspace()}
                      className="mt-5"
                    >
                      <RefreshCw />
                      다시 시도
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {view === 'overview' && (
                    <>
                      <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div>
                          <p className="mb-1 text-sm font-medium text-[#647568]">
                            사업 진행과 처리할 업무
                          </p>
                          <h1 className="text-[27px] font-bold tracking-[-0.04em] sm:text-[32px]">
                            통합 현황
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            진행 현황을 확인하고, 필요한 프로젝트와 업무를 바로
                            여세요.
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 xl:w-[430px]">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                            <Input
                              value={overviewSearch}
                              aria-label="프로젝트와 하위 업무 검색"
                              onChange={(event) =>
                                setOverviewSearch(event.target.value)
                              }
                              placeholder="프로젝트, 하위 업무, 농가, 담당자 검색"
                              className="h-10 rounded-xl border-[#dbe3d9] bg-white pl-9"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openScopedWork()}
                            >
                              <List />
                              전체 업무
                            </Button>
                            <Button
                              type="button"
                              onClick={openProjectDialog}
                              className="bg-[#2f7b59] hover:bg-[#286b4d]"
                            >
                              <Plus />
                              프로젝트 등록
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
                        <ProjectYearSelector
                          id="overview-project-year"
                          projects={activeProjects}
                          value={projectYearFilter}
                          onChange={setProjectYearFilter}
                        />
                        <ProjectTypeSelector
                          id="project-type-scope"
                          value={projectTypeFilter}
                          onChange={setProjectTypeFilter}
                        />
                      </div>
                      <ProjectKpiPanel
                        summary={yearProjectKpis}
                        year={projectYearFilter}
                        projectType={projectTypeFilter}
                        onSelect={selectProjectKpi}
                      />

                      <section className="mt-5 overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-[#e5ebe3] px-5 py-4 xl:flex-row xl:items-end xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-bold">
                                프로젝트별 하위 업무 처리 현황
                              </h2>
                              <Badge
                                variant="outline"
                                className="border-[#cfe0d1] bg-[#f2f8f2] text-[#39795b]"
                              >
                                {overviewProjectRows.length}개 프로젝트 표시
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#7d8981]">
                              프로젝트를 펼치면 연결된 하위 업무의 상태, 담당자,
                              마감일과 마지막 처리 내용을 볼 수 있습니다.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                {
                                  value: 'all',
                                  label: '전체',
                                  count: yearProjects.length,
                                },
                                {
                                  value: 'active',
                                  label: '진행',
                                  count: yearProjects.filter(
                                    (project) => project.status === 'active',
                                  ).length,
                                },
                                {
                                  value: 'on_hold',
                                  label: '보류',
                                  count: yearProjects.filter(
                                    (project) => project.status === 'on_hold',
                                  ).length,
                                },
                                {
                                  value: 'completed',
                                  label: '완료',
                                  count: yearProjects.filter(
                                    (project) => project.status === 'completed',
                                  ).length,
                                },
                              ] as const
                            ).map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setOverviewProjectStatus(option.value)
                                }
                                aria-pressed={
                                  overviewProjectStatus === option.value
                                }
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  overviewProjectStatus === option.value
                                    ? 'border-[#4f8f68] bg-[#eaf5ed] text-[#2f6f4d]'
                                    : 'border-[#dbe3d9] bg-white text-[#6f7b73] hover:bg-[#f5f8f4]'
                                }`}
                              >
                                {option.label} {option.count}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 bg-[#f6f8f5] p-3 sm:p-4">
                          {overviewProjectRows.map((row) => {
                            const projectMatches =
                              !overviewQuery ||
                              row.projectSearchableText.includes(overviewQuery);
                            const matchedWorkItems = projectMatches
                              ? row.workItems
                              : row.workItems.filter((item) =>
                                  [
                                    item.title,
                                    item.owner,
                                    item.nextAction,
                                    item.blockedReason,
                                    farmById.get(item.farmId)?.name ?? '',
                                  ]
                                    .join(' ')
                                    .toLocaleLowerCase('ko-KR')
                                    .includes(overviewQuery),
                                );
                            const showAllTasks =
                              overviewExpandedTaskProjects.includes(
                                row.project.id,
                              );

                            return (
                              <details
                                key={row.project.id}
                                className="group overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-[0_1px_2px_rgba(32,58,39,0.04)]"
                              >
                                <summary
                                  aria-label={`${row.project.name} 하위 업무 펼치기 또는 접기`}
                                  className="cursor-pointer list-none px-4 py-4 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden"
                                >
                                  <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(510px,0.9fr)_28px]">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                          variant="outline"
                                          className={projectStatusClass(
                                            row.project.status,
                                          )}
                                        >
                                          {
                                            FARM_PROJECT_STATUS_LABELS[
                                              row.project.status
                                            ]
                                          }
                                        </Badge>
                                        <Badge variant="outline">
                                          {
                                            FARM_PROJECT_STAGE_LABELS[
                                              row.project.currentStage
                                            ]
                                          }
                                        </Badge>
                                        {(row.overdue > 0 ||
                                          row.snapshot.openProjectBlockers
                                            .length > 0) && (
                                          <Badge
                                            variant="outline"
                                            className="border-[#efc8bb] bg-[#fff1ec] text-[#a94f32]"
                                          >
                                            확인 필요
                                          </Badge>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          openProjectDetail(row.project.id);
                                        }}
                                        className="mt-2 min-h-10 text-left text-base font-bold text-[#176448] hover:underline"
                                      >
                                        {row.project.name}
                                        <span className="ml-2 text-xs font-medium">
                                          상세 보기 →
                                        </span>
                                      </button>
                                      <p className="mt-1 truncate text-xs text-[#7d8981]">
                                        {row.project.year}년 ·{' '}
                                        {row.project.institution ||
                                          '기관 미입력'}{' '}
                                        · 담당 {row.project.manager || '미지정'}
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                      {[
                                        {
                                          label: '실행 업무',
                                          value:
                                            row.snapshot.hierarchy.leafCount,
                                          tone: 'bg-[#f2f5f1] text-[#4f5e54]',
                                        },
                                        {
                                          label: '접수',
                                          value: row.counts.open,
                                          tone: 'bg-[#fff4ed] text-[#9e5a36]',
                                        },
                                        {
                                          label: '처리 중',
                                          value: row.counts.inProgress,
                                          tone: 'bg-[#f0f5fb] text-[#416c9c]',
                                        },
                                        {
                                          label: '대기·막힘',
                                          value: row.counts.waiting,
                                          tone: 'bg-[#fff9ed] text-[#94601c]',
                                        },
                                        {
                                          label: '완료',
                                          value: row.counts.completed,
                                          tone: 'bg-[#eef8f1] text-[#2e7650]',
                                        },
                                      ].map((metric) => (
                                        <div
                                          key={metric.label}
                                          className={`rounded-xl px-3 py-2 text-center ${metric.tone}`}
                                        >
                                          <p className="text-[10px] font-medium opacity-80">
                                            {metric.label}
                                          </p>
                                          <p className="mt-0.5 text-sm font-bold">
                                            {metric.value}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                    <span className="flex items-center gap-2 text-sm text-[#586777] xl:justify-end">
                                      <span className="xl:sr-only">
                                        하위 업무 펼치기
                                      </span>
                                      <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" />
                                    </span>
                                  </div>
                                </summary>

                                <div className="border-t border-[#e8ede7] bg-white px-4 py-4 sm:px-5">
                                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                    <div>
                                      <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-semibold text-[#536158]">
                                          실행 업무 완료율
                                        </span>
                                        <strong className="text-[#316e4c]">
                                          {row.completionRate === null
                                            ? row.snapshot.hierarchy.missing
                                              ? '세부 업무 조회 확인 필요'
                                              : '업무 없음'
                                            : `${row.completionRate}% · ${row.counts.completed}/${row.snapshot.hierarchy.leafCount}건`}
                                        </strong>
                                      </div>
                                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ec]">
                                        <div
                                          className="h-full rounded-full bg-[#62b982]"
                                          style={{
                                            width: `${row.completionRate ?? 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline">
                                        참여 농가 {row.snapshot.records.length}
                                        곳
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={
                                          row.overdue
                                            ? 'border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]'
                                            : undefined
                                        }
                                      >
                                        기한초과 {row.overdue}건
                                      </Badge>
                                      <Badge variant="outline">
                                        7일 내 마감 {row.dueSoon}건
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={
                                          row.snapshot.openProjectBlockers
                                            .length
                                            ? 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]'
                                            : undefined
                                        }
                                      >
                                        프로젝트 직접 막힘{' '}
                                        {
                                          row.snapshot.openProjectBlockers
                                            .length
                                        }
                                        건
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                      <h3 className="text-sm font-bold">
                                        하위 업무{' '}
                                        {row.snapshot.hierarchy.rootCount}건
                                        <span className="ml-2 text-xs font-medium text-[#52735e]">
                                          세부 업무{' '}
                                          {row.snapshot.hierarchy.subtaskCount}
                                          건
                                        </span>
                                      </h3>
                                      <p className="mt-1 text-xs text-[#7d8981]">
                                        화살표로 세부 업무를 펼치고, 업무명을
                                        눌러 상세를 확인하세요. 실행 업무 수와
                                        완료율은 가장 마지막 단계 업무
                                        기준입니다.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        openProjectDetail(row.project.id)
                                      }
                                    >
                                      <BriefcaseBusiness /> 프로젝트 상세
                                    </Button>
                                  </div>

                                  {matchedWorkItems.length ? (
                                    <ProjectWorkTree
                                      items={row.workItems}
                                      matchedItems={matchedWorkItems}
                                      searching={Boolean(overviewQuery)}
                                      expanded={showAllTasks}
                                      onToggleExpanded={() =>
                                        setOverviewExpandedTaskProjects(
                                          (current) =>
                                            current.includes(row.project.id)
                                              ? current.filter(
                                                  (projectId) =>
                                                    projectId !==
                                                    row.project.id,
                                                )
                                              : [...current, row.project.id],
                                        )
                                      }
                                      onOpen={(item) =>
                                        openFarm(item.farmId, item.id)
                                      }
                                      farmName={(item) =>
                                        farmById.get(item.farmId)?.name ??
                                        '프로젝트 공통'
                                      }
                                      latestAction={(item) =>
                                        latestEntryWith(item, 'actionContent')
                                          ?.actionContent || ''
                                      }
                                      renderStatus={(item) => (
                                        <Badge
                                          variant="outline"
                                          className={`text-sm ${workStatusClass(item.status)}`}
                                        >
                                          {FARM_WORK_STATUS_LABELS[item.status]}
                                        </Badge>
                                      )}
                                      renderDueDate={(item) => (
                                        <div className="space-y-1">
                                          <p className="text-sm text-[#4d6054]">
                                            {formatDate(item.dueDate)}
                                          </p>
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${dueClass(item.dueDate, item.status === 'completed')}`}
                                          >
                                            {dueLabel(
                                              item.dueDate,
                                              item.status === 'completed',
                                            )}
                                          </Badge>
                                        </div>
                                      )}
                                    />
                                  ) : (
                                    <div className="mt-3 rounded-xl border border-dashed border-[#d7dfd5] bg-[#fafbf9] px-4 py-8 text-center">
                                      <ClipboardList className="mx-auto size-6 text-[#97a29a]" />
                                      <p className="mt-2 text-sm font-semibold">
                                        {row.workItems.length
                                          ? '검색 조건에 맞는 하위 업무가 없습니다.'
                                          : '등록된 하위 업무가 없습니다.'}
                                      </p>
                                      <p className="mt-1 text-xs text-[#89938c]">
                                        {row.workItems.length
                                          ? '검색어를 바꾸면 전체 업무를 확인할 수 있습니다.'
                                          : '참여 농가 상세에서 첫 업무를 등록할 수 있습니다.'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </details>
                            );
                          })}

                          {!overviewProjectRows.length && (
                            <div className="rounded-2xl border border-dashed border-[#d7dfd5] bg-white px-4 py-12 text-center">
                              <BriefcaseBusiness className="mx-auto size-8 text-[#97a29a]" />
                              <p className="mt-3 font-semibold">
                                {workspace.projects.length
                                  ? '선택한 연도·사업 타입·검색·상태에 맞는 프로젝트가 없습니다.'
                                  : '아직 등록된 프로젝트가 없습니다.'}
                              </p>
                              <p className="mt-1 text-sm text-[#89938c]">
                                {workspace.projects.length
                                  ? '검색어를 지우거나 프로젝트 상태를 전체로 바꿔 보세요.'
                                  : '프로젝트를 등록하면 하위 업무 처리 현황이 여기에 표시됩니다.'}
                              </p>
                              {workspace.projects.length > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="mt-4"
                                  onClick={() => {
                                    setOverviewSearch('');
                                    setOverviewProjectStatus('all');
                                    setProjectYearFilter('all');
                                    setProjectTypeFilter('all');
                                  }}
                                >
                                  필터 초기화
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </section>

                      <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_320px]">
                        <section className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-[#e5ebe3] px-5 py-4">
                            <div>
                              <h2 className="font-bold">
                                최근 업무·처리 히스토리
                              </h2>
                              <p className="mt-0.5 text-xs text-[#89938c]">
                                업무별 최신 수신 내용과 마지막 처리 결과입니다.
                              </p>
                            </div>
                            <Button
                              onClick={() => openScopedWork()}
                              variant="ghost"
                              className="text-[#39795b]"
                            >
                              전체 보기
                            </Button>
                          </div>
                          <div className="grid gap-3 p-4 xl:grid-cols-2">
                            {recentHistoryEntries.map((entry) => {
                              const workItem = workItemById.get(
                                entry.workItemId,
                              );
                              const farm = workItem
                                ? farmById.get(workItem.farmId)
                                : null;
                              if (!workItem) return null;
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() =>
                                    openFarm(workItem.farmId, workItem.id)
                                  }
                                  className="rounded-2xl border border-[#dfe6dd] bg-white p-4 text-left hover:border-[#bdd8c5]"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">
                                        {
                                          FARM_WORK_TYPE_LABELS[
                                            workItem.workType
                                          ]
                                        }
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={workStatusClass(
                                          workItem.status,
                                        )}
                                      >
                                        {
                                          FARM_WORK_STATUS_LABELS[
                                            workItem.status
                                          ]
                                        }
                                      </Badge>
                                    </div>
                                    <time className="text-[11px] text-[#929b94]">
                                      {formatTimestamp(entry.occurredAt, true)}
                                    </time>
                                  </div>
                                  <h3 className="mt-3 font-semibold">
                                    {workItem.title}
                                  </h3>
                                  <p className="mt-1 truncate text-xs text-[#7b877f]">
                                    {farm?.name ?? '농가 없음'} ·{' '}
                                    {projectForWorkItem(workItem)?.name ??
                                      '사업 없음'}
                                  </p>
                                  {entry.receivedContent && (
                                    <p className="mt-3 line-clamp-2 rounded-xl bg-[#f6f8f6] p-3 text-xs leading-5">
                                      <strong className="text-[#78847c]">
                                        받은 내용 ·{' '}
                                      </strong>
                                      {entry.receivedContent}
                                    </p>
                                  )}
                                  {entry.actionContent && (
                                    <p className="mt-2 line-clamp-2 rounded-xl bg-[#eef6f0] p-3 text-xs leading-5 text-[#476752]">
                                      <strong>처리 내용 · </strong>
                                      {entry.actionContent}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                            {!recentHistoryEntries.length && (
                              <p className="col-span-full py-14 text-center text-sm text-[#89938c]">
                                농가 상세에서 첫 업무를 등록해 주세요.
                              </p>
                            )}
                          </div>
                        </section>
                        <aside className="rounded-2xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <CircleAlert className="size-5 text-[#bd6b3d]" />
                            <h2 className="font-bold">확인 필요</h2>
                          </div>
                          <div className="mt-4 space-y-3">
                            <button
                              type="button"
                              onClick={() => openScopedWork('overdue')}
                              className="w-full rounded-xl bg-[#fff6ef] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#a75b35]">
                                마감 지연 업무
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                {yearProjectKpis.overdueTasks}건
                              </p>
                              <p className="mt-1 text-xs text-[#8b7a70]">
                                지연 업무부터 확인하고 처리 기록을 이어갑니다.
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!changeView('subscriptions')) return;
                                setSubscriptionMode('management');
                                setSubscriptionListProjectType(
                                  projectTypeFilter,
                                );
                                setSubscriptionListProjectId('all');
                                setSubscriptionListStatus('all');
                                setSubscriptionListSearch('');
                                setSubscriptionListPage(1);
                                setSubscriptionFocus({
                                  recordIds: overviewRecords
                                    .filter(
                                      (record) =>
                                        effectiveRecordSubscriptionStatus(
                                          record,
                                          subscriptionToday,
                                        ) !== 'active',
                                    )
                                    .map((record) => record.id),
                                  label: `${projectYearFilter === 'all' ? '전체 연도' : `${projectYearFilter}년`} · 만료·미등록 구독`,
                                });
                              }}
                              className="w-full rounded-xl bg-[#f4f8f1] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#5e7b43]">
                                구독 만료·미등록
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                {overviewInactiveSubscriptions}개소 구독 확인
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!changeView('quality')) return;
                                setQualityFocus({
                                  issueIds: qualityIssues
                                    .filter((issue) =>
                                      issue.projectId
                                        ? overviewProjectIds.has(
                                            issue.projectId,
                                          )
                                        : overviewFarmIds.has(issue.farmId),
                                    )
                                    .map((issue) => issue.id),
                                  label: `${projectYearFilter === 'all' ? '전체 연도' : `${projectYearFilter}년`} · ${projectTypeFilter === 'all' ? '전체 사업 타입' : FARM_PROJECT_TYPE_LABELS[projectTypeFilter]}`,
                                });
                              }}
                              className="w-full rounded-xl bg-[#f2f6f3] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#547160]">
                                데이터 점검
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                참여 농가 확인 필요 {overviewQualityCount}건
                              </p>
                              <p className="mt-1 text-xs text-[#7b877f]">
                                시운전·교육 후속 확인 {installFollowups}개소
                              </p>
                            </button>
                          </div>
                        </aside>
                      </div>
                    </>
                  )}

                  {view === 'work' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div>
                          <p className="text-sm font-medium text-[#647568]">
                            수신부터 처리 완료까지
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            업무 현황
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            받은 내용을 업무로 연결하고, 담당자·다음 행동·처리
                            결과를 확인하세요.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => setTaskRegistrationOpen(true)}
                            disabled={!organization.personal}
                          >
                            업무 등록
                          </Button>
                          <Button
                            onClick={() => openInboxDialog()}
                            className="bg-[#2f7b59] hover:bg-[#286b4d]"
                          >
                            <Inbox />
                            빠른 수신
                          </Button>
                        </div>
                      </div>
                      {organization.error && (
                        <p role="alert" className="mb-3 text-sm text-red-700">
                          {organization.error}
                        </p>
                      )}
                      <DeletedWorkList
                        tasks={workspace.workItems}
                        member={member}
                        contextLabel={workContextLabel}
                        onRestore={setWorkDeletionTarget}
                      />
                      {!organization.personal && (
                        <p className="mb-4 text-sm text-slate-600">
                          내부 업무와 계정 배정은 부서가 승인된 개인 계정으로
                          로그인한 뒤 사용할 수 있습니다. 기존 수신·업무 처리는
                          그대로 이용할 수 있습니다.
                        </p>
                      )}
                      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-2">
                        {(
                          [
                            [
                              'inbox',
                              '수신함',
                              Inbox,
                              unprocessedInboxItems.length,
                            ],
                            [
                              'control',
                              '서비스 관제',
                              BarChart3,
                              controlRiskCount,
                            ],
                            ['board', '업무 보드', LayoutDashboard, null],
                            ['list', '목록', List, null],
                            [
                              'review',
                              '주간 검토',
                              CheckCircle2,
                              weeklyReviewItems.length,
                            ],
                          ] as const
                        ).map(([mode, label, Icon, count]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setWorkMode(mode);
                              if (mode !== 'list' && mode !== 'board')
                                setWorkScope(null);
                              if (mode === 'board') setWorkStatusFilter('all');
                            }}
                            aria-pressed={workMode === mode}
                            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
                              workMode === mode
                                ? 'bg-[#e9f5ec] text-[#286b4d]'
                                : 'text-[#728078] hover:bg-[#f4f7f3]'
                            }`}
                          >
                            <Icon className="size-4" />
                            {label}
                            {count !== null && count > 0 && (
                              <span className="rounded-full bg-[#2f7b59] px-2 py-0.5 text-[10px] text-white">
                                {count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {workScope && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#bfd9cc] bg-[#eaf5ef] px-4 py-3">
                          <p className="text-sm">
                            <strong>{workScope.label}</strong> ·{' '}
                            {workScope.status === 'overdue'
                              ? '마감 지연 업무'
                              : workScope.status === 'open'
                                ? '미완료 업무'
                                : '모든 하위 업무'}{' '}
                            · 목록 {filteredWorkItems.length}건
                          </p>
                          <Button
                            variant="ghost"
                            onClick={() => setWorkScope(null)}
                          >
                            범위 해제
                          </Button>
                        </div>
                      )}
                      {(workMode === 'board' || workMode === 'list') && (
                        <>
                          <div className="mb-4 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
                            <div className="min-w-44">
                              <label
                                htmlFor="work-source"
                                className="mb-1 block text-sm font-medium"
                              >
                                업무 구분
                              </label>
                              <Select
                                value={workSourceFilter}
                                onValueChange={(value) => {
                                  setWorkSourceFilter(
                                    value as 'all' | 'internal' | 'project',
                                  );
                                  setWorkScope(null);
                                }}
                              >
                                <SelectTrigger id="work-source">
                                  <SelectValue>
                                    {
                                      {
                                        all: '전체 업무',
                                        internal: '내부 업무',
                                        project: '프로젝트·농가 업무',
                                      }[workSourceFilter]
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체 업무</SelectItem>
                                  <SelectItem value="internal">
                                    내부 업무
                                  </SelectItem>
                                  <SelectItem value="project">
                                    프로젝트·농가 업무
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="min-w-44">
                              <label
                                htmlFor="work-account"
                                className="mb-1 block text-sm font-medium"
                              >
                                담당 범위
                              </label>
                              <Select
                                value={workAccountFilter}
                                onValueChange={(value) =>
                                  setWorkAccountFilter(
                                    value as typeof workAccountFilter,
                                  )
                                }
                                disabled={!organization.personal}
                              >
                                <SelectTrigger id="work-account">
                                  <SelectValue>
                                    {
                                      {
                                        all: '전체 담당자',
                                        mine: '내 업무',
                                        department: '우리 부서',
                                        head: '내 부서장 지시',
                                      }[workAccountFilter]
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">
                                    전체 담당자
                                  </SelectItem>
                                  <SelectItem value="mine">내 업무</SelectItem>
                                  <SelectItem value="department">
                                    우리 부서
                                  </SelectItem>
                                  <SelectItem value="head">
                                    내 부서장 지시
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {organization.personal && (
                              <Button
                                className="self-end border-red-200 text-red-800"
                                variant="outline"
                                onClick={() => {
                                  setWorkAccountFilter('head');
                                  setWorkSourceFilter('all');
                                  setWorkScope(null);
                                  setWorkSearch('');
                                  setWorkTypeFilter('all');
                                  setWorkStatusFilter('all');
                                }}
                              >
                                내 최우선{' '}
                                {
                                  operationalWorkItems.filter(
                                    (item) =>
                                      isHeadPriority(item) &&
                                      item.assigneeUid === member?.id,
                                  ).length
                                }
                                건
                              </Button>
                            )}
                          </div>
                          <div
                            className={
                              workScope
                                ? 'hidden'
                                : 'mb-4 grid gap-3 sm:grid-cols-3'
                            }
                          >
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">
                                  미완료 업무
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {openWorkItems}건
                                </p>
                                <p className="mt-1 text-[11px] text-[#89938c]">
                                  접수·처리 중·대기·막힘
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#efcfc3]">
                              <CardContent>
                                <p className="text-xs text-[#9b654d]">
                                  마감 지연
                                </p>
                                <p className="mt-1 text-2xl font-bold text-[#aa4e30]">
                                  {overdueWorkItems.length}건
                                </p>
                                <p className="mt-1 text-[11px] text-[#9d8174]">
                                  완료되지 않은 지난 기한 업무
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#eadfca]">
                              <CardContent>
                                <p className="text-xs text-[#8b7047]">
                                  7일 이내 마감
                                </p>
                                <p className="mt-1 text-2xl font-bold text-[#94601c]">
                                  {dueSoonWorkItems.length}건
                                </p>
                                <p className="mt-1 text-[11px] text-[#978773]">
                                  오늘 포함 예정 업무
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                          <div
                            className={`mb-4 grid gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-4 ${
                              workMode === 'list'
                                ? 'sm:grid-cols-[1fr_170px_150px]'
                                : 'sm:grid-cols-[1fr_170px]'
                            }`}
                          >
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                              <Input
                                value={workSearch}
                                onChange={(event) =>
                                  setWorkSearch(event.target.value)
                                }
                                placeholder="업무, 농가, 사업, 받은·처리 내용 검색"
                                className="h-10 pl-9"
                              />
                            </div>
                            <Select
                              value={workTypeFilter}
                              onValueChange={(value) =>
                                setWorkTypeFilter(
                                  value as typeof workTypeFilter,
                                )
                              }
                            >
                              <SelectTrigger className="h-10 w-full">
                                <SelectValue>
                                  {workTypeFilter === 'all'
                                    ? '모든 업무 유형'
                                    : FARM_WORK_TYPE_LABELS[workTypeFilter]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  모든 업무 유형
                                </SelectItem>
                                {Object.entries(FARM_WORK_TYPE_LABELS)
                                  .filter(
                                    ([type]) =>
                                      type !== 'payment' &&
                                      type !== 'subscription',
                                  )
                                  .map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {workMode === 'list' && (
                              <Select
                                value={workStatusFilter}
                                onValueChange={(value) =>
                                  setWorkStatusFilter(
                                    value as typeof workStatusFilter,
                                  )
                                }
                              >
                                <SelectTrigger className="h-10 w-full">
                                  <SelectValue>
                                    {workStatusFilter === 'all'
                                      ? '모든 상태'
                                      : FARM_WORK_STATUS_LABELS[
                                          workStatusFilter
                                        ]}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">모든 상태</SelectItem>
                                  {Object.entries(FARM_WORK_STATUS_LABELS).map(
                                    ([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </>
                      )}
                      {workMode === 'inbox' && (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-[#dce6dd] bg-[#f8fbf7] p-4">
                            <p className="text-sm font-bold text-[#355b43]">
                              먼저 모으고, 나중에 분류합니다
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#718078]">
                              메일·카톡·전화·구두 내용을 빠르게 담은 뒤 농가와
                              사업을 확인해 업무로 전환하세요.
                            </p>
                          </div>
                          {unprocessedInboxItems.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-2xl border border-[#dfe6dd] bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      <ChannelIcon
                                        channel={item.channel}
                                        className="size-3"
                                      />
                                      {
                                        FARM_HISTORY_CHANNEL_LABELS[
                                          item.channel
                                        ]
                                      }
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="border-[#e7d6b9] bg-[#fff9ed] text-[#8a641f]"
                                    >
                                      {FARM_INBOX_STATUS_LABELS[item.status]}
                                    </Badge>
                                    <time className="text-[11px] text-[#8b958e]">
                                      {formatTimestamp(item.receivedAt)}
                                    </time>
                                  </div>
                                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                    {item.content}
                                  </p>
                                  <ReceivedImages imageIds={item.imageIds} />
                                  <p className="mt-2 text-xs text-[#7b877f]">
                                    {item.sender
                                      ? `전달 ${item.sender} · `
                                      : ''}
                                    기록 {item.capturedBy}
                                  </p>
                                  {item.referenceUrl && (
                                    <a
                                      href={item.referenceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#39795b] hover:underline"
                                    >
                                      <ExternalLink className="size-3" />
                                      참고 링크
                                    </a>
                                  )}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => openInboxRoute(item)}
                                    className="bg-[#2f7b59] hover:bg-[#286b4d]"
                                  >
                                    <ArrowRight />
                                    업무로 정리
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={submitting}
                                    onClick={() =>
                                      void changeInboxStatus(item, 'reference')
                                    }
                                  >
                                    <Archive />
                                    참고 보관
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={submitting}
                                    onClick={() =>
                                      void changeInboxStatus(item, 'discarded')
                                    }
                                  >
                                    처리 제외
                                  </Button>
                                </div>
                              </div>
                            </article>
                          ))}
                          {!unprocessedInboxItems.length && (
                            <div className="rounded-2xl border border-dashed border-[#d7dfd5] bg-white py-14 text-center">
                              <CheckCircle2 className="mx-auto size-8 text-[#6eaf84]" />
                              <p className="mt-3 font-semibold">
                                정리할 수신 내용이 없습니다.
                              </p>
                              <p className="mt-1 text-xs text-[#89938c]">
                                새 소식이 오면 ‘빠른 수신’으로 먼저 담아두세요.
                              </p>
                            </div>
                          )}
                          {referenceInboxItems.length > 0 && (
                            <details className="rounded-2xl border border-[#dfe6dd] bg-white p-4">
                              <summary className="cursor-pointer text-sm font-bold text-[#506357]">
                                참고 보관 {referenceInboxItems.length}건
                              </summary>
                              <div className="mt-4 space-y-2">
                                {referenceInboxItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-xl bg-[#f6f8f5] p-3"
                                  >
                                    <p className="whitespace-pre-wrap text-sm leading-6">
                                      {item.content}
                                    </p>
                                    <ReceivedImages imageIds={item.imageIds} />
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#7f8b83]">
                                      <span>
                                        {formatTimestamp(item.receivedAt)}
                                      </span>
                                      <span>{item.sender}</span>
                                      {item.referenceUrl && (
                                        <a
                                          href={item.referenceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-semibold text-[#39795b] hover:underline"
                                        >
                                          참고 링크 열기
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {convertedInboxItems.length > 0 && (
                            <details className="rounded-2xl border border-[#dfe6dd] bg-white p-4">
                              <summary className="cursor-pointer text-sm font-bold text-[#506357]">
                                업무 전환 완료 {convertedInboxItems.length}건
                              </summary>
                              <div className="mt-4 space-y-2">
                                {convertedInboxItems.map((item) => {
                                  const workItem = workItemById.get(
                                    item.convertedWorkItemId,
                                  );
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      disabled={!workItem}
                                      onClick={() =>
                                        workItem &&
                                        openFarm(workItem.farmId, workItem.id)
                                      }
                                      className="w-full rounded-xl bg-[#f6f8f5] p-3 text-left disabled:cursor-default"
                                    >
                                      <p className="line-clamp-2 text-sm">
                                        {item.content}
                                      </p>
                                      <p className="mt-1 text-[11px] font-semibold text-[#39795b]">
                                        {workItem
                                          ? `연결 업무 · ${workItem.title}`
                                          : '연결 업무 확인 필요'}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                          {workspace.inboxItems.some(
                            (item) => item.status === 'discarded',
                          ) && (
                            <p className="px-2 text-[11px] text-[#929b94]">
                              처리 제외{' '}
                              {
                                workspace.inboxItems.filter(
                                  (item) => item.status === 'discarded',
                                ).length
                              }
                              건은 통계에만 보관됩니다.
                            </p>
                          )}
                        </div>
                      )}

                      {workMode === 'control' && (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                              {
                                label: '응답 목표 초과',
                                value: breachedResponseWorkItems.length,
                                note: '최초 확인이 늦어진 업무',
                                tone: 'border-[#efc9bd] bg-[#fff4ef] text-[#a64f32]',
                              },
                              {
                                label: '72시간 이내 대응',
                                value: urgentResponseWorkItems.length,
                                note: '지금 순서를 정할 업무',
                                tone: 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]',
                              },
                              {
                                label: '막힘·대기',
                                value: blockedWorkItems.length,
                                note: '해제 주체와 다음 조치 확인',
                                tone: 'border-[#e7d4c7] bg-[#fff8f3] text-[#8c5c3f]',
                              },
                              {
                                label: '오늘 현장 방문',
                                value: todayVisits.length,
                                note: '기사와 방문 일정을 확인',
                                tone: 'border-[#cfe1d3] bg-[#f1f8f2] text-[#397154]',
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className={`rounded-2xl border p-4 ${item.tone}`}
                              >
                                <p className="text-xs font-semibold">
                                  {item.label}
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {item.value}건
                                </p>
                                <p className="mt-1 text-[11px] opacity-70">
                                  {item.note}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                            <div className="space-y-4">
                              <section className="rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                  <div>
                                    <h2 className="font-bold">
                                      서비스 목표 큐
                                    </h2>
                                    <p className="mt-1 text-xs text-[#7b877f]">
                                      최초 대응 목표가 가까운 순서입니다.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                      대기 {pendingResponseWorkItems.length}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="border-[#e5d7bb] bg-[#fff9ed] text-[#8d6727]"
                                    >
                                      목표 미설정{' '}
                                      {untargetedResponseWorkItems.length}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {pendingResponseWorkItems
                                    .slice(0, 8)
                                    .map((item) => (
                                      <WorkItemCard
                                        key={item.id}
                                        workItem={item}
                                        compact
                                      />
                                    ))}
                                  {!pendingResponseWorkItems.length && (
                                    <div className="rounded-xl bg-[#f4f8f2] p-5 text-center text-sm text-[#718078]">
                                      최초 대응을 기다리는 업무가 없습니다.
                                    </div>
                                  )}
                                  {untargetedResponseWorkItems.length > 0 && (
                                    <div className="mt-4 rounded-xl border border-dashed border-[#e2d4b7] bg-[#fffdf7] p-3">
                                      <p className="mb-2 text-xs font-bold text-[#806224]">
                                        기존 수신 업무의 대응 목표를 정해 주세요
                                      </p>
                                      <div className="space-y-2">
                                        {untargetedResponseWorkItems
                                          .slice(0, 5)
                                          .map((item) => (
                                            <WorkItemCard
                                              key={item.id}
                                              workItem={item}
                                              compact
                                            />
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </section>

                              <section className="rounded-2xl border border-[#ead5ca] bg-white p-4 sm:p-5">
                                <div className="mb-4">
                                  <h2 className="font-bold text-[#754d3d]">
                                    막힘 해제 큐
                                  </h2>
                                  <p className="mt-1 text-xs text-[#8a746a]">
                                    오래 막힌 업무부터 원인·해제 주체·다음
                                    행동을 확인합니다.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  {blockedWorkItems.slice(0, 8).map((item) => (
                                    <WorkItemCard
                                      key={item.id}
                                      workItem={item}
                                      compact
                                    />
                                  ))}
                                  {!blockedWorkItems.length && (
                                    <div className="rounded-xl bg-[#f8f6f4] p-5 text-center text-sm text-[#80766f]">
                                      현재 막힌 업무가 없습니다.
                                    </div>
                                  )}
                                </div>
                              </section>
                            </div>

                            <div className="space-y-4">
                              <section className="rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                  <div>
                                    <h2 className="font-bold">
                                      현장 방문 일정
                                    </h2>
                                    <p className="mt-1 text-xs text-[#7b877f]">
                                      지난 미완료 방문과 앞으로 7일 일정입니다.
                                    </p>
                                  </div>
                                  <MapPin className="size-5 text-[#4d805e]" />
                                </div>
                                <div className="space-y-2">
                                  {visitQueue.slice(0, 10).map((visit) => {
                                    const workItem = workItemById.get(
                                      visit.workItemId,
                                    );
                                    const farm = workItem
                                      ? farmById.get(workItem.farmId)
                                      : null;
                                    const delayed =
                                      visit.scheduledAt < startOfToday;
                                    return (
                                      <button
                                        key={visit.id}
                                        type="button"
                                        disabled={!workItem}
                                        onClick={() =>
                                          workItem &&
                                          openFarm(workItem.farmId, workItem.id)
                                        }
                                        className="w-full rounded-xl border border-[#e1e7df] bg-[#f8faf7] p-3 text-left hover:border-[#bad2c0] disabled:cursor-default"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">
                                              {workItem?.title ??
                                                '연결 업무 확인 필요'}
                                            </p>
                                            <p className="mt-1 text-xs text-[#718078]">
                                              {farm?.name ?? '프로젝트 공통'} ·{' '}
                                              {visit.assignedTo}
                                            </p>
                                          </div>
                                          {delayed && (
                                            <Badge
                                              variant="outline"
                                              className="border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]"
                                            >
                                              방문 지연
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#3d7152]">
                                          <CalendarClock className="size-3.5" />
                                          {formatTimestamp(visit.scheduledAt)}
                                        </p>
                                      </button>
                                    );
                                  })}
                                  {!visitQueue.length && (
                                    <p className="rounded-xl bg-[#f4f8f2] p-4 text-center text-sm text-[#718078]">
                                      7일 이내 현장 방문이 없습니다.
                                    </p>
                                  )}
                                </div>
                              </section>

                              <section className="rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:p-5">
                                <div className="mb-4">
                                  <h2 className="font-bold">
                                    담당자 업무 신호
                                  </h2>
                                  <p className="mt-1 text-xs text-[#7b877f]">
                                    단순 건수와 위험 신호입니다. 실제
                                    소요시간·가용량은 별도 확인이 필요합니다.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  {ownerLoadSummaries
                                    .slice(0, 10)
                                    .map((item) => (
                                      <div
                                        key={item.owner}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f8f5] px-3 py-2.5"
                                      >
                                        <div>
                                          <p className="text-sm font-semibold">
                                            {item.owner}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-[#7b877f]">
                                            높음 {item.high} · 지연{' '}
                                            {item.overdue} · 막힘 {item.blocked}
                                          </p>
                                        </div>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#356d50] shadow-sm">
                                          {item.active}건
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </section>

                              <section className="rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:p-5">
                                <div className="mb-4">
                                  <h2 className="font-bold">
                                    사업 자동 위험 신호
                                  </h2>
                                  <p className="mt-1 text-xs text-[#7b877f]">
                                    응답 초과·마감 지연·장기 막힘만으로 자동
                                    판단하며, 책임자의 공식 상태 보고를 대신하지
                                    않습니다.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  {projectHealthSummaries.map((item) => {
                                    const health = {
                                      on_track: {
                                        label: '정상',
                                        className:
                                          'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]',
                                      },
                                      at_risk: {
                                        label: '주의',
                                        className:
                                          'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]',
                                      },
                                      off_track: {
                                        label: '위험',
                                        className:
                                          'border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]',
                                      },
                                    }[item.health];
                                    return (
                                      <div
                                        key={item.project.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e7df] p-3"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold">
                                            {item.project.name}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-[#7b877f]">
                                            미완료 업무 {item.items.length}건
                                          </p>
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className={health.className}
                                        >
                                          {health.label}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            </div>
                          </div>
                        </div>
                      )}

                      {workMode === 'board' && (
                        <WorkTaskSurface
                          deleteAction={workDeleteAction}
                          onEditingChange={setWorkQuickEditOpen}
                          farmLabel={(item) =>
                            farmById.get(item.farmId)?.name || ''
                          }
                          latestSummary={(item) => ({
                            action:
                              latestEntryWith(item, 'actionContent')
                                ?.actionContent || '',
                            received:
                              latestEntryWith(item, 'receivedContent')
                                ?.receivedContent || '',
                          })}
                          key="board"
                          mode="board"
                          searching={Boolean(
                            workSearch.trim() ||
                            workTypeFilter !== 'all' ||
                            workScope,
                          )}
                          items={filteredWorkItems}
                          allItems={operationalWorkItems}
                          recorder={accountName || accountEmail}
                          projectLabel={workContextLabel}
                          onOpen={(item) => openFarm(item.farmId, item.id)}
                          onAddChild={addChildTask}
                          onSave={saveQuickWork}
                          isClosed={(item) =>
                            projectForWorkItem(item)?.status === 'completed'
                          }
                        />
                      )}

                      {workMode === 'review' && (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                              [
                                '다음 행동 누락',
                                missingNextActionWorkItems.length,
                                '무엇을 할지 명확히 정합니다.',
                              ],
                              [
                                '마감 지연',
                                overdueWorkItems.length,
                                '약속한 기한을 다시 잡습니다.',
                              ],
                              [
                                '검토일 도래·지남',
                                reviewDueWorkItems.length,
                                '다시 보기로 한 업무를 확인합니다.',
                              ],
                              [
                                '7일 넘은 대기',
                                staleWaitingWorkItems.length,
                                '해제 조건을 확인하거나 종료합니다.',
                              ],
                            ].map(([label, count, description]) => (
                              <Card
                                key={String(label)}
                                className="border-0 bg-white ring-[#dfe6dd]"
                              >
                                <CardContent>
                                  <p className="text-xs text-[#748078]">
                                    {label}
                                  </p>
                                  <p className="mt-1 text-2xl font-bold">
                                    {count}건
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#8b958e]">
                                    {description}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          <div className="rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h2 className="font-bold">
                                  이번 주에 다시 볼 업무
                                </h2>
                                <p className="mt-1 text-xs text-[#7b877f]">
                                  카드를 열어 진행 기록과 다음 행동을 함께
                                  갱신하세요.
                                </p>
                              </div>
                              <Badge variant="outline">
                                최근 완료 {recentCompletedWorkItems.length}건
                              </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                              {weeklyReviewItems.map((item) => (
                                <WorkItemCard
                                  key={item.id}
                                  workItem={item}
                                  compact
                                />
                              ))}
                            </div>
                            {!weeklyReviewItems.length && (
                              <div className="mt-4 rounded-xl bg-[#eef8f1] py-10 text-center text-sm text-[#39795b]">
                                검토가 필요한 업무가 없습니다. 이번 주 정리가
                                끝났습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {workMode === 'list' && (
                        <WorkTaskSurface
                          deleteAction={workDeleteAction}
                          onEditingChange={setWorkQuickEditOpen}
                          farmLabel={(item) =>
                            farmById.get(item.farmId)?.name || ''
                          }
                          latestSummary={(item) => ({
                            action:
                              latestEntryWith(item, 'actionContent')
                                ?.actionContent || '',
                            received:
                              latestEntryWith(item, 'receivedContent')
                                ?.receivedContent || '',
                          })}
                          mode="list"
                          items={filteredWorkItems}
                          allItems={operationalWorkItems}
                          recorder={accountName || accountEmail}
                          projectLabel={workContextLabel}
                          onOpen={(item) => openFarm(item.farmId, item.id)}
                          onAddChild={addChildTask}
                          onSave={saveQuickWork}
                          isClosed={(item) =>
                            projectForWorkItem(item)?.status === 'completed'
                          }
                        />
                      )}
                    </section>
                  )}

                  {view === 'farms' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div>
                          <p className="text-sm font-medium text-[#647568]">
                            농가 중심 조회
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            농가 관리대장
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            농가의 사업 참여, 업무별 마지막 처리 내용과 전체
                            진행 과정을 연결해서 봅니다.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={exportFarmLedgerCsv}
                            variant="outline"
                          >
                            <Download />
                            CSV 내보내기
                          </Button>
                          <Button
                            onClick={openFarmDialog}
                            disabled={!activeProjects.length}
                            className="bg-[#2f7b59] hover:bg-[#286b4d]"
                          >
                            <Plus />
                            농가 등록
                          </Button>
                        </div>
                      </div>
                      <div className="mb-4 grid gap-3 sm:grid-cols-3">
                        <button
                          type="button"
                          aria-pressed={subscriptionFilter === 'all'}
                          onClick={() => setSubscriptionFilter('all')}
                          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            subscriptionFilter === 'all'
                              ? 'border-[#76b48c] ring-2 ring-[#d8ecdf]'
                              : 'border-[#dfe6dd]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#627269]">
                              전체 농가
                            </p>
                            <span className="grid size-9 place-items-center rounded-xl bg-[#edf5ee] text-[#39795b]">
                              <Warehouse className="size-[18px]" />
                            </span>
                          </div>
                          <p className="mt-3">
                            <strong className="text-3xl font-bold">
                              {farmLedgerSummary.total}
                            </strong>
                            <span className="ml-1 text-sm text-[#758078]">
                              곳
                            </span>
                          </p>
                          <p className="mt-2 text-xs text-[#89938c]">
                            전체 관리대장 등록 기준
                          </p>
                        </button>
                        <button
                          type="button"
                          aria-pressed={subscriptionFilter === 'active'}
                          onClick={() => setSubscriptionFilter('active')}
                          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            subscriptionFilter === 'active'
                              ? 'border-[#76b48c] ring-2 ring-[#d8ecdf]'
                              : 'border-[#dfe6dd]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#39745a]">
                              구독 농가
                            </p>
                            <span className="grid size-9 place-items-center rounded-xl bg-[#e8f6ed] text-[#2f7b59]">
                              <CheckCircle2 className="size-[18px]" />
                            </span>
                          </div>
                          <p className="mt-3">
                            <strong className="text-3xl font-bold text-[#246847]">
                              {farmLedgerSummary.subscribed}
                            </strong>
                            <span className="ml-1 text-sm text-[#758078]">
                              곳
                            </span>
                          </p>
                          <p className="mt-2 text-xs text-[#748178]">
                            전체 대비 {farmLedgerSummary.subscriptionRate}%
                          </p>
                        </button>
                        <button
                          type="button"
                          aria-pressed={subscriptionFilter === 'unsubscribed'}
                          onClick={() => setSubscriptionFilter('unsubscribed')}
                          className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            subscriptionFilter === 'unsubscribed'
                              ? 'border-[#d9a46e] ring-2 ring-[#f3e5d5]'
                              : 'border-[#dfe6dd]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#8c643c]">
                              미구독 농가
                            </p>
                            <span className="grid size-9 place-items-center rounded-xl bg-[#fff4e8] text-[#a56b35]">
                              <CircleAlert className="size-[18px]" />
                            </span>
                          </div>
                          <p className="mt-3">
                            <strong className="text-3xl font-bold text-[#8f5f31]">
                              {farmLedgerSummary.unsubscribed}
                            </strong>
                            <span className="ml-1 text-sm text-[#758078]">
                              곳
                            </span>
                          </p>
                          <p className="mt-2 text-xs text-[#8b7764]">
                            만료 {farmLedgerSummary.expired} · 미등록{' '}
                            {farmLedgerSummary.unregistered}
                          </p>
                        </button>
                      </div>

                      <Collapsible className="mb-4 rounded-xl border border-[#d8e0e7] bg-white px-4">
                        <CollapsibleTrigger className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 text-left text-sm font-semibold">
                          작목별·지역별 농가 현황{' '}
                          <span className="flex items-center gap-2 font-normal text-[#586777]">
                            {farmLedgerSummary.crops.length}개 작목 ·{' '}
                            {farmLedgerSummary.regions.length}개 지역
                            <ChevronDown className="size-4" />
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mb-5 grid gap-4 xl:grid-cols-2">
                            <article className="rounded-2xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Leaf className="size-[18px] text-[#39795b]" />
                                    <h2 className="font-bold">작목별 농가</h2>
                                  </div>
                                  <p className="mt-1 text-xs text-[#89938c]">
                                    복수 작목 농가는 각 작목에 포함됩니다.
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {farmLedgerSummary.crops.length}개 작목
                                </Badge>
                              </div>
                              <div className="mt-4 max-h-[280px] space-y-1 overflow-y-auto pr-1">
                                {farmLedgerSummary.crops.map((item) => {
                                  const percent = farmLedgerSummary.total
                                    ? Math.round(
                                        (item.count / farmLedgerSummary.total) *
                                          100,
                                      )
                                    : 0;
                                  return (
                                    <button
                                      key={item.label}
                                      type="button"
                                      aria-label={`${item.label} 농가 ${item.count}곳 목록 보기`}
                                      aria-pressed={
                                        farmCropFilter === item.label
                                      }
                                      onClick={() =>
                                        setFarmCropFilter((current) =>
                                          current === item.label
                                            ? 'all'
                                            : item.label,
                                        )
                                      }
                                      className={`block w-full rounded-xl px-3 py-2.5 text-left transition ${
                                        farmCropFilter === item.label
                                          ? 'bg-[#edf7f0] ring-1 ring-[#b9d8c3]'
                                          : 'hover:bg-[#f6f8f5]'
                                      }`}
                                    >
                                      <span className="flex items-center justify-between gap-3 text-sm">
                                        <span className="truncate font-medium">
                                          {item.label}
                                        </span>
                                        <span className="shrink-0 text-xs text-[#6f7c74]">
                                          {item.count}곳 · {percent}%
                                        </span>
                                      </span>
                                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#edf0ec]">
                                        <span
                                          className="block h-full rounded-full bg-[#5b9d73]"
                                          style={{ width: `${percent}%` }}
                                        />
                                      </span>
                                    </button>
                                  );
                                })}
                                {!farmLedgerSummary.crops.length && (
                                  <p className="py-8 text-center text-sm text-[#89938c]">
                                    등록된 농가가 없습니다.
                                  </p>
                                )}
                              </div>
                            </article>

                            <article className="rounded-2xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="size-[18px] text-[#39795b]" />
                                    <h2 className="font-bold">지역별 농가</h2>
                                  </div>
                                  <p className="mt-1 text-xs text-[#89938c]">
                                    농가 관리대장에 등록된 지역 기준입니다.
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {farmLedgerSummary.regions.length}개 지역
                                </Badge>
                              </div>
                              <div className="mt-4 max-h-[280px] space-y-1 overflow-y-auto pr-1">
                                {farmLedgerSummary.regions.map((item) => {
                                  const percent = farmLedgerSummary.total
                                    ? Math.round(
                                        (item.count / farmLedgerSummary.total) *
                                          100,
                                      )
                                    : 0;
                                  return (
                                    <button
                                      key={item.label}
                                      type="button"
                                      aria-label={`${item.label} 지역 농가 ${item.count}곳 목록 보기`}
                                      aria-pressed={
                                        farmRegionFilter === item.label
                                      }
                                      onClick={() =>
                                        setFarmRegionFilter((current) =>
                                          current === item.label
                                            ? 'all'
                                            : item.label,
                                        )
                                      }
                                      className={`block w-full rounded-xl px-3 py-2.5 text-left transition ${
                                        farmRegionFilter === item.label
                                          ? 'bg-[#edf7f0] ring-1 ring-[#b9d8c3]'
                                          : 'hover:bg-[#f6f8f5]'
                                      }`}
                                    >
                                      <span className="flex items-center justify-between gap-3 text-sm">
                                        <span className="truncate font-medium">
                                          {item.label}
                                        </span>
                                        <span className="shrink-0 text-xs text-[#6f7c74]">
                                          {item.count}곳 · {percent}%
                                        </span>
                                      </span>
                                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#edf0ec]">
                                        <span
                                          className="block h-full rounded-full bg-[#7aa083]"
                                          style={{ width: `${percent}%` }}
                                        />
                                      </span>
                                    </button>
                                  );
                                })}
                                {!farmLedgerSummary.regions.length && (
                                  <p className="py-8 text-center text-sm text-[#89938c]">
                                    등록된 농가가 없습니다.
                                  </p>
                                )}
                              </div>
                            </article>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      <div className="mb-3 grid gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_150px_160px_160px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                          <Input
                            value={search}
                            aria-label="농가 관리대장 검색"
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="농가, 사업, 업무, 받은·처리 내용 검색"
                            className="h-10 pl-9"
                          />
                        </div>
                        <Select
                          value={projectFilter}
                          onValueChange={(value) =>
                            setProjectFilter(value ?? 'all')
                          }
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue>
                              {projectFilter === 'all'
                                ? '모든 사업'
                                : projectSelectLabel(projectFilter)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 사업</SelectItem>
                            {workspace.projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={subscriptionFilter}
                          onValueChange={(value) =>
                            setSubscriptionFilter(
                              value as typeof subscriptionFilter,
                            )
                          }
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue>
                              {SUBSCRIPTION_FILTER_LABELS[subscriptionFilter]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 구독</SelectItem>
                            <SelectItem value="active">구독 중</SelectItem>
                            <SelectItem value="unsubscribed">
                              미구독 전체
                            </SelectItem>
                            <SelectItem value="expired">만료</SelectItem>
                            <SelectItem value="unregistered">미등록</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={farmCropFilter}
                          onValueChange={(value) =>
                            setFarmCropFilter(value ?? 'all')
                          }
                        >
                          <SelectTrigger
                            className="h-10 w-full"
                            aria-label="농가 작목 필터"
                          >
                            <SelectValue>
                              {farmCropFilter === 'all'
                                ? '모든 작목'
                                : farmCropFilter}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 작목</SelectItem>
                            {farmLedgerSummary.crops.map((item) => (
                              <SelectItem key={item.label} value={item.label}>
                                {item.label} · {item.count}곳
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={farmRegionFilter}
                          onValueChange={(value) =>
                            setFarmRegionFilter(value ?? 'all')
                          }
                        >
                          <SelectTrigger
                            className="h-10 w-full"
                            aria-label="농가 지역 필터"
                          >
                            <SelectValue>
                              {farmRegionFilter === 'all'
                                ? '모든 지역'
                                : farmRegionFilter}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 지역</SelectItem>
                            {farmLedgerSummary.regions.map((item) => (
                              <SelectItem key={item.label} value={item.label}>
                                {item.label} · {item.count}곳
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                        <p className="text-sm text-[#69766e]">
                          현재 조건{' '}
                          <strong className="text-[#285f43]">
                            {filteredFarms.length}곳
                          </strong>{' '}
                          <span className="text-[#9aa39d]">
                            / 전체 {farmLedgerSummary.total}곳
                          </span>
                        </p>
                        {(search ||
                          projectFilter !== 'all' ||
                          subscriptionFilter !== 'all' ||
                          farmCropFilter !== 'all' ||
                          farmRegionFilter !== 'all') && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetFarmLedgerFilters}
                            className="text-[#39795b]"
                          >
                            전체 조건 초기화
                          </Button>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#f7f9f6]">
                              <TableHead className="pl-5">농가</TableHead>
                              <TableHead>사업</TableHead>
                              <TableHead>지역·작목</TableHead>
                              <TableHead>최근 업무</TableHead>
                              <TableHead>업무 상태</TableHead>
                              <TableHead>구독</TableHead>
                              <TableHead>구독 만료일</TableHead>
                              <TableHead className="pr-5 text-right">
                                최근 활동
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFarms.map((farm) => {
                              const {
                                record,
                                project,
                                latestWorkItem,
                                subscriptionStatus,
                              } = farmRow(farm);
                              const expiryRecords =
                                subscriptionRecordsForFarm(farm);
                              return (
                                <TableRow key={farm.id}>
                                  <TableCell className="pl-5">
                                    <button
                                      type="button"
                                      onClick={() => openFarm(farm.id)}
                                      className="text-left"
                                    >
                                      <p className="font-semibold hover:text-[#2f7b59]">
                                        {farm.name}
                                      </p>
                                      <p className="mt-1 text-xs text-[#89938c]">
                                        {farm.farmCode}
                                      </p>
                                    </button>
                                  </TableCell>
                                  <TableCell className="max-w-[230px]">
                                    <p className="truncate">
                                      {project?.name ?? '미연결'}
                                    </p>
                                    <p className="mt-1 text-xs text-[#8b958e]">
                                      {recordsByFarm.get(farm.id)?.length ?? 0}
                                      개 참여 사업
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <p>{farm.region}</p>
                                    <p className="mt-1 text-xs text-[#8b958e]">
                                      {record?.crop || '작목 미입력'} ·{' '}
                                      {record?.deviceType || '장비 미입력'}
                                    </p>
                                  </TableCell>
                                  <TableCell className="max-w-[230px]">
                                    <p className="truncate">
                                      {latestWorkItem?.title ||
                                        '등록된 업무 없음'}
                                    </p>
                                    <p className="mt-1 text-xs text-[#8b958e]">
                                      {latestWorkItem
                                        ? FARM_WORK_TYPE_LABELS[
                                            latestWorkItem.workType
                                          ]
                                        : ''}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    {latestWorkItem && (
                                      <Badge
                                        variant="outline"
                                        className={workStatusClass(
                                          latestWorkItem.status,
                                        )}
                                      >
                                        {
                                          FARM_WORK_STATUS_LABELS[
                                            latestWorkItem.status
                                          ]
                                        }
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={subscriptionClass(
                                        subscriptionStatus,
                                      )}
                                    >
                                      {
                                        SUBSCRIPTION_STATUS_LABELS[
                                          subscriptionStatus
                                        ]
                                      }
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="min-w-[190px]">
                                    <div className="space-y-1.5">
                                      {expiryRecords
                                        .slice(0, 2)
                                        .map((expiryRecord) => {
                                          const expiryProject = projectById.get(
                                            expiryRecord.projectId,
                                          );
                                          return (
                                            <button
                                              key={expiryRecord.id}
                                              type="button"
                                              onClick={() =>
                                                openSubscriptionExpiryDialog(
                                                  expiryRecord,
                                                )
                                              }
                                              className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#f1f7f2]"
                                              aria-label={`${farm.name} · ${expiryProject?.name ?? '사업 없음'} 구독 만료일 입력·정정`}
                                            >
                                              <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-[#355f46]">
                                                  {formatDate(
                                                    expiryRecord.currentSubscriptionExpiresAt,
                                                  )}
                                                </span>
                                                <span className="block max-w-[145px] truncate text-[11px] text-[#89938c]">
                                                  {expiryProject?.name ??
                                                    '사업 없음'}
                                                </span>
                                              </span>
                                              <Pencil className="size-3.5 shrink-0 text-[#75917e] opacity-60 group-hover:opacity-100" />
                                            </button>
                                          );
                                        })}
                                      {expiryRecords.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => openFarm(farm.id)}
                                          className="px-2 text-[11px] font-semibold text-[#39795b]"
                                        >
                                          외 {expiryRecords.length - 2}개 사업
                                          보기
                                        </button>
                                      )}
                                      {!expiryRecords.length && (
                                        <span className="text-xs text-[#9aa39d]">
                                          참여 사업 없음
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="pr-5 text-right text-xs text-[#89938c]">
                                    {formatTimestamp(
                                      farmLastActivity(farm),
                                      true,
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {!filteredFarms.length && (
                              <TableRow>
                                <TableCell
                                  colSpan={8}
                                  className="h-40 text-center text-[#89938c]"
                                >
                                  검색 조건에 맞는 농가가 없습니다.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </section>
                  )}

                  {view === 'projects' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div>
                          <p className="text-sm font-medium text-[#647568]">
                            프로젝트 중심 조회
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            프로젝트 통합관리
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            연도별 사업과 설치·시운전·교육·구독률, 막힘, 서류와
                            정산을 한곳에서 확인합니다.
                          </p>
                        </div>
                        <Button
                          onClick={openProjectDialog}
                          className="bg-[#2f7b59] hover:bg-[#286b4d]"
                        >
                          <Plus />
                          프로젝트 추가
                        </Button>
                      </div>
                      {deletedProjects.length > 0 && (
                        <Collapsible className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                          <CollapsibleTrigger className="flex min-h-10 w-full items-center justify-between text-sm font-medium">
                            삭제한 프로젝트 {deletedProjects.length}개
                            <ChevronDown className="size-4" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 pt-3">
                            <p className="text-sm text-slate-600">
                              농가·구독·입금·업무·서류 기록은 보존되어 있습니다.
                            </p>
                            {deletedProjects.map((project) => (
                              <div
                                key={project.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                              >
                                <span className="text-sm">
                                  {project.year}년 · {project.name}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setProjectDeletionTarget(project)
                                  }
                                >
                                  복구
                                </Button>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
                        <ProjectYearSelector
                          id="management-project-year"
                          projects={activeProjects}
                          value={projectYearFilter}
                          onChange={setProjectYearFilter}
                        />
                        <ProjectTypeSelector
                          id="project-type-scope"
                          value={projectTypeFilter}
                          onChange={setProjectTypeFilter}
                        />
                      </div>
                      <ProjectKpiPanel
                        summary={yearProjectKpis}
                        year={projectYearFilter}
                        projectType={projectTypeFilter}
                        onSelect={selectProjectKpi}
                      />
                      <div className="mb-5 grid gap-3 rounded-xl border border-[#d8e0e7] bg-white p-3 sm:grid-cols-[1fr_220px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#879088]" />
                          <Input
                            value={projectSearch}
                            onChange={(event) =>
                              setProjectSearch(event.target.value)
                            }
                            placeholder="프로젝트명, 기관, 담당자, 연도 검색"
                            className="pl-9"
                            aria-label="프로젝트 검색"
                          />
                        </div>
                        <Select
                          value={projectRiskFilter}
                          onValueChange={(value) =>
                            setProjectRiskFilter(
                              value as typeof projectRiskFilter,
                            )
                          }
                        >
                          <SelectTrigger
                            className="h-10 w-full"
                            aria-label="프로젝트 위험 필터"
                          >
                            <SelectValue>
                              {projectRiskFilter === 'all'
                                ? '모든 프로젝트'
                                : projectRiskFilter === 'blocked'
                                  ? '막힘 있음'
                                  : projectRiskFilter === 'documents'
                                    ? '서류 위험'
                                    : projectRiskFilter === 'subscription'
                                      ? '구독 위험'
                                      : '정산 위험'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 프로젝트</SelectItem>
                            <SelectItem value="blocked">막힘 있음</SelectItem>
                            <SelectItem value="documents">서류 위험</SelectItem>
                            <SelectItem value="subscription">
                              구독 위험
                            </SelectItem>
                            <SelectItem value="settlement">
                              정산 위험
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Tabs defaultValue="table" className="gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold">
                            프로젝트 {filteredProjects.length}개{' '}
                            <span className="font-normal text-[#586777]">
                              · 이름을 누르면 상세로 이동합니다
                            </span>
                          </p>
                          <TabsList aria-label="프로젝트 표시 방식">
                            <TabsTrigger value="table">
                              <List />표
                            </TabsTrigger>
                            <TabsTrigger value="cards">
                              <LayoutDashboard />
                              카드
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        <TabsContent
                          value="table"
                          className="overflow-hidden rounded-xl border border-[#d8e0e7] bg-white"
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>프로젝트·담당자</TableHead>
                                <TableHead>진행 상태</TableHead>
                                <TableHead>하위 업무</TableHead>
                                <TableHead>농가·구독</TableHead>
                                <TableHead>설치 / 시운전 / 교육</TableHead>
                                <TableHead>서류·정산</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredProjects.map((project) => {
                                const snapshot = projectSnapshots.get(
                                  project.id,
                                )!;
                                const completed =
                                  snapshot.hierarchy.leaves.filter(
                                    (item) => item.status === 'completed',
                                  ).length;
                                const blockers =
                                  snapshot.openProjectBlockers.length +
                                  snapshot.blockedItems.length;
                                return (
                                  <TableRow key={project.id}>
                                    <TableCell className="max-w-sm whitespace-normal">
                                      <button
                                        type="button"
                                        className="min-h-10 text-left font-bold text-[#176448] hover:underline"
                                        onClick={() =>
                                          openProjectDetail(project.id)
                                        }
                                      >
                                        {project.name}
                                      </button>
                                      <p className="text-sm text-[#586777]">
                                        {project.year}년 ·{' '}
                                        {
                                          FARM_PROJECT_TYPE_LABELS[
                                            project.projectType
                                          ]
                                        }{' '}
                                        · {project.manager || '담당 미지정'}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={projectStatusClass(
                                          project.status,
                                        )}
                                      >
                                        {
                                          FARM_PROJECT_STATUS_LABELS[
                                            project.status
                                          ]
                                        }
                                      </Badge>
                                      <p className="mt-1 text-sm">
                                        {
                                          FARM_PROJECT_STAGE_LABELS[
                                            project.currentStage
                                          ]
                                        }
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <strong>
                                        실행 업무 {completed}/
                                        {snapshot.hierarchy.leafCount}건 완료
                                      </strong>
                                      <p
                                        className={`mt-1 text-sm ${blockers ? 'text-[#ad432b]' : 'text-[#586777]'}`}
                                      >
                                        {blockers
                                          ? `막힘 ${blockers}건`
                                          : '막힘 없음'}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <strong>
                                        {snapshot.records.length}개소
                                      </strong>
                                      <p className="mt-1 text-sm text-[#586777]">
                                        구독{' '}
                                        {snapshot.activeSubscriptions.length}
                                        개소
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <ProjectStageSummary
                                        progress={snapshot.farmProgress}
                                        projectName={project.name}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <p>
                                        서류 승인{' '}
                                        {snapshot.approvedDocuments.length}/
                                        {snapshot.requiredDocuments.length}건
                                      </p>
                                      <p className="mt-1 text-sm text-[#586777]">
                                        {projectSettlementLabel(project)}
                                      </p>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {!filteredProjects.length && (
                                <TableRow>
                                  <TableCell
                                    colSpan={6}
                                    className="h-32 text-center"
                                  >
                                    조건에 맞는 프로젝트가 없습니다. 연도·사업
                                    타입·검색 조건을 확인하세요.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TabsContent>
                        <TabsContent value="cards">
                          <div className="grid gap-4 xl:grid-cols-2">
                            {filteredProjects.map((project) => {
                              const projectCardSnapshot = projectSnapshots.get(
                                project.id,
                              )!;
                              return (
                                <button
                                  type="button"
                                  key={project.id}
                                  aria-label={`${project.name} 통합 현황 보기`}
                                  onClick={() => openProjectDetail(project.id)}
                                  className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f9a70] focus-visible:ring-offset-2"
                                >
                                  <Card className="h-full cursor-pointer border-0 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                    <CardContent className="px-5 py-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="mb-2 flex flex-wrap gap-2">
                                            <Badge variant="outline">
                                              {project.year}
                                            </Badge>
                                            <Badge variant="outline">
                                              {
                                                FARM_PROJECT_TYPE_LABELS[
                                                  project.projectType
                                                ]
                                              }
                                            </Badge>
                                            <Badge variant="outline">
                                              {
                                                FARM_PROJECT_STATUS_LABELS[
                                                  project.status
                                                ]
                                              }
                                            </Badge>
                                          </div>
                                          <h2 className="truncate text-lg font-bold">
                                            {project.name}
                                          </h2>
                                          <p className="mt-1 text-sm text-[#748178]">
                                            {project.institution}
                                          </p>
                                        </div>
                                        <div className="grid size-12 place-items-center rounded-2xl bg-[#e8f3e5] text-[#4c7c48]">
                                          <BriefcaseBusiness className="size-5" />
                                        </div>
                                      </div>
                                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#66736b]">
                                        {project.description ||
                                          '사업 설명이 없습니다.'}
                                      </p>
                                      <div className="mt-5 grid grid-cols-4 gap-3">
                                        <div>
                                          <p className="text-[11px] text-[#89938c]">
                                            농가
                                          </p>
                                          <p className="mt-1 font-bold">
                                            {projectCardSnapshot.records.length}
                                            곳
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[11px] text-[#89938c]">
                                            목표
                                          </p>
                                          <p className="mt-1 font-bold">
                                            {project.targetFarmCount || '-'}곳
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[11px] text-[#89938c]">
                                            진행 업무
                                          </p>
                                          <p className="mt-1 font-bold">
                                            {
                                              projectCardSnapshot.hierarchy.leaves.filter(
                                                (item) =>
                                                  item.status !== 'completed',
                                              ).length
                                            }
                                            건
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[11px] text-[#89938c]">
                                            프로젝트 진행
                                          </p>
                                          <p className="mt-1 font-bold">
                                            {
                                              projectCardSnapshot.overallProgress
                                            }
                                            %
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1ec]">
                                        <div
                                          className="h-full rounded-full bg-[#62b982]"
                                          style={{
                                            width: `${projectCardSnapshot.overallProgress}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {[
                                          {
                                            label: '설치',
                                            complete:
                                              projectCardSnapshot.records.filter(
                                                (record) =>
                                                  isFarmStageComplete(
                                                    record,
                                                    'installationDate',
                                                  ),
                                              ).length,
                                            rate: projectCardSnapshot.installationRate,
                                          },
                                          {
                                            label: '시운전',
                                            complete:
                                              projectCardSnapshot.records.filter(
                                                (record) =>
                                                  isFarmStageComplete(
                                                    record,
                                                    'commissioningDate',
                                                  ),
                                              ).length,
                                            rate: projectCardSnapshot.commissioningRate,
                                          },
                                          {
                                            label: '교육',
                                            complete:
                                              projectCardSnapshot.records.filter(
                                                (record) =>
                                                  isFarmStageComplete(
                                                    record,
                                                    'educationDate',
                                                  ),
                                              ).length,
                                            rate: projectCardSnapshot.educationRate,
                                          },
                                          {
                                            label: '유효 구독',
                                            complete:
                                              projectCardSnapshot
                                                .activeSubscriptions.length,
                                            rate: projectCardSnapshot.subscriptionRate,
                                          },
                                        ].map((metric) => (
                                          <div
                                            key={metric.label}
                                            className="rounded-xl bg-[#f6f8f5] px-3 py-2.5"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-sm font-medium text-[#7d8981]">
                                                {metric.label}
                                              </span>
                                              <strong className="text-base text-[#315f43]">
                                                {metric.rate === null
                                                  ? '-'
                                                  : `${metric.rate}%`}
                                              </strong>
                                            </div>
                                            <p className="mt-2 text-sm text-slate-600">
                                              {metric.label === '유효 구독'
                                                ? '구독'
                                                : '완료'}{' '}
                                              {metric.complete}개소
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-amber-800">
                                              {metric.label === '유효 구독'
                                                ? '유효 구독 아님'
                                                : '미완료'}{' '}
                                              {projectCardSnapshot.records
                                                .length - metric.complete}
                                              개소
                                            </p>
                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e3e9e2]">
                                              <div
                                                className="h-full rounded-full bg-[#6ab27e]"
                                                style={{
                                                  width: `${metric.rate ?? 0}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <Badge
                                          variant="outline"
                                          className={
                                            projectCardSnapshot
                                              .openProjectBlockers.length ||
                                            projectCardSnapshot.blockedItems
                                              .length ||
                                            projectCardSnapshot.documentRisks
                                              .length
                                              ? 'border-[#efc8bb] bg-[#fff1ec] text-[#a94f32]'
                                              : 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]'
                                          }
                                        >
                                          막힘{' '}
                                          {projectCardSnapshot
                                            .openProjectBlockers.length +
                                            projectCardSnapshot.blockedItems
                                              .length +
                                            projectCardSnapshot.documentRisks
                                              .length}
                                          건
                                        </Badge>
                                        <Badge variant="outline">
                                          구독{' '}
                                          {
                                            projectCardSnapshot
                                              .activeSubscriptions.length
                                          }
                                          /{projectCardSnapshot.records.length}
                                        </Badge>
                                        <Badge variant="outline">
                                          서류{' '}
                                          {
                                            projectCardSnapshot
                                              .submittedDocuments.length
                                          }
                                          /
                                          {
                                            projectCardSnapshot
                                              .requiredDocuments.length
                                          }{' '}
                                          제출
                                        </Badge>
                                        <Badge variant="outline">
                                          {projectSettlementLabel(project)}
                                        </Badge>
                                      </div>
                                      <div className="mt-4 flex items-center justify-between border-t border-[#edf1ec] pt-3 text-xs font-semibold text-[#3d7455]">
                                        <span>
                                          현재 단계 ·{' '}
                                          {
                                            FARM_PROJECT_STAGE_LABELS[
                                              project.currentStage
                                            ]
                                          }
                                        </span>
                                        <span>통합 현황 보기 →</span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </button>
                              );
                            })}
                            {!filteredProjects.length && (
                              <div className="rounded-2xl border border-dashed border-[#d7dfd5] bg-white py-14 text-center xl:col-span-2">
                                <BriefcaseBusiness className="mx-auto size-8 text-[#97a29a]" />
                                <p className="mt-3 font-semibold">
                                  {workspace.projects.length
                                    ? '선택한 연도·사업 타입·검색·위험에 맞는 프로젝트가 없습니다.'
                                    : '아직 등록된 프로젝트가 없습니다.'}
                                </p>
                                <p className="mt-1 text-sm text-[#89938c]">
                                  {workspace.projects.length
                                    ? '검색어나 위험 필터를 바꿔 보세요.'
                                    : '프로젝트를 먼저 만들면 농가·구독·서류·정산을 연결할 수 있습니다.'}
                                </p>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </section>
                  )}

                  {view === 'business' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div>
                          <p className="text-sm font-medium text-[#647568]">
                            사업 성과와 설치 단계
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            사업 집계
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            전체 연도와 연도별 사업 수,
                            설치·시운전·교육·구독률을 비교합니다.
                          </p>
                        </div>
                        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[430px]">
                          <Select
                            value={businessYearFilter}
                            onValueChange={(value) =>
                              setBusinessYearFilter(value ?? 'all')
                            }
                          >
                            <SelectTrigger
                              className="h-10 w-full bg-white"
                              aria-label="사업 집계 연도 필터"
                            >
                              <SelectValue>
                                {businessYearFilter === 'all'
                                  ? '모든 사업연도'
                                  : `${businessYearFilter}년`}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">모든 사업연도</SelectItem>
                              {businessYears.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                  {year}년
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={businessTypeFilter}
                            onValueChange={(value) =>
                              setBusinessTypeFilter(
                                value as typeof businessTypeFilter,
                              )
                            }
                          >
                            <SelectTrigger
                              className="h-10 w-full bg-white"
                              aria-label="사업 유형 필터"
                            >
                              <SelectValue>
                                {businessTypeFilter === 'all'
                                  ? '모든 사업 유형'
                                  : FARM_PROJECT_TYPE_LABELS[
                                      businessTypeFilter
                                    ]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                모든 사업 유형
                              </SelectItem>
                              {Object.entries(FARM_PROJECT_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                        {[
                          {
                            label: '대상 사업',
                            value: `${businessProjects.length}개`,
                            note:
                              businessYearFilter === 'all'
                                ? '전체 사업연도'
                                : `${businessYearFilter}년 사업`,
                            icon: BriefcaseBusiness,
                          },
                          {
                            label: '참여 농가',
                            value: `${new Set(businessRecords.map((record) => record.farmId)).size}곳`,
                            note: `사업 참여 ${businessRecords.length}건`,
                            icon: Warehouse,
                          },
                          {
                            label: '설치율',
                            value:
                              businessInstallationRate === null
                                ? '-'
                                : `${businessInstallationRate}%`,
                            note: `${businessInstallation}/${businessRecords.length}곳`,
                            icon: CalendarCheck2,
                          },
                          {
                            label: '시운전율',
                            value:
                              businessCommissioningRate === null
                                ? '-'
                                : `${businessCommissioningRate}%`,
                            note: `${businessCommissioning}/${businessRecords.length}곳`,
                            icon: Wrench,
                          },
                          {
                            label: '교육률',
                            value:
                              businessEducationRate === null
                                ? '-'
                                : `${businessEducationRate}%`,
                            note: `${businessEducation}/${businessRecords.length}곳`,
                            icon: TrendingUp,
                          },
                          {
                            label: '유효 구독률',
                            value:
                              businessSubscriptionRate === null
                                ? '-'
                                : `${businessSubscriptionRate}%`,
                            note: `${businessSubscriptions}/${businessRecords.length}곳`,
                            icon: CalendarClock,
                          },
                        ].map((metric) => (
                          <Card
                            key={metric.label}
                            className="border-0 bg-white ring-[#dfe6dd]"
                          >
                            <CardContent className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#7a867d]">
                                  {metric.label}
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {metric.value}
                                </p>
                                <p className="mt-1 text-[11px] text-[#89938c]">
                                  {metric.note}
                                </p>
                              </div>
                              <div className="grid size-10 place-items-center rounded-xl bg-[#edf5e8] text-[#4d7b50]">
                                <metric.icon className="size-5" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <div className="mb-5 overflow-x-auto rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <div className="flex min-w-[900px] items-center justify-between gap-4 border-b border-[#e5ebe3] px-5 py-4">
                          <div>
                            <h2 className="font-bold">연도별 사업 현황</h2>
                            <p className="mt-0.5 text-xs text-[#89938c]">
                              같은 농가가 여러 사업에 참여하면 사업별로 1건씩
                              집계합니다.
                            </p>
                          </div>
                          {businessYearFilter !== 'all' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setBusinessYearFilter('all')}
                            >
                              전체 연도 보기
                            </Button>
                          )}
                        </div>
                        <Table className="min-w-[900px]">
                          <TableHeader>
                            <TableRow className="bg-[#f7f9f6]">
                              <TableHead className="pl-5">사업연도</TableHead>
                              <TableHead>사업 상태</TableHead>
                              <TableHead>농가 참여</TableHead>
                              <TableHead>설치율</TableHead>
                              <TableHead>시운전율</TableHead>
                              <TableHead>교육률</TableHead>
                              <TableHead className="pr-5">
                                유효 구독률
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {annualBusinessSummaries.map((summary) => (
                              <TableRow key={summary.year}>
                                <TableCell className="pl-5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    aria-pressed={
                                      businessYearFilter ===
                                      String(summary.year)
                                    }
                                    onClick={() =>
                                      setBusinessYearFilter(
                                        businessYearFilter ===
                                          String(summary.year)
                                          ? 'all'
                                          : String(summary.year),
                                      )
                                    }
                                    className={
                                      businessYearFilter ===
                                      String(summary.year)
                                        ? 'border-[#7bb38b] bg-[#edf7ef] text-[#2f704c]'
                                        : ''
                                    }
                                  >
                                    {summary.year}년
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <p className="font-semibold">
                                    {summary.projects.length}개
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#89938c]">
                                    진행 {summary.activeProjects} · 보류{' '}
                                    {summary.onHoldProjects} · 완료{' '}
                                    {summary.completedProjects}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  {summary.participationCount}건
                                </TableCell>
                                {[
                                  {
                                    label: '설치',
                                    complete: summary.installation,
                                    rate: summary.installationRate,
                                  },
                                  {
                                    label: '시운전',
                                    complete: summary.commissioning,
                                    rate: summary.commissioningRate,
                                  },
                                  {
                                    label: '교육',
                                    complete: summary.education,
                                    rate: summary.educationRate,
                                  },
                                  {
                                    label: '유효 구독',
                                    complete: summary.subscription,
                                    rate: summary.subscriptionRate,
                                  },
                                ].map((metric, index) => (
                                  <TableCell
                                    key={metric.label}
                                    className={index === 3 ? 'pr-5' : ''}
                                  >
                                    <p className="font-semibold">
                                      {metric.rate === null
                                        ? '-'
                                        : `${metric.rate}%`}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#89938c]">
                                      {metric.complete}/
                                      {summary.participationCount}건
                                    </p>
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {!annualBusinessSummaries.length && (
                              <TableRow>
                                <TableCell
                                  colSpan={7}
                                  className="h-28 text-center text-[#89938c]"
                                >
                                  집계할 사업연도 정보가 없습니다.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <div className="border-b border-[#e5ebe3] px-5 py-4">
                          <h2 className="font-bold">사업별 설치 진행</h2>
                          <p className="mt-0.5 text-xs text-[#89938c]">
                            날짜가 입력된 설치·시운전·교육과 만료 전 사용중
                            구독만 완료로 집계합니다.
                          </p>
                        </div>
                        <Table className="min-w-[1050px]">
                          <TableHeader>
                            <TableRow className="bg-[#f7f9f6]">
                              <TableHead className="pl-5">사업</TableHead>
                              <TableHead>참여</TableHead>
                              <TableHead>제작</TableHead>
                              <TableHead>설치</TableHead>
                              <TableHead>시운전</TableHead>
                              <TableHead>교육</TableHead>
                              <TableHead>유효 구독</TableHead>
                              <TableHead className="pr-5">
                                구축·운영 평균
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {businessProjectSummaries.map(
                              ({
                                project,
                                records,
                                production,
                                installation,
                                commissioning,
                                education,
                                subscription,
                                installationRate,
                                commissioningRate,
                                educationRate,
                                subscriptionRate,
                                progress,
                              }) => (
                                <TableRow key={project.id}>
                                  <TableCell className="pl-5">
                                    <p className="max-w-[300px] truncate font-semibold">
                                      {project.name}
                                    </p>
                                    <p className="mt-1 text-xs text-[#89938c]">
                                      {project.year} ·{' '}
                                      {
                                        FARM_PROJECT_TYPE_LABELS[
                                          project.projectType
                                        ]
                                      }
                                    </p>
                                  </TableCell>
                                  <TableCell>{records.length}곳</TableCell>
                                  <TableCell>{production}곳</TableCell>
                                  {[
                                    {
                                      label: '설치',
                                      complete: installation,
                                      rate: installationRate,
                                    },
                                    {
                                      label: '시운전',
                                      complete: commissioning,
                                      rate: commissioningRate,
                                    },
                                    {
                                      label: '교육',
                                      complete: education,
                                      rate: educationRate,
                                    },
                                    {
                                      label: '유효 구독',
                                      complete: subscription,
                                      rate: subscriptionRate,
                                    },
                                  ].map((metric) => (
                                    <TableCell key={metric.label}>
                                      <p className="font-semibold">
                                        {metric.rate === null
                                          ? '-'
                                          : `${metric.rate}%`}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[#89938c]">
                                        {metric.complete}/{records.length}곳
                                      </p>
                                    </TableCell>
                                  ))}
                                  <TableCell className="pr-5">
                                    <div className="flex min-w-[130px] items-center gap-3">
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf1ec]">
                                        <div
                                          className="h-full rounded-full bg-[#62b982]"
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <strong className="w-9 text-right text-sm">
                                        {progress}%
                                      </strong>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                            {!businessProjectSummaries.length && (
                              <TableRow>
                                <TableCell
                                  colSpan={8}
                                  className="h-32 text-center text-[#89938c]"
                                >
                                  선택한 조건의 사업이 없습니다.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-5 grid gap-4 xl:grid-cols-3">
                        {[
                          { title: '지역 분포', items: regionBreakdown },
                          { title: '작물 분포', items: cropBreakdown },
                          { title: '제품 분포', items: productBreakdown },
                        ].map((group) => {
                          const max = group.items[0]?.count ?? 1;
                          return (
                            <Card
                              key={group.title}
                              className="border-0 bg-white ring-[#dfe6dd]"
                            >
                              <CardContent>
                                <div className="mb-4 flex items-center justify-between">
                                  <h2 className="font-bold">{group.title}</h2>
                                  <Badge variant="outline">상위 6개</Badge>
                                </div>
                                <div className="space-y-3">
                                  {group.items.slice(0, 6).map((item) => (
                                    <div key={item.label}>
                                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                        <span className="truncate font-medium">
                                          {item.label}
                                        </span>
                                        <strong>{item.count}곳</strong>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1ec]">
                                        <div
                                          className="h-full rounded-full bg-[#7fbd8e]"
                                          style={{
                                            width: `${Math.max(8, (item.count / max) * 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                  {!group.items.length && (
                                    <p className="py-6 text-center text-sm text-[#89938c]">
                                      집계할 정보가 없습니다.
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {view === 'subscriptions' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                        <div>
                          <p className="text-sm font-medium text-[#647568]">
                            구독과 입금
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            구독·입금 관리
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            농가별 만료일과 입금을 빠르게 처리하고, 별도 보고
                            화면에서 기간별 실적을 확인합니다.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {subscriptionMode === 'report' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void copySubscriptionReport()}
                            >
                              <Copy />
                              보고문 복사
                            </Button>
                          )}
                          <Button
                            type="button"
                            onClick={() => openSubscriptionEventDialog()}
                            className="bg-[#327a56] hover:bg-[#286848]"
                          >
                            <Plus />
                            구독 처리 등록
                          </Button>
                        </div>
                      </div>

                      <Tabs
                        value={subscriptionMode}
                        onValueChange={(value) => {
                          setSubscriptionMode(value as SubscriptionMode);
                          setSubscriptionListPage(1);
                        }}
                      >
                        <TabsList className="mb-4 h-11 w-full max-w-[560px] rounded-xl bg-[#e9efe9] p-1">
                          <TabsTrigger value="management" className="h-9 px-4">
                            <CreditCard />
                            구독·입금 관리
                            <Badge variant="outline">
                              {subscriptionScopedRecords.length}
                            </Badge>
                          </TabsTrigger>
                          <TabsTrigger value="report" className="h-9 px-4">
                            <BarChart3 />
                            만료·실적 보고
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="report" className="mt-0">
                          <div className="mb-4">
                            <h2 className="text-xl font-bold">구독 실적</h2>
                            <p className="mt-1 text-sm text-[#627269]">
                              매년 1월~12월 전체 만료 농가와 갱신·미갱신 실적을
                              확인합니다.
                            </p>
                          </div>
                          <Card className="mb-4 border-0 bg-white ring-[#dfe6dd]">
                            <CardContent>
                              <div className="grid gap-3 lg:grid-cols-[180px_minmax(220px,1fr)]">
                                <Field>
                                  <FieldLabel>기준 연도</FieldLabel>
                                  <Select
                                    value={subscriptionReportYear}
                                    onValueChange={(value) =>
                                      value && setSubscriptionReportYear(value)
                                    }
                                  >
                                    <SelectTrigger className="h-10 w-full">
                                      <SelectValue>
                                        {subscriptionReportYear === 'all'
                                          ? '전체 연도'
                                          : `${subscriptionReportYear}년`}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">
                                        전체 연도
                                      </SelectItem>
                                      {subscriptionReportYears.map((year) => (
                                        <SelectItem
                                          key={year}
                                          value={String(year)}
                                        >
                                          {year}년
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field>
                                  <FieldLabel>사업 타입</FieldLabel>
                                  <Select
                                    value={subscriptionReportProjectType}
                                    onValueChange={(value) => {
                                      if (!value) return;
                                      setSubscriptionReportProjectType(
                                        value as typeof subscriptionReportProjectType,
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-10 w-full">
                                      <SelectValue>
                                        {subscriptionReportProjectType === 'all'
                                          ? '전체 사업 타입'
                                          : FARM_PROJECT_TYPE_LABELS[
                                              subscriptionReportProjectType
                                            ]}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">
                                        전체 사업 타입
                                      </SelectItem>
                                      {Object.entries(
                                        FARM_PROJECT_TYPE_LABELS,
                                      ).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-[#7a867d]">
                                {subscriptionReportYear === 'all'
                                  ? '전체 연도는 실제 입금 연도별 갱신 차수를 비교합니다. 개별 연도를 선택하면 1월~12월 만료 농가와 갱신율을 확인합니다.'
                                  : `${subscriptionReportYear}년 1월 1일~12월 31일 전체를 조회합니다. 갱신율은 만료일이 지난 대상을 기준으로 계산하며 만료 예정에는 오늘 만료도 포함합니다.`}
                              </p>
                            </CardContent>
                          </Card>

                          {subscriptionReportYear === 'all' ? (
                            <SubscriptionPaymentYearPanel
                              report={subscriptionPaymentYears}
                            />
                          ) : (
                            <SubscriptionRenewalPanel
                              key={`${subscriptionReportYear}-${subscriptionReportProjectType}`}
                              report={subscriptionReport.renewal}
                              projects={workspace.projects}
                              records={workspace.records}
                              farms={workspace.farms}
                              onOpenRecord={(record, projectId) =>
                                openFarm(record.farmId, '', projectId)
                              }
                              onRegister={(record, expiryDate) => {
                                openSubscriptionEventDialog(record);
                                setSubscriptionEventForm((current) => ({
                                  ...current,
                                  basisExpiryDate: expiryDate,
                                  basisRenewalCount: '',
                                  newExpiryDate: addYears(expiryDate, 1),
                                }));
                              }}
                            />
                          )}
                          <SubscriptionCyclePanel
                            counts={subscriptionCycleCounts}
                          />

                          <div className="mb-8 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <div>
                                    <h2 className="font-bold">만료 예정</h2>
                                    <p className="mt-1 text-xs text-[#89938c]">
                                      {formatDate(subscriptionReport.asOfDate)}{' '}
                                      기준 · 내일부터 만료되는 사용 중 구독(전체
                                      기간)
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {subscriptionReport.upcoming.reduce(
                                      (sum, year) => sum + year.count,
                                      0,
                                    )}
                                    개소
                                  </Badge>
                                </div>
                                <div className="space-y-3">
                                  {subscriptionReport.upcoming.map((year) => (
                                    <details
                                      key={year.year}
                                      className="group rounded-2xl border border-[#dfe6dd] bg-[#fbfcfa]"
                                    >
                                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold">
                                        <span>{year.year}년</span>
                                        <Badge variant="outline">
                                          {year.count}개소
                                        </Badge>
                                      </summary>
                                      <div className="space-y-3 border-t border-[#e4e9e3] p-3">
                                        {year.months.map((month) => (
                                          <div
                                            key={month.month}
                                            className="rounded-xl bg-white p-3"
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <strong className="text-sm">
                                                {month.month}월
                                              </strong>
                                              <span className="text-sm font-bold text-[#39795b]">
                                                {month.count}개소
                                              </span>
                                            </div>
                                            <div className="mt-3 space-y-2">
                                              {month.projects.map((project) => (
                                                <details
                                                  key={project.projectId}
                                                >
                                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs text-[#617066]">
                                                    <span>{project.name}</span>
                                                    <strong>
                                                      {project.count}개소
                                                    </strong>
                                                  </summary>
                                                  <div className="mt-2 flex flex-wrap gap-1.5 border-l-2 border-[#dce9df] pl-3">
                                                    {project.records.map(
                                                      (record) => (
                                                        <button
                                                          key={record.id}
                                                          type="button"
                                                          onClick={() =>
                                                            openFarm(
                                                              record.farmId,
                                                            )
                                                          }
                                                          className="rounded-full border border-[#dfe6dd] bg-[#f7f9f6] px-2.5 py-1 text-[11px] hover:border-[#9fc7aa]"
                                                        >
                                                          {farmById.get(
                                                            record.farmId,
                                                          )?.name ??
                                                            '농가 없음'}
                                                        </button>
                                                      ),
                                                    )}
                                                  </div>
                                                </details>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  ))}
                                  {!subscriptionReport.upcoming.length && (
                                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-[#89938c]">
                                      오늘 이후 만료 예정 구독이 없습니다.
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="h-fit border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <div>
                                    <h2 className="font-bold">
                                      최근 구독 처리
                                    </h2>
                                    <p className="mt-1 text-xs text-[#89938c]">
                                      갱신·이탈·재가입 이력
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openSubscriptionEventDialog()
                                    }
                                  >
                                    <Plus />
                                    등록
                                  </Button>
                                </div>
                                <div className="space-y-3">
                                  {subscriptionReport.recentEvents.map(
                                    (event) => {
                                      const record = recordById.get(
                                        event.farmRecordId,
                                      );
                                      const farm = record
                                        ? farmById.get(record.farmId)
                                        : null;
                                      return (
                                        <button
                                          key={event.id}
                                          type="button"
                                          onClick={() =>
                                            record &&
                                            openFarm(
                                              record.farmId,
                                              '',
                                              record.projectId,
                                            )
                                          }
                                          className="w-full rounded-xl bg-[#f6f8f5] p-3 text-left"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <Badge variant="outline">
                                              {
                                                FARM_SUBSCRIPTION_EVENT_TYPE_LABELS[
                                                  event.eventType
                                                ]
                                              }
                                            </Badge>
                                            <span className="text-[11px] text-[#89938c]">
                                              {formatDate(event.processedAt)}
                                            </span>
                                          </div>
                                          <p className="mt-2 truncate text-sm font-semibold">
                                            {farm?.name ?? '농가 없음'}
                                          </p>
                                          <p className="mt-1 truncate text-xs text-[#77847b]">
                                            {projectById.get(event.projectId)
                                              ?.name ?? '사업 없음'}
                                          </p>
                                        </button>
                                      );
                                    },
                                  )}
                                  {!subscriptionReport.recentEvents.length && (
                                    <p className="py-8 text-center text-sm text-[#89938c]">
                                      아직 등록된 구독 처리 이력이 없습니다.
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>

                        <TabsContent value="management" className="mt-0">
                          {subscriptionFocus && (
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#bfd9cc] bg-[#eaf5ef] px-4 py-2">
                              <p className="text-sm">
                                <strong>{subscriptionFocus.label}</strong> ·
                                통합 현황에서 선택한 대상
                              </p>
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setSubscriptionFocus(null);
                                  setSubscriptionListPage(1);
                                }}
                              >
                                범위 해제
                              </Button>
                            </div>
                          )}
                          <div className="mb-4">
                            <p className="text-sm font-medium text-[#647568]">
                              현재 운영·입금
                            </p>
                            <h2 className="mt-1 text-xl font-bold">
                              농가별 구독 만료일과 입금
                            </h2>
                          </div>
                          <Card className="mb-4 border-0 bg-white ring-[#dfe6dd]">
                            <CardContent>
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_minmax(200px,1fr)_160px]">
                                <Field>
                                  <FieldLabel htmlFor="subscription-list-search">
                                    농가·사업 검색
                                  </FieldLabel>
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#87928a]" />
                                    <Input
                                      id="subscription-list-search"
                                      value={subscriptionListSearch}
                                      onChange={(event) => {
                                        setSubscriptionListSearch(
                                          event.target.value,
                                        );
                                        setSubscriptionListPage(1);
                                      }}
                                      placeholder="농가명, 농장번호, 사업명"
                                      className="pl-9"
                                    />
                                  </div>
                                </Field>
                                <ProjectTypeSelector
                                  id="subscription-management-type"
                                  value={subscriptionListProjectType}
                                  onChange={(type) => {
                                    setSubscriptionListProjectType(type);
                                    setSubscriptionFocus(null);
                                    setSubscriptionListProjectId('all');
                                    setSubscriptionListPage(1);
                                  }}
                                />
                                <Field>
                                  <FieldLabel>개별 사업</FieldLabel>
                                  <Select
                                    value={subscriptionListProjectId}
                                    onValueChange={(value) => {
                                      if (!value) return;
                                      setSubscriptionListProjectId(value);
                                      setSubscriptionFocus(null);
                                      setSubscriptionListPage(1);
                                    }}
                                  >
                                    <SelectTrigger className="h-10 w-full">
                                      <SelectValue>
                                        {subscriptionListProjectId === 'all'
                                          ? '전체 사업'
                                          : projectSelectLabel(
                                              subscriptionListProjectId,
                                              true,
                                            )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">
                                        전체 사업
                                      </SelectItem>
                                      {subscriptionListProjects.map(
                                        (project) => (
                                          <SelectItem
                                            key={project.id}
                                            value={project.id}
                                          >
                                            {project.year} · {project.name}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field>
                                  <FieldLabel>구독 상태</FieldLabel>
                                  <Select
                                    value={subscriptionListStatus}
                                    onValueChange={(value) => {
                                      if (!value) return;
                                      setSubscriptionListStatus(
                                        value as typeof subscriptionListStatus,
                                      );
                                      setSubscriptionListPage(1);
                                    }}
                                  >
                                    <SelectTrigger className="h-10 w-full">
                                      <SelectValue>
                                        {subscriptionListStatus === 'all'
                                          ? '전체 상태'
                                          : SUBSCRIPTION_STATUS_LABELS[
                                              subscriptionListStatus
                                            ]}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">
                                        전체 상태
                                      </SelectItem>
                                      <SelectItem value="active">
                                        사용중
                                      </SelectItem>
                                      <SelectItem value="expired">
                                        만료
                                      </SelectItem>
                                      <SelectItem value="unregistered">
                                        미등록
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </div>
                              <p className="mt-3 text-xs text-[#78847c]">
                                조건에 맞는 구독{' '}
                                {subscriptionListRecords.length}
                                건 · 한 페이지 {SUBSCRIPTION_PAGE_SIZE}건
                              </p>
                            </CardContent>
                          </Card>
                          <SubscriptionCyclePanel
                            counts={subscriptionCycleCounts}
                          />
                          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">사용중</p>
                                <p className="mt-1 text-2xl font-bold text-[#2f7b59]">
                                  {subscriptionActiveCount}곳
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">
                                  만료·미등록
                                </p>
                                <p className="mt-1 text-2xl font-bold text-[#b46438]">
                                  {subscriptionScopedRecords.length -
                                    subscriptionActiveCount}
                                  곳
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#eadfca]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">
                                  90일 이내 만료
                                </p>
                                <p className="mt-1 text-2xl font-bold text-[#94601c]">
                                  {subscriptionExpiringSoon.length}곳
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">
                                  입금 기록 합계
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {formatMoney(subscriptionPaymentTotal)}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <p className="text-xs text-[#7a867d]">
                                  입금 농가당 평균
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {formatMoney(subscriptionAveragePayment)}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                          <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#eadfca] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#80663f]">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" />
                            <p>
                              입금 합계는 입금 업무의 히스토리를 기준으로
                              합니다. 갱신·이탈·재가입은 구독 처리 등록을
                              사용하면 실적과 현재 구독 상태가 함께 반영됩니다.
                            </p>
                          </div>
                          <div className="grid gap-4 2xl:grid-cols-[1fr_290px]">
                            <div className="min-w-0 space-y-3">
                              <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                                <Table
                                  key={`${subscriptionListProjectType}:${subscriptionListProjectId}:${subscriptionListStatus}:${subscriptionListSearch}:${effectiveSubscriptionListPage}`}
                                  containerClassName="overflow-x-auto"
                                >
                                  <TableHeader className="sticky top-0 z-10 bg-[#f7f9f6]">
                                    <TableRow className="bg-[#f7f9f6]">
                                      <TableHead className="pl-5">
                                        농가
                                      </TableHead>
                                      <TableHead>사업</TableHead>
                                      <TableHead>구독 만료일</TableHead>
                                      <TableHead>마지막 입금일</TableHead>
                                      <TableHead>구독 회차·입금 근거</TableHead>
                                      <TableHead>상태</TableHead>
                                      <TableHead className="pr-5">
                                        처리
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {subscriptionPageRecords.map((record) => {
                                      const farm = farmById.get(record.farmId);
                                      const project = projectById.get(
                                        record.projectId,
                                      );
                                      const effectiveStatus =
                                        effectiveRecordSubscriptionStatus(
                                          record,
                                          subscriptionToday,
                                        );
                                      const expiryDays = daysUntil(
                                        record.currentSubscriptionExpiresAt,
                                      );
                                      const payment = recordedPayments.get(
                                        record.id,
                                      );
                                      const cycle = subscriptionCycle(
                                        record,
                                        payment?.count ?? 0,
                                      );
                                      return (
                                        <TableRow key={record.id}>
                                          <TableCell className="pl-5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openFarm(
                                                  record.farmId,
                                                  '',
                                                  record.projectId,
                                                )
                                              }
                                              className="font-semibold hover:text-[#2f7b59]"
                                            >
                                              {farm?.name ?? '농가 없음'}
                                            </button>
                                          </TableCell>
                                          <TableCell className="max-w-[240px] truncate">
                                            {project?.name ?? '사업 없음'}
                                          </TableCell>
                                          <TableCell>
                                            <p>
                                              {formatDate(
                                                record.currentSubscriptionExpiresAt,
                                              )}
                                            </p>
                                            {expiryDays !== null &&
                                              expiryDays >= 0 &&
                                              expiryDays <= 90 && (
                                                <Badge
                                                  variant="outline"
                                                  className="mt-1 border-[#ead9b8] bg-[#fff9ed] text-[#94601c]"
                                                >
                                                  {dueLabel(
                                                    record.currentSubscriptionExpiresAt,
                                                  )}
                                                </Badge>
                                              )}
                                          </TableCell>
                                          <TableCell>
                                            {payment
                                              ? formatDate(
                                                  localDateString(
                                                    new Date(
                                                      payment.latestPaidAt,
                                                    ),
                                                  ),
                                                )
                                              : subscriptionPaymentCount(
                                                    record,
                                                    0,
                                                  ) > 0
                                                ? '최근 입금 이력 확인 중'
                                                : '갱신 이력 없음'}
                                          </TableCell>
                                          <TableCell>
                                            <p className="whitespace-nowrap font-semibold">
                                              {
                                                {
                                                  noPayment: '갱신 이력 없음',
                                                  first: '1차 갱신',
                                                  second: '2차 갱신',
                                                  thirdPlus: `${subscriptionPaymentCount(record, payment?.count ?? 0)}차 갱신`,
                                                }[cycle]
                                              }
                                            </p>
                                            {payment ? (
                                              <button
                                                type="button"
                                                className="mt-1 whitespace-nowrap text-xs text-[#2f7b59] underline underline-offset-2"
                                                onClick={() =>
                                                  openFarm(
                                                    record.farmId,
                                                    payment.latestWorkItemId,
                                                  )
                                                }
                                              >
                                                최근 입금{' '}
                                                {formatDate(
                                                  localDateString(
                                                    new Date(
                                                      payment.latestPaidAt,
                                                    ),
                                                  ),
                                                )}{' '}
                                                ·{' '}
                                                {formatMoney(
                                                  payment.latestPaymentAmount,
                                                )}
                                              </button>
                                            ) : (
                                              <p className="mt-1 text-xs text-[#947047]">
                                                {record.subscriptionPaymentCount
                                                  ? `입금 ${record.subscriptionPaymentCount}건 확인 · 상세 이력 불러오는 중`
                                                  : '연결된 입금 업무 이력 없음'}
                                              </p>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Badge
                                              variant="outline"
                                              className={subscriptionClass(
                                                effectiveStatus,
                                              )}
                                            >
                                              {
                                                SUBSCRIPTION_STATUS_LABELS[
                                                  effectiveStatus
                                                ]
                                              }
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="pr-5">
                                            <div className="flex min-w-[285px] gap-2">
                                              <Button
                                                onClick={() =>
                                                  openSubscriptionExpiryDialog(
                                                    record,
                                                  )
                                                }
                                                size="sm"
                                                variant="outline"
                                              >
                                                <CalendarClock />
                                                만료일
                                              </Button>
                                              <Button
                                                onClick={() =>
                                                  openSubscriptionEventDialog(
                                                    record,
                                                  )
                                                }
                                                size="sm"
                                                variant="outline"
                                              >
                                                <CalendarCheck2 />
                                                구독 처리
                                              </Button>
                                              <Button
                                                onClick={() =>
                                                  openQuickWorkItem(
                                                    record,
                                                    'payment',
                                                    '구독료 입금',
                                                  )
                                                }
                                                size="sm"
                                                variant="outline"
                                              >
                                                <Plus />
                                                입금
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    {!subscriptionPageRecords.length && (
                                      <TableRow>
                                        <TableCell
                                          colSpan={7}
                                          className="h-40 text-center text-[#89938c]"
                                        >
                                          검색 조건에 맞는 구독이 없습니다.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe6dd] bg-white px-4 py-3">
                                <p className="text-xs text-[#78847c]">
                                  {subscriptionListRecords.length
                                    ? `${(effectiveSubscriptionListPage - 1) * SUBSCRIPTION_PAGE_SIZE + 1}–${Math.min(effectiveSubscriptionListPage * SUBSCRIPTION_PAGE_SIZE, subscriptionListRecords.length)}`
                                    : '0'}{' '}
                                  / {subscriptionListRecords.length}건
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      effectiveSubscriptionListPage <= 1
                                    }
                                    onClick={() =>
                                      setSubscriptionListPage(
                                        effectiveSubscriptionListPage - 1,
                                      )
                                    }
                                  >
                                    <ArrowLeft />
                                    이전
                                  </Button>
                                  <span className="min-w-16 text-center text-xs font-semibold">
                                    {effectiveSubscriptionListPage} /{' '}
                                    {subscriptionPageCount}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      effectiveSubscriptionListPage >=
                                      subscriptionPageCount
                                    }
                                    onClick={() =>
                                      setSubscriptionListPage(
                                        effectiveSubscriptionListPage + 1,
                                      )
                                    }
                                  >
                                    다음
                                    <ArrowRight />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <Card className="h-fit border-0 bg-white ring-[#dfe6dd]">
                              <CardContent>
                                <div className="mb-4">
                                  <h2 className="font-bold">최근 월별 입금</h2>
                                  <p className="mt-1 text-xs text-[#89938c]">
                                    입금 업무 히스토리 기준
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {subscriptionMonthlyPayments.map((month) => (
                                    <div
                                      key={month.label}
                                      className="rounded-xl bg-[#f5f8f4] p-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold">
                                          {month.label}
                                        </span>
                                        <Badge variant="outline">
                                          {month.count}건
                                        </Badge>
                                      </div>
                                      <p className="mt-2 font-bold text-[#39795b]">
                                        {formatMoney(month.amount)}
                                      </p>
                                    </div>
                                  ))}
                                  {!subscriptionMonthlyPayments.length && (
                                    <p className="py-8 text-center text-sm text-[#89938c]">
                                      입금 기록이 없습니다.
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </section>
                  )}

                  {view === 'service' && (
                    <section>
                      <div className="mb-6">
                        <p className="text-sm font-medium text-[#647568]">
                          농가 장애 대응
                        </p>
                        <h1 className="mt-1 text-[28px] font-bold">
                          A/S 업무 관리
                        </h1>
                        <p className="mt-2 text-sm text-[#77847b]">
                          A/S 업무의 현재 상태와 마지막 수신·처리 결과를
                          확인합니다.
                        </p>
                      </div>
                      {serviceWorkItems.length ? (
                        <div className="grid gap-4 xl:grid-cols-2">
                          {[...serviceWorkItems]
                            .sort((a, b) =>
                              compareServiceWorkItems(a, b, riskNow),
                            )
                            .map((item) => {
                              const farm = farmById.get(item.farmId);
                              const project = projectForWorkItem(item);
                              const received = latestEntryWith(
                                item,
                                'receivedContent',
                              );
                              const action = latestEntryWith(
                                item,
                                'actionContent',
                              );
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => openFarm(item.farmId, item.id)}
                                  className="rounded-2xl border border-[#dfe6dd] bg-white p-5 text-left shadow-sm hover:bg-[#fafcf9]"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge
                                          variant="outline"
                                          className={workStatusClass(
                                            item.status,
                                          )}
                                        >
                                          {FARM_LOG_STATUS_LABELS[item.status]}
                                        </Badge>
                                        <span className="text-xs text-[#89938c]">
                                          {formatTimestamp(item.lastActivityAt)}
                                        </span>
                                      </div>
                                      <h2 className="mt-3 font-bold">
                                        {item.title}
                                      </h2>
                                      <p className="mt-1 text-sm text-[#69766e]">
                                        {farm?.name ?? '농가 없음'} ·{' '}
                                        {project?.name ?? '사업 없음'}
                                      </p>
                                    </div>
                                    <div className="grid size-10 place-items-center rounded-xl bg-[#fff1e8] text-[#b46438]">
                                      <Wrench className="size-5" />
                                    </div>
                                  </div>
                                  <div className="mt-4 rounded-xl bg-[#f6f8f6] p-3">
                                    <p className="text-[11px] font-semibold text-[#7a867d]">
                                      마지막 받은 내용
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm leading-6">
                                      {received?.receivedContent ||
                                        '받은 내용이 없습니다.'}
                                    </p>
                                  </div>
                                  <div className="mt-3 rounded-xl bg-[#eef6f0] p-3">
                                    <p className="text-[11px] font-semibold text-[#477356]">
                                      마지막 처리 내용
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm leading-6">
                                      {action?.actionContent ||
                                        '처리 내용이 없습니다.'}
                                    </p>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between text-xs text-[#89938c]">
                                    <span>담당 {item.owner || '미지정'}</span>
                                    <ArrowRight className="size-4" />
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-[#dfe6dd] bg-white py-16 text-center">
                          <Wrench className="mx-auto size-8 text-[#9aa49d]" />
                          <p className="mt-3 font-semibold">
                            등록된 A/S 업무가 없습니다.
                          </p>
                        </div>
                      )}
                    </section>
                  )}

                  {view === 'organization' && (
                    <OrganizationManagement
                      current={member}
                      members={organization.members}
                      departments={organization.departments}
                      error={organization.error}
                    />
                  )}
                  {view === 'quality' && (
                    <section>
                      <div className="mb-6">
                        <p className="text-sm font-medium text-[#647568]">
                          이관·운영 전 확인
                        </p>
                        <h1 className="mt-1 text-[28px] font-bold">
                          데이터 점검
                        </h1>
                        <p className="mt-2 text-sm text-[#77847b]">
                          중복 농가, 주소·설치일·구독 기준 누락을 자동으로 모아
                          보여줍니다.
                        </p>
                      </div>
                      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          {
                            label: '전체 확인 항목',
                            value: visibleQualityIssues.length,
                            tone: 'text-[#203027]',
                            icon: FileWarning,
                          },
                          {
                            label: '중복 가능성',
                            value: visibleQualityIssues.filter(
                              (issue) => issue.category === 'duplicate',
                            ).length,
                            tone: 'text-[#aa4e30]',
                            icon: CircleAlert,
                          },
                          {
                            label: '기본·설치 누락',
                            value: visibleQualityIssues.filter(
                              (issue) =>
                                issue.category === 'contact' ||
                                issue.category === 'installation',
                            ).length,
                            tone: 'text-[#94601c]',
                            icon: ClipboardList,
                          },
                          {
                            label: '구독 기준 누락',
                            value: visibleQualityIssues.filter(
                              (issue) => issue.category === 'subscription',
                            ).length,
                            tone: 'text-[#416c9c]',
                            icon: CreditCard,
                          },
                        ].map((metric) => (
                          <Card
                            key={metric.label}
                            className="border-0 bg-white ring-[#dfe6dd]"
                          >
                            <CardContent className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#7a867d]">
                                  {metric.label}
                                </p>
                                <p
                                  className={`mt-1 text-2xl font-bold ${metric.tone}`}
                                >
                                  {metric.value}건
                                </p>
                              </div>
                              <div className="grid size-10 place-items-center rounded-xl bg-[#f3f6f2] text-[#66806d]">
                                <metric.icon className="size-5" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {qualityFocus && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#bfd9cc] bg-[#eaf5ef] px-4 py-2">
                          <p className="text-sm">
                            <strong>{qualityFocus.label}</strong> · 통합
                            현황에서 선택한 점검 대상
                          </p>
                          <Button
                            variant="ghost"
                            onClick={() => setQualityFocus(null)}
                          >
                            범위 해제
                          </Button>
                        </div>
                      )}
                      {visibleQualityIssues.length ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {visibleQualityIssues.map((issue) => {
                            const farm = farmById.get(issue.farmId);
                            const categoryLabel =
                              issue.category === 'duplicate'
                                ? '중복'
                                : issue.category === 'contact'
                                  ? '기본정보'
                                  : issue.category === 'installation'
                                    ? '설치정보'
                                    : '구독정보';
                            return (
                              <button
                                key={issue.id}
                                type="button"
                                onClick={() =>
                                  openFarm(
                                    issue.farmId,
                                    '',
                                    issue.projectId || undefined,
                                  )
                                }
                                className="flex items-start gap-4 rounded-2xl border border-[#dfe6dd] bg-white p-4 text-left shadow-sm hover:border-[#bdd8c5]"
                              >
                                <div
                                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${issue.severity === 'high' ? 'bg-[#fff1ed] text-[#aa4e30]' : 'bg-[#fff9ed] text-[#94601c]'}`}
                                >
                                  <FileWarning className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      {categoryLabel}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={
                                        issue.severity === 'high'
                                          ? 'border-[#efc4b7] bg-[#fff1ed] text-[#aa4e30]'
                                          : 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]'
                                      }
                                    >
                                      {issue.severity === 'high'
                                        ? '우선 확인'
                                        : '확인 필요'}
                                    </Badge>
                                  </div>
                                  <h2 className="mt-2 font-bold">
                                    {issue.title}
                                  </h2>
                                  <p className="mt-1 text-sm leading-6 text-[#69766e]">
                                    {issue.description}
                                  </p>
                                  <p className="mt-2 text-xs font-semibold text-[#39795b]">
                                    {farm?.name ?? '농가'} 상세에서 수정{' '}
                                    <ArrowRight className="ml-1 inline size-3.5" />
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-[#cfe0d1] bg-white py-16 text-center">
                          <ShieldCheck className="mx-auto size-10 text-[#4f986c]" />
                          <p className="mt-4 font-bold">
                            현재 확인할 데이터 문제가 없습니다.
                          </p>
                          <p className="mt-1 text-sm text-[#89938c]">
                            농가와 사업 참여 정보가 추가되면 자동으로 다시
                            점검합니다.
                          </p>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>

            <div
              data-active-content={
                selectedProject || selectedFarm || selectedWorkItem
                  ? 'true'
                  : 'false'
              }
              className={
                selectedProject || selectedFarm || selectedWorkItem
                  ? 'page-content'
                  : 'hidden'
              }
            >
              {selectedWorkItem &&
                !selectedWorkItem.deletedAt &&
                isStandaloneWork(selectedWorkItem) && (
                  <ProjectTaskDetail
                    deleteAction={workDeleteAction(selectedWorkItem)}
                    task={selectedWorkItem}
                    project={projectForWorkItem(selectedWorkItem) || undefined}
                    departmentName={
                      organization.departments.find(
                        (dept) => dept.id === selectedWorkItem.departmentId,
                      )?.name
                    }
                    history={selectedWorkHistory}
                    onBack={backDetail}
                    onRecord={() => openHistoryDialog(selectedWorkItem)}
                    parentTask={workItemById.get(
                      selectedWorkItem.parentWorkItemId || '',
                    )}
                    onParent={() => {
                      const parent = workItemById.get(
                        selectedWorkItem.parentWorkItemId || '',
                      );
                      if (parent) openFarm(parent.farmId, parent.id);
                    }}
                    onAddChild={() => addChildTask(selectedWorkItem)}
                    childrenContent={
                      workHierarchy.children.get(selectedWorkItem.id)
                        ?.length ? (
                        <section className="space-y-3 rounded-xl border bg-white p-4">
                          <h2 className="text-lg font-bold">
                            세부 업무 ·{' '}
                            {
                              workHierarchy.progress(selectedWorkItem.id)
                                .completed
                            }
                            /{workHierarchy.progress(selectedWorkItem.id).total}{' '}
                            실행 업무 완료
                          </h2>
                          <WorkTaskSurface
                            deleteAction={workDeleteAction}
                            onEditingChange={setWorkQuickEditOpen}
                            farmLabel={(item) =>
                              farmById.get(item.farmId)?.name || ''
                            }
                            latestSummary={(item) => ({
                              action:
                                latestEntryWith(item, 'actionContent')
                                  ?.actionContent || '',
                              received:
                                latestEntryWith(item, 'receivedContent')
                                  ?.receivedContent || '',
                            })}
                            items={workHierarchy.descendants(
                              selectedWorkItem.id,
                            )}
                            allItems={workHierarchy.descendants(
                              selectedWorkItem.id,
                            )}
                            recorder={accountName || accountEmail}
                            projectLabel={workContextLabel}
                            onOpen={(item) => openFarm(item.farmId, item.id)}
                            onAddChild={addChildTask}
                            onSave={saveQuickWork}
                            isClosed={(item) =>
                              projectForWorkItem(item)?.status === 'completed'
                            }
                          />
                        </section>
                      ) : null
                    }
                  />
                )}
              {selectedProject && selectedProjectSnapshot && (
                <section aria-label="프로젝트 전체 상세" className="w-full">
                  <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={backDetail}
                      className="-ml-2 min-h-11 rounded-xl text-[#315f43]"
                    >
                      <ArrowLeft />
                      {detailTrail.length
                        ? '이전 상세로'
                        : `${navItems.find((item) => item.id === view)?.label}으로`}
                    </Button>
                    <span className="text-xs font-semibold text-[#7d8981]">
                      {selectedProject.year}년 ·{' '}
                      {FARM_PROJECT_TYPE_LABELS[selectedProject.projectType]} /{' '}
                      {selectedProject.name}
                    </span>
                  </div>
                  <div className="mb-4 flex w-full flex-col gap-1 rounded-xl border border-[#d8e0e7] bg-white p-5">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedProject.year}</Badge>
                      <Badge variant="outline">
                        {FARM_PROJECT_TYPE_LABELS[selectedProject.projectType]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]"
                      >
                        {
                          FARM_PROJECT_STAGE_LABELS[
                            selectedProject.currentStage
                          ]
                        }
                      </Badge>
                      <Badge variant="outline">
                        {FARM_PROJECT_STATUS_LABELS[selectedProject.status]}
                      </Badge>
                    </div>
                    <h1 className="cn-font-heading text-left text-xl font-medium text-foreground">
                      {selectedProject.name}
                    </h1>
                    <p className="text-left text-sm text-muted-foreground">
                      {selectedProject.institution} · 담당{' '}
                      {selectedProject.manager || '미지정'} ·{' '}
                      {selectedProject.startDate || '시작일 미입력'} ~{' '}
                      {selectedProject.endDate || '종료일 미입력'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(selectedProject.deletedAt)}
                        onClick={() => openProjectUpdateDialog(selectedProject)}
                      >
                        <MessageSquareText /> 프로젝트 기록 추가
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(selectedProject.deletedAt)}
                        onClick={() => openProjectEditDialog(selectedProject)}
                      >
                        <Pencil /> 사업·정산 수정
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          openProjectDocumentDialog(selectedProject)
                        }
                        disabled={
                          selectedProject.status === 'completed' ||
                          Boolean(selectedProject.deletedAt)
                        }
                        className="bg-[#2f7b59] hover:bg-[#286b4d]"
                      >
                        <Plus /> 제출서류 추가
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700"
                        onClick={() =>
                          setProjectDeletionTarget(selectedProject)
                        }
                      >
                        <Trash2 />
                        {selectedProject.deletedAt
                          ? '프로젝트 복구'
                          : '프로젝트 삭제'}
                      </Button>
                    </div>
                    {selectedProject.deletedAt && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        삭제된 프로젝트입니다. 목록·사업 집계에서는 제외되며,
                        연결된 기록은 보존됩니다.
                      </p>
                    )}
                  </div>

                  <Tabs
                    value={projectDetailTab}
                    onValueChange={(value) =>
                      setProjectDetailTab(String(value))
                    }
                    className="w-full gap-4"
                  >
                    <TabsList
                      className="detail-tabs"
                      aria-label="프로젝트 상세 항목"
                    >
                      <TabsTrigger value="summary">진행 요약</TabsTrigger>
                      <TabsTrigger value="farms">
                        농가·구독 {selectedProjectSnapshot.records.length}
                      </TabsTrigger>
                      <TabsTrigger value="work">
                        하위 업무 {selectedProjectSnapshot.workItems.length}
                      </TabsTrigger>
                      <TabsTrigger value="documents">
                        제출서류 {selectedProjectSnapshot.documents.length}
                      </TabsTrigger>
                      <TabsTrigger value="settlement">정산</TabsTrigger>
                      <TabsTrigger value="history">처리 이력</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="space-y-4">
                      <ProjectFarmProgressCard
                        key={selectedProject.id}
                        progress={selectedProjectSnapshot.farmProgress}
                        farmName={(farmId) =>
                          farmById.get(farmId)?.name || '농가 정보 없음'
                        }
                      />
                      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: '프로젝트 진행률',
                            value: `${selectedProjectSnapshot.overallProgress}%`,
                            note:
                              selectedProject.status === 'completed'
                                ? '완료 확정 사업 · 100%'
                                : `현재 ${FARM_PROJECT_STAGE_LABELS[selectedProject.currentStage]} · 단계별 증빙 평균`,
                            icon: TrendingUp,
                          },
                          {
                            label: '참여 농가',
                            value: `${selectedProjectSnapshot.records.length}/${selectedProject.targetFarmCount || '-'}곳`,
                            note:
                              selectedProjectSnapshot.farmCoverage === null
                                ? '목표 농가 수를 입력해 주세요'
                                : `목표 대비 ${selectedProjectSnapshot.farmCoverage}%`,
                            icon: Warehouse,
                          },
                          {
                            label: '현재 막힘',
                            value: `${selectedProjectSnapshot.openProjectBlockers.length + selectedProjectSnapshot.blockedItems.length + selectedProjectSnapshot.documentRisks.length}건`,
                            note: selectedProjectSnapshot.openProjectBlockers
                              .length
                              ? `프로젝트 막힘 ${selectedProjectSnapshot.openProjectBlockers.length}건`
                              : selectedProjectSnapshot.blockedItems.length
                                ? `농가 업무 막힘 ${selectedProjectSnapshot.blockedItems.length}건`
                                : selectedProjectSnapshot.documentRisks.length
                                  ? `서류 위험 ${selectedProjectSnapshot.documentRisks.length}건`
                                  : '현재 막힌 항목 없음',
                            icon: CircleAlert,
                          },
                          {
                            label: '유효 구독률',
                            value:
                              selectedProjectSnapshot.subscriptionRate === null
                                ? '-'
                                : `${selectedProjectSnapshot.subscriptionRate}%`,
                            note: `90일 내 만료 ${selectedProjectSnapshot.expiringSoon.length}곳 · 만료 ${selectedProjectSnapshot.expiredSubscriptions.length}곳`,
                            icon: CalendarClock,
                          },
                          {
                            label: '필수 제출서류',
                            value: `${selectedProjectSnapshot.submittedDocuments.length}/${selectedProjectSnapshot.requiredDocuments.length}건`,
                            note: `승인 ${selectedProjectSnapshot.approvedDocuments.length}건 · 위험 ${selectedProjectSnapshot.documentRisks.length}건`,
                            icon: FileText,
                          },
                          {
                            label: '정산',
                            value: projectSettlementLabel(selectedProject),
                            note: selectedProject.settlementDueDate
                              ? `${selectedProject.settlementDueDate} · ${dueLabel(selectedProject.settlementDueDate, ['paid', 'closed'].includes(selectedProject.settlementStatus))}`
                              : '정산기한 미입력',
                            icon: CreditCard,
                          },
                        ].map((item) => (
                          <Card key={item.label} className="border-0 bg-white">
                            <CardContent className="px-4 py-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs text-[#7f8a82]">
                                    {item.label}
                                  </p>
                                  <p className="mt-1 text-xl font-bold">
                                    {item.value}
                                  </p>
                                  <p className="mt-1 text-xs text-[#768179]">
                                    {item.note}
                                  </p>
                                </div>
                                <div className="grid size-9 place-items-center rounded-xl bg-[#edf5ec] text-[#4b8057]">
                                  <item.icon className="size-4" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </section>

                      <Collapsible className="rounded-xl border border-[#d8e0e7] bg-white px-5 py-2">
                        <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between text-left font-semibold">
                          설치·시운전·교육 및 단계별 지표{' '}
                          <ChevronDown className="size-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pb-4">
                          <section className="bg-white py-3">
                            <div className="mb-4">
                              <h3 className="font-bold">설치·운영 완료율</h3>
                              <p className="mt-1 text-xs text-[#7d8981]">
                                완료일 또는 별도 완료 확인이 있는 농가와 현재
                                유효한 구독을 기준으로 계산합니다.
                              </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              {[
                                {
                                  label: '설치',
                                  complete:
                                    selectedProjectSnapshot.records.filter(
                                      (record) =>
                                        isFarmStageComplete(
                                          record,
                                          'installationDate',
                                        ),
                                    ).length,
                                  rate: selectedProjectSnapshot.installationRate,
                                  note: '설치일 또는 완료 확인 기준',
                                  icon: CalendarCheck2,
                                },
                                {
                                  label: '시운전',
                                  complete:
                                    selectedProjectSnapshot.records.filter(
                                      (record) =>
                                        isFarmStageComplete(
                                          record,
                                          'commissioningDate',
                                        ),
                                    ).length,
                                  rate: selectedProjectSnapshot.commissioningRate,
                                  note: '시운전일 또는 완료 확인 기준',
                                  icon: Wrench,
                                },
                                {
                                  label: '교육',
                                  complete:
                                    selectedProjectSnapshot.records.filter(
                                      (record) =>
                                        isFarmStageComplete(
                                          record,
                                          'educationDate',
                                        ),
                                    ).length,
                                  rate: selectedProjectSnapshot.educationRate,
                                  note: '교육일 또는 완료 확인 기준',
                                  icon: TrendingUp,
                                },
                                {
                                  label: '유효 구독',
                                  complete:
                                    selectedProjectSnapshot.activeSubscriptions
                                      .length,
                                  rate: selectedProjectSnapshot.subscriptionRate,
                                  note: `90일 내 만료 ${selectedProjectSnapshot.expiringSoon.length}곳`,
                                  icon: CalendarClock,
                                },
                              ].map((metric) => (
                                <div
                                  key={metric.label}
                                  className="rounded-xl border border-[#e2e8e1] p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-semibold text-[#657269]">
                                        {metric.label}
                                      </p>
                                      <p className="mt-1 text-2xl font-bold text-[#315f43]">
                                        {metric.rate === null
                                          ? '-'
                                          : `${metric.rate}%`}
                                      </p>
                                    </div>
                                    <div className="grid size-9 place-items-center rounded-xl bg-[#edf5ec] text-[#4b8057]">
                                      <metric.icon className="size-4" />
                                    </div>
                                  </div>
                                  <p className="mt-2 text-xs text-[#768179]">
                                    {metric.complete}/
                                    {selectedProjectSnapshot.records.length}곳 ·{' '}
                                    {metric.note}
                                  </p>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1ec]">
                                    <div
                                      className="h-full rounded-full bg-[#62b982]"
                                      style={{ width: `${metric.rate ?? 0}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <h3 className="font-bold">사업 진행 단계</h3>
                                <p className="mt-1 text-xs text-[#7d8981]">
                                  저장된 날짜·농가·서류·정산을 근거로
                                  계산합니다.
                                </p>
                              </div>
                              <span className="text-xs text-[#89938c]">
                                최근 활동{' '}
                                {formatTimestamp(
                                  selectedProjectSnapshot.latestActivityAt,
                                )}
                              </span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              {selectedProjectStageCards.map((stage) => (
                                <div
                                  key={stage.label}
                                  className="rounded-xl border border-[#e2e8e1] p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold">
                                      {stage.label}
                                    </p>
                                    <span className="text-sm font-bold text-[#347454]">
                                      {stage.progress === null
                                        ? '미설정'
                                        : `${stage.progress}%`}
                                    </span>
                                  </div>
                                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1ec]">
                                    <div
                                      className="h-full rounded-full bg-[#62b982]"
                                      style={{
                                        width: `${stage.progress ?? 0}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="mt-2 text-[11px] leading-5 text-[#7d8981]">
                                    {stage.evidence}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </CollapsibleContent>
                      </Collapsible>
                      <section className="rounded-xl border border-[#d8e0e7] bg-white p-5">
                        <h3 className="font-bold">확인이 필요한 항목</h3>
                        <p className="mt-1 text-xs text-[#7d8981]">
                          프로젝트 직접 막힘, 농가 업무와 기한초과·보완·반려
                          서류를 함께 봅니다.
                        </p>
                        {selectedProjectSnapshot.openProjectBlockers.length ||
                        selectedProjectSnapshot.blockedItems.length ||
                        selectedProjectSnapshot.documentRisks.length ? (
                          <div className="mt-4 space-y-2">
                            {selectedProjectSnapshot.openProjectBlockers.map(
                              (update) => (
                                <div
                                  key={update.id}
                                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#efc8bb] bg-[#fff1ec] p-3 sm:flex-row sm:items-start"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      프로젝트 · {update.title}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[#8b5e45]">
                                      {update.blockedReason} · 해결 주체{' '}
                                      {update.blockedBy}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#94715d]">
                                      막힌 지 {elapsedDays(update.occurredAt)}
                                      일 · 예상 해제{' '}
                                      {update.expectedUnblockDate || '미정'}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openProjectBlockerResolveDialog(update)
                                    }
                                  >
                                    <Check /> 해결 처리
                                  </Button>
                                </div>
                              ),
                            )}
                            {selectedProjectSnapshot.blockedItems.map(
                              (item) => {
                                const farm = farmById.get(item.farmId);
                                return (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() =>
                                      openFarm(item.farmId, item.id)
                                    }
                                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#efd8c8] bg-[#fff8f3] p-3 text-left hover:bg-[#fff3eb]"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold">
                                        {farm?.name ?? '농가'} · {item.title}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-[#8b5e45]">
                                        {item.blockedReason ||
                                          '막힘 사유 미입력'}{' '}
                                        · 해결 주체 {item.blockedBy || '미입력'}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[#94715d]">
                                        막힌 지 {elapsedDays(item.blockedAt)}
                                        일 · 예상 해제{' '}
                                        {item.expectedUnblockDate || '미정'}
                                      </p>
                                    </div>
                                    <ArrowRight className="mt-1 size-4 shrink-0" />
                                  </button>
                                );
                              },
                            )}
                            {selectedProjectSnapshot.documentRisks.map(
                              (document) => (
                                <button
                                  type="button"
                                  key={document.id}
                                  onClick={() =>
                                    openProjectDocumentDialog(
                                      selectedProject,
                                      document,
                                    )
                                  }
                                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#ead9b8] bg-[#fffaf0] p-3 text-left hover:bg-[#fff6e4]"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      제출서류 · {document.title}
                                    </p>
                                    <p className="mt-1 text-xs text-[#8b6d36]">
                                      {
                                        FARM_PROJECT_DOCUMENT_STATUS_LABELS[
                                          document.status
                                        ]
                                      }{' '}
                                      · 현재 처리자 {document.currentHandler}
                                      {document.dueDate
                                        ? ` · ${dueLabel(document.dueDate)}`
                                        : ''}
                                    </p>
                                  </div>
                                  <Pencil className="mt-1 size-4 shrink-0" />
                                </button>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#cfe0d1] bg-[#f2f8f2] p-4 text-sm text-[#36714d]">
                            <CheckCircle2 className="size-5" /> 현재 막힌 항목이
                            없습니다.
                          </div>
                        )}
                      </section>
                    </TabsContent>
                    <TabsContent value="farms">
                      <section className="rounded-xl border border-[#d8e0e7] bg-white p-5">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <h3 className="font-bold">참여 농가·구독</h3>
                            <p className="mt-1 text-xs text-[#7d8981]">
                              농가별 설치 단계와 실제 만료일 기준 구독
                              상태입니다.
                            </p>
                            <Button
                              variant="outline"
                              className="mt-3"
                              onClick={() => {
                                if (!changeView('subscriptions')) return;
                                setSubscriptionMode('management');
                                setSubscriptionListProjectType(
                                  selectedProject.projectType,
                                );
                                setSubscriptionListProjectId(
                                  selectedProject.id,
                                );
                                setSubscriptionListStatus('all');
                                setSubscriptionListSearch('');
                                setSubscriptionListPage(1);
                              }}
                            >
                              <CreditCard />이 사업의 구독·입금 관리
                            </Button>
                          </div>
                          {selectedProjectSnapshot.missingSubscriptionExpiry
                            .length > 0 && (
                            <Badge
                              variant="outline"
                              className="border-[#ead9b8] bg-[#fff9ed] text-[#94601c]"
                            >
                              만료일 미입력{' '}
                              {
                                selectedProjectSnapshot
                                  .missingSubscriptionExpiry.length
                              }
                              곳
                            </Badge>
                          )}
                        </div>
                        <div className="mt-4 overflow-x-auto rounded-xl border border-[#e3e8e2]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>농가</TableHead>
                                <TableHead>설치 단계</TableHead>
                                <TableHead>구독</TableHead>
                                <TableHead>만료일</TableHead>
                                <TableHead className="text-right">
                                  남은 기간
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedProjectSnapshot.records.map((record) => {
                                const farm = farmById.get(record.farmId);
                                const install = installProgress(record);
                                const days = daysUntil(
                                  record.currentSubscriptionExpiresAt,
                                );
                                return (
                                  <TableRow key={record.id}>
                                    <TableCell>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openFarm(
                                            record.farmId,
                                            '',
                                            record.projectId,
                                          )
                                        }
                                        className="text-left font-semibold text-[#274f39] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f9a70]"
                                      >
                                        {farm?.name ?? '농가 없음'}
                                      </button>
                                      <p className="mt-1 text-xs text-[#89938c]">
                                        {record.crop || '작물 미입력'} ·{' '}
                                        {record.productType || '제품 미입력'}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      {install.complete}/{install.total} 완료
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={subscriptionClass(
                                          days !== null && days < 0
                                            ? 'expired'
                                            : record.subscriptionStatus,
                                        )}
                                      >
                                        {days !== null && days < 0
                                          ? '만료'
                                          : SUBSCRIPTION_STATUS_LABELS[
                                              record.subscriptionStatus
                                            ]}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {record.currentSubscriptionExpiresAt ||
                                        '미입력'}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {days === null
                                        ? '-'
                                        : days < 0
                                          ? `${Math.abs(days)}일 지남`
                                          : `D-${days}`}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {!selectedProjectSnapshot.records.length && (
                                <TableRow>
                                  <TableCell
                                    colSpan={5}
                                    className="h-28 text-center text-[#89938c]"
                                  >
                                    이 사업에 연결된 농가가 없습니다.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </section>
                    </TabsContent>
                    <TabsContent
                      value="work"
                      className="rounded-xl border border-[#d8e0e7] bg-white p-5"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-bold">
                          {selectedProject.name} · 하위 업무
                        </h2>
                        <Button
                          disabled={selectedProject.status === 'completed'}
                          onClick={() => openInboxDialog(selectedProject.id)}
                        >
                          <Plus />
                          하위 업무 추가
                        </Button>
                      </div>
                      <p className="mb-3 text-sm text-slate-600">
                        견적서 제출·문의 피드백 등 프로젝트 실행 업무입니다.
                        농가 구독료 입금은 구독·입금에서 관리합니다.
                      </p>
                      <WorkTaskSurface
                        deleteAction={workDeleteAction}
                        onEditingChange={setWorkQuickEditOpen}
                        farmLabel={(item) =>
                          farmById.get(item.farmId)?.name || ''
                        }
                        latestSummary={(item) => ({
                          action:
                            latestEntryWith(item, 'actionContent')
                              ?.actionContent || '',
                          received:
                            latestEntryWith(item, 'receivedContent')
                              ?.receivedContent || '',
                        })}
                        mode="list"
                        items={selectedProjectSnapshot.workItems}
                        allItems={selectedProjectSnapshot.workItems}
                        recorder={accountName || accountEmail}
                        projectLabel={() => selectedProject.name}
                        onOpen={(item) => openFarm(item.farmId, item.id)}
                        onAddChild={addChildTask}
                        onSave={saveQuickWork}
                        isClosed={() => selectedProject.status === 'completed'}
                      />
                    </TabsContent>
                    <TabsContent value="documents">
                      <section>
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold">제출서류 대장</h3>
                              <p className="mt-1 text-xs text-[#7d8981]">
                                책임자와 현재 처리자를 분리해 관리합니다.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={selectedProject.status === 'completed'}
                              onClick={() =>
                                openProjectDocumentDialog(selectedProject)
                              }
                            >
                              <Plus /> 추가
                            </Button>
                          </div>
                          <div className="mt-4 space-y-2">
                            {selectedProjectSnapshot.documents.map(
                              (document) => (
                                <Collapsible
                                  key={document.id}
                                  className="rounded-xl border border-[#d8e0e7]"
                                >
                                  <CollapsibleTrigger
                                    className="w-full p-4 text-left hover:bg-[#f4f7f9]"
                                    aria-label={`${document.title} 서류 내용 보기`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-semibold">
                                            {document.title}
                                          </p>
                                          {document.isRequired && (
                                            <Badge variant="outline">
                                              필수
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs text-[#7d8981]">
                                          {
                                            FARM_PROJECT_DOCUMENT_CATEGORY_LABELS[
                                              document.category
                                            ]
                                          }{' '}
                                          · 책임 {document.owner} · 현재{' '}
                                          {document.currentHandler}
                                        </p>
                                      </div>
                                      <Badge variant="outline">
                                        {
                                          FARM_PROJECT_DOCUMENT_STATUS_LABELS[
                                            document.status
                                          ]
                                        }
                                      </Badge>
                                    </div>
                                    <p className="mt-2 text-[11px] text-[#8a958d]">
                                      기한 {document.dueDate || '미입력'} · 개정{' '}
                                      {document.revision}차
                                      <span className="ml-3 font-semibold text-[#176448]">
                                        내용 보기{' '}
                                        <ChevronDown className="inline size-4" />
                                      </span>
                                    </p>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="border-t border-[#d8e0e7] p-4">
                                    <p className="text-sm">
                                      제출 {document.submittedAt || '미등록'} ·
                                      승인 {document.approvedAt || '미등록'}
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                      {document.note ||
                                        '등록된 메모가 없습니다.'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {document.referenceUrl && (
                                        <Button
                                          variant="outline"
                                          render={
                                            <a
                                              href={document.referenceUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              aria-label={`${document.title} 서류 링크 열기`}
                                            />
                                          }
                                        >
                                          <ExternalLink />
                                          서류 링크 열기
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        disabled={
                                          selectedProject.status === 'completed'
                                        }
                                        onClick={() =>
                                          openProjectDocumentDialog(
                                            selectedProject,
                                            document,
                                          )
                                        }
                                      >
                                        <Pencil />
                                        서류 정보 수정
                                      </Button>
                                    </div>
                                    {selectedProject.status === 'completed' && (
                                      <p className="mt-2 text-sm text-[#586777]">
                                        완료된 사업의 서류는 조회만 가능합니다.
                                      </p>
                                    )}
                                  </CollapsibleContent>
                                </Collapsible>
                              ),
                            )}
                            {!selectedProjectSnapshot.documents.length && (
                              <div className="rounded-xl border border-dashed border-[#d9dfd8] p-6 text-center text-sm text-[#89938c]">
                                필수서류 목록이 아직 등록되지 않았습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    </TabsContent>
                    <TabsContent value="settlement">
                      <section>
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                          <ProjectSettlementDetails project={selectedProject} />
                          <Button
                            variant="outline"
                            className="mt-4 w-full"
                            onClick={() =>
                              openProjectEditDialog(selectedProject)
                            }
                          >
                            <Pencil /> 정산 정보 수정
                          </Button>
                        </div>
                      </section>
                    </TabsContent>
                    <TabsContent value="history">
                      <section className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-bold">
                              프로젝트 최근 히스토리
                            </h3>
                            <p className="mt-1 text-xs text-[#7d8981]">
                              프로젝트 연락·결정·막힘과 농가 업무 기록을
                              시간순으로 모읍니다.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openProjectUpdateDialog(
                                  selectedProject,
                                  'blocker',
                                )
                              }
                              disabled={selectedProject.status === 'completed'}
                            >
                              <CircleAlert /> 막힘 추가
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openProjectUpdateDialog(selectedProject)
                              }
                            >
                              <Plus /> 기록 추가
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-[#f8f4ed] p-4">
                            <p className="text-xs font-semibold text-[#7d6844]">
                              마지막 받은 내용
                            </p>
                            <p className="mt-2 text-sm leading-6">
                              {selectedProjectLatestReceived?.receivedContent ||
                                '받은 내용이 없습니다.'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-[#eef6f0] p-4">
                            <p className="text-xs font-semibold text-[#477356]">
                              마지막 처리 내용
                            </p>
                            <p className="mt-2 text-sm leading-6">
                              {localizedProjectActionContent(
                                selectedProjectLatestAction,
                              ) || '처리 내용이 없습니다.'}
                            </p>
                          </div>
                        </div>
                        {selectedProjectSnapshot.recentActivity.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {selectedProjectSnapshot.recentActivity
                              .slice(0, 8)
                              .map((entry) => {
                                const isProjectUpdate = 'kind' in entry;
                                const item = isProjectUpdate
                                  ? null
                                  : workItemById.get(entry.workItemId);
                                const farm = item
                                  ? farmById.get(item.farmId)
                                  : null;
                                return (
                                  <div
                                    key={entry.id}
                                    className="flex items-start justify-between gap-3 border-t border-[#edf1ec] pt-3 text-sm"
                                  >
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold">
                                          {isProjectUpdate
                                            ? entry.title
                                            : `${farm?.name ?? '농가'} · ${item?.title ?? '업무'}`}
                                        </p>
                                        {isProjectUpdate && (
                                          <Badge variant="outline">
                                            {
                                              FARM_PROJECT_UPDATE_KIND_LABELS[
                                                entry.kind
                                              ]
                                            }
                                          </Badge>
                                        )}
                                        {isProjectUpdate &&
                                          entry.kind === 'blocker' &&
                                          entry.resolvedAt > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]"
                                            >
                                              해결 완료
                                            </Badge>
                                          )}
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#738078]">
                                        {isProjectUpdate && entry.resolution
                                          ? `해결: ${entry.resolution}`
                                          : localizedProjectActionContent(
                                              entry,
                                            ) ||
                                            entry.receivedContent ||
                                            (isProjectUpdate
                                              ? entry.blockedReason
                                              : '기록 내용 없음')}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-[#89938c]">
                                      {formatTimestamp(entry.occurredAt, true)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </section>
                    </TabsContent>
                  </Tabs>
                </section>
              )}

              {selectedFarm && (
                <section
                  aria-label={
                    selectedWorkItem ? '업무 전체 상세' : '농가 전체 상세'
                  }
                  className="w-full"
                >
                  <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={backDetail}
                      className="-ml-2 min-h-11 rounded-xl text-[#315f43]"
                    >
                      <ArrowLeft />
                      {detailTrail.length
                        ? '이전 상세로'
                        : `${navItems.find((item) => item.id === view)?.label}으로`}
                    </Button>
                    {farmContextProjectId && (
                      <button
                        type="button"
                        className="min-h-10 font-semibold text-[#176448] hover:underline"
                        onClick={() => openProjectDetail(farmContextProjectId)}
                      >
                        {projectById.get(farmContextProjectId)?.name ??
                          '연결 사업'}
                      </button>
                    )}
                    <span className="text-sm text-[#586777]">
                      / {selectedFarm.name}
                      {selectedWorkItem ? ` / ${selectedWorkItem.title}` : ''}
                    </span>
                  </div>
                  <div className="mb-4 flex w-full flex-col gap-1 rounded-xl border border-[#d8e0e7] bg-white p-5">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="bg-[#f1f7ef] text-[#4a7448]"
                      >
                        {selectedFarm.farmCode}
                      </Badge>
                      <Badge variant="outline">{selectedFarm.region}</Badge>
                      <Badge variant="outline">
                        전체 참여 사업 {allSelectedRecords.length}개
                      </Badge>
                      <Badge variant="outline">
                        진행 A/S{' '}
                        {
                          selectedServiceItems.filter(
                            (item) => item.status !== 'completed',
                          ).length
                        }
                        건
                      </Badge>
                    </div>
                    <h1 className="cn-font-heading text-xl font-bold text-foreground">
                      {selectedWorkItem?.title ?? selectedFarm.name}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5" />
                        {selectedFarm.phone || '연락처 미입력'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {selectedFarm.address || selectedFarm.region}
                      </span>
                    </div>
                    {!selectedWorkItem && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#d8e0e7] pt-3">
                        <label
                          htmlFor="farm-context-project"
                          className="text-sm font-semibold"
                        >
                          현재 보는 사업
                        </label>
                        <Select
                          value={farmContextProjectId || 'all'}
                          onValueChange={(value) =>
                            setFarmContextProjectId(
                              value === 'all' ? '' : String(value),
                            )
                          }
                        >
                          <SelectTrigger
                            id="farm-context-project"
                            className="w-full sm:max-w-md"
                          >
                            <SelectValue>
                              {farmContextProjectId
                                ? projectById.get(farmContextProjectId)?.name
                                : '전체 참여 사업'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 참여 사업</SelectItem>
                            {[
                              ...new Set(
                                allSelectedRecords.map(
                                  (record) => record.projectId,
                                ),
                              ),
                            ].map((id) => (
                              <SelectItem key={id} value={id}>
                                {projectById.get(id)?.name ?? '사업 없음'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[#586777]">
                          A/S·설치·구독·처리 이력·입금내역에 함께 적용
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    key={selectedWorkItem?.id || 'farm-overview'}
                    className="w-full"
                  >
                    <Tabs
                      value={
                        selectedWorkItem
                          ? 'work-detail'
                          : farmDetailTab === 'info'
                            ? 'work'
                            : farmDetailTab
                      }
                      onValueChange={(value) => setFarmDetailTab(String(value))}
                      className="gap-4"
                    >
                      {!selectedWorkItem && (
                        <>
                          <section
                            aria-label="농가 참여 사업·설치·구독 정보"
                            className="rounded-xl border border-[#d8e0e7] bg-white p-5"
                          >
                            <section>
                              <div>
                                <h3 className="font-bold">
                                  참여 사업·설치·구독 정보
                                </h3>
                                <p className="mt-0.5 text-xs text-[#89938c]">
                                  A/S와 입금을 등록할 때 아래 사업 중 하나에
                                  연결합니다.
                                </p>
                              </div>
                              <div className="mt-3 space-y-3">
                                {selectedRecords.map((record) => {
                                  const project = projectById.get(
                                    record.projectId,
                                  );
                                  const progress = installProgress(record);
                                  return (
                                    <article
                                      key={record.id}
                                      className="rounded-2xl border border-[#dfe6dd] p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">
                                              {project?.year ?? '-'}
                                            </Badge>
                                            <Badge
                                              variant="outline"
                                              className={subscriptionClass(
                                                record.subscriptionStatus,
                                              )}
                                            >
                                              {
                                                SUBSCRIPTION_STATUS_LABELS[
                                                  record.subscriptionStatus
                                                ]
                                              }
                                            </Badge>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openProjectDetail(
                                                record.projectId,
                                              )
                                            }
                                            className="mt-2 min-h-10 text-left font-semibold text-[#176448] hover:underline"
                                          >
                                            {project?.name ?? '사업 없음'}
                                            <span className="ml-2 text-xs">
                                              프로젝트 보기 →
                                            </span>
                                          </button>
                                          <p className="mt-1 text-xs text-[#879088]">
                                            {record.crop || '작물 미입력'} ·{' '}
                                            {record.deviceType || '장비 미입력'}{' '}
                                            ·{' '}
                                            {record.productType ||
                                              '제품 미입력'}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[11px] text-[#879088]">
                                            설치 단계
                                          </p>
                                          <p className="mt-1 font-bold text-[#39795b]">
                                            {progress.complete}/4
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs text-[#68766d]">
                                          보증{' '}
                                          {formatDate(record.warrantyExpiresAt)}{' '}
                                          · 구독{' '}
                                          {formatDate(
                                            record.currentSubscriptionExpiresAt,
                                          )}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            onClick={() =>
                                              openSubscriptionExpiryDialog(
                                                record,
                                              )
                                            }
                                            size="sm"
                                            variant="outline"
                                          >
                                            <CalendarClock />
                                            만료일 입력·정정
                                          </Button>
                                          <Button
                                            onClick={() =>
                                              openRecordEditDialog(record)
                                            }
                                            size="sm"
                                            variant="outline"
                                          >
                                            <Pencil />
                                            설치 정보 수정
                                          </Button>
                                          <Button
                                            onClick={() =>
                                              openWorkItemDialog(
                                                record.id,
                                                'service',
                                              )
                                            }
                                            size="sm"
                                            variant="outline"
                                          >
                                            <Plus />이 사업에 A/S 등록
                                          </Button>
                                        </div>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {selectedFarm.folderUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  render={
                                    <a
                                      href={selectedFarm.folderUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label="농장 폴더 열기"
                                    />
                                  }
                                >
                                  <FolderOpen />
                                  농장 폴더
                                </Button>
                              )}
                              {selectedFarm.locationUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  render={
                                    <a
                                      href={selectedFarm.locationUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label="농장 위치도 열기"
                                    />
                                  }
                                >
                                  <MapPin />
                                  위치도
                                </Button>
                              )}
                              <Button
                                onClick={openFarmEditDialog}
                                size="sm"
                                variant="outline"
                              >
                                <Pencil />
                                기본정보 수정
                              </Button>
                              <Button
                                onClick={openRecordAddDialog}
                                size="sm"
                                variant="outline"
                              >
                                <Plus />
                                참여 사업 추가
                              </Button>
                              <Button
                                onClick={() =>
                                  openWorkItemDialog('', 'service')
                                }
                                size="sm"
                                disabled={!selectedRecords.length}
                                className="bg-[#2f7b59] hover:bg-[#286b4d]"
                              >
                                <Plus />
                                A/S 등록
                              </Button>
                            </div>
                            {!!selectedFarm.locationImageIds?.length && (
                              <section
                                className="mt-4 rounded-xl border border-slate-200 p-4"
                                aria-label="농장 위치도 사진"
                              >
                                <h3 className="text-base font-semibold">
                                  농장 위치도
                                </h3>
                                <ReceivedImages
                                  imageIds={selectedFarm.locationImageIds}
                                />
                              </section>
                            )}
                            {selectedFarm.specialNotes && (
                              <div className="mt-4 rounded-2xl bg-[#f4f7f3] p-4">
                                <p className="text-xs font-semibold text-[#65736a]">
                                  특이사항
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                  {selectedFarm.specialNotes}
                                </p>
                              </div>
                            )}
                          </section>
                          <TabsList
                            className="detail-tabs"
                            aria-label="농가 상세 항목"
                          >
                            <TabsTrigger value="work">
                              A/S {selectedServiceItems.length}
                            </TabsTrigger>
                            <TabsTrigger value="history">
                              처리 이력 {selectedFarmHistory.length}
                            </TabsTrigger>
                            <TabsTrigger value="payments">
                              입금내역 {selectedFarmPayments.length}
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="work">
                            <section className="rounded-xl border border-[#d8e0e7] bg-white p-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-bold">농가 A/S</h3>
                                  <p className="mt-0.5 text-xs text-[#89938c]">
                                    현재 상태와 마지막 받은·처리 내용을
                                    확인합니다.
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    openWorkItemDialog('', 'service')
                                  }
                                  disabled={!selectedRecords.length}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Plus />
                                  A/S 등록
                                </Button>
                              </div>
                              <div className="mt-4 grid gap-3">
                                {selectedServiceItems.map((item) => (
                                  <WorkItemCard key={item.id} workItem={item} />
                                ))}
                                {!selectedServiceItems.length && (
                                  <div className="rounded-2xl border border-dashed border-[#d7dfd5] py-10 text-center">
                                    <FileText className="mx-auto size-7 text-[#9aa49d]" />
                                    <p className="mt-3 text-sm font-semibold">
                                      등록된 A/S가 없습니다.
                                    </p>
                                    <p className="mt-1 text-xs text-[#89938c]">
                                      농가에서 접수한 문의나 점검 요청을 A/S로
                                      등록해 주세요.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </section>
                          </TabsContent>
                          <TabsContent value="payments">
                            <FarmPaymentHistory
                              key={`${selectedFarm.id}-${farmContextProjectId}`}
                              payments={selectedFarmPayments}
                              projectLabel={workContextLabel}
                              onOpen={(item) => openFarm(item.farmId, item.id)}
                              onAdd={() => openWorkItemDialog('', 'payment')}
                              disabled={!selectedRecords.length}
                            />
                          </TabsContent>
                        </>
                      )}

                      {selectedWorkItem &&
                        selectedWorkItem.farmId === selectedFarm.id && (
                          <TabsContent value="work-detail">
                            <section className="rounded-xl border border-[#d8e0e7] bg-white p-4 sm:p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                      {
                                        FARM_LOG_TYPE_LABELS[
                                          selectedWorkItem.workType
                                        ]
                                      }
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={workStatusClass(
                                        selectedWorkItem.status,
                                      )}
                                    >
                                      {
                                        FARM_LOG_STATUS_LABELS[
                                          selectedWorkItem.status
                                        ]
                                      }
                                    </Badge>
                                    <Badge variant="outline">
                                      {projectForWorkItem(selectedWorkItem)
                                        ?.name ?? '사업 없음'}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={workPriorityClass(
                                        selectedWorkItem.priority,
                                      )}
                                    >
                                      우선순위{' '}
                                      {
                                        FARM_WORK_PRIORITY_LABELS[
                                          selectedWorkItem.priority
                                        ]
                                      }
                                    </Badge>
                                  </div>
                                  <h3 className="mt-3 text-lg font-bold">
                                    {selectedWorkItem.title}
                                  </h3>
                                  <p className="mt-1 text-sm text-[#68766d]">
                                    담당 {selectedWorkItem.owner || '미지정'} ·
                                    기한 {formatDate(selectedWorkItem.dueDate)}
                                  </p>
                                  {selectedWorkItem.description && (
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                      {selectedWorkItem.description}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  onClick={() =>
                                    openHistoryDialog(selectedWorkItem)
                                  }
                                  size="sm"
                                  className="shrink-0 bg-[#2f7b59] hover:bg-[#286b4d]"
                                >
                                  <Plus />
                                  진행 기록 추가
                                </Button>
                                {workDeleteAction(selectedWorkItem)}
                              </div>
                              <div className="mt-5 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-[#dce7dc] bg-white p-4">
                                  <p className="text-xs font-bold text-[#5d7163]">
                                    완료 기준
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                    {selectedWorkItem.expectedOutcome ||
                                      '완료됐다고 판단할 기준을 다음 등록 때 입력해 주세요.'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[#cfe2d3] bg-[#eef8f1] p-4">
                                  <p className="text-xs font-bold text-[#3e7250]">
                                    다음 행동
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                    {selectedWorkItem.status === 'completed'
                                      ? '완료된 업무입니다.'
                                      : selectedWorkItem.nextAction ||
                                        '다음 행동이 아직 정해지지 않았습니다.'}
                                  </p>
                                  {selectedWorkItem.status !== 'completed' && (
                                    <p className="mt-3 text-[11px] text-[#728078]">
                                      다시 볼 날짜{' '}
                                      {formatDate(selectedWorkItem.reviewDate)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {(selectedWorkItem.responseDueAt > 0 ||
                                selectedWorkItem.status === 'waiting') && (
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  {selectedWorkItem.responseDueAt > 0 && (
                                    <div className="rounded-2xl border border-[#dce7dc] bg-white p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-bold text-[#5d7163]">
                                          최초 대응 관리
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className={responseRiskClass(
                                            responseRisk(
                                              selectedWorkItem,
                                              riskNow,
                                            ),
                                          )}
                                        >
                                          {responseRiskLabel(
                                            responseRisk(
                                              selectedWorkItem,
                                              riskNow,
                                            ),
                                          )}
                                        </Badge>
                                      </div>
                                      <p className="mt-3 text-sm font-semibold">
                                        목표{' '}
                                        {formatTimestamp(
                                          selectedWorkItem.responseDueAt,
                                        )}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-[#728078]">
                                        {selectedWorkItem.respondedAt
                                          ? `최초 대응 ${formatTimestamp(selectedWorkItem.respondedAt)}`
                                          : '아직 최초 대응 완료 기록이 없습니다.'}
                                      </p>
                                    </div>
                                  )}
                                  {selectedWorkItem.status === 'waiting' && (
                                    <div className="rounded-2xl border border-[#ecd4c7] bg-[#fff8f3] p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-bold text-[#8d4f35]">
                                          진행 차단 요인
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className="border-[#ecd4c7] bg-white text-[#9a5a3d]"
                                        >
                                          {elapsedDays(
                                            selectedWorkItem.blockedAt,
                                          )}
                                          일째
                                        </Badge>
                                      </div>
                                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                        {selectedWorkItem.blockedReason ||
                                          '막힘 사유 확인 필요'}
                                      </p>
                                      <p className="mt-2 text-xs leading-5 text-[#8f6a59]">
                                        해제 책임자{' '}
                                        {selectedWorkItem.blockedBy || '미입력'}{' '}
                                        · 예상{' '}
                                        {formatDate(
                                          selectedWorkItem.expectedUnblockDate,
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {selectedBlockerEpisodes.length > 0 && (
                                <div className="mt-4 rounded-2xl border border-[#e5ddd5] bg-white p-4">
                                  <div>
                                    <h4 className="text-sm font-bold">
                                      막힘 이력
                                    </h4>
                                    <p className="mt-1 text-xs text-[#7b877f]">
                                      원인, 해제에 필요한 주체, 해결 결과를
                                      기간별로 보존합니다.
                                    </p>
                                  </div>
                                  <div className="mt-4 space-y-2">
                                    {selectedBlockerEpisodes.map((episode) => (
                                      <article
                                        key={episode.id}
                                        className="rounded-xl border border-[#ece4dc] bg-[#fffaf6] p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <Badge
                                            variant="outline"
                                            className={
                                              episode.closedAt
                                                ? 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]'
                                                : 'border-[#ecd4c7] bg-white text-[#9a5a3d]'
                                            }
                                          >
                                            {episode.closedAt
                                              ? '해결됨'
                                              : `${elapsedDays(episode.openedAt)}일째 진행 중`}
                                          </Badge>
                                          <span className="text-[11px] text-[#7b877f]">
                                            {formatTimestamp(episode.openedAt)}
                                            {episode.closedAt
                                              ? ` ~ ${formatTimestamp(episode.closedAt)}`
                                              : ' ~ 현재'}
                                          </span>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                          {episode.reason}
                                        </p>
                                        <p className="mt-1 text-xs text-[#8f6a59]">
                                          해제에 필요한 사람·기관{' '}
                                          {episode.blockedBy || '미입력'} · 예상{' '}
                                          {formatDate(
                                            episode.expectedUnblockDate,
                                          )}
                                        </p>
                                        {episode.resolution && (
                                          <p className="mt-2 rounded-lg bg-[#eef6f0] px-3 py-2 text-xs leading-5 text-[#476752]">
                                            <strong>해결 결과 · </strong>
                                            {episode.resolution}
                                          </p>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="mt-4 rounded-2xl border border-[#dce7dc] bg-white p-4">
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                  <div>
                                    <h4 className="text-sm font-bold">
                                      현장 방문
                                    </h4>
                                    <p className="mt-1 text-xs text-[#7b877f]">
                                      한 업무에 여러 번 방문해도 일정과 결과를
                                      각각 남깁니다.
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      selectedWorkItem.status === 'completed'
                                    }
                                    onClick={() => openVisitDialog()}
                                  >
                                    <Plus /> 방문 추가
                                  </Button>
                                </div>
                                <div className="mt-4 space-y-2">
                                  {selectedVisits.map((visit) => (
                                    <article
                                      key={visit.id}
                                      className="rounded-xl border border-[#e1e6e0] bg-[#fafbf9] p-3"
                                    >
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                              variant="outline"
                                              className={visitStatusClass(
                                                visit.status,
                                              )}
                                            >
                                              {
                                                FARM_VISIT_STATUS_LABELS[
                                                  visit.status
                                                ]
                                              }
                                            </Badge>
                                            <span className="text-xs font-semibold text-[#536259]">
                                              {formatTimestamp(
                                                visit.scheduledAt,
                                              )}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm">
                                            방문 담당{' '}
                                            {visit.assignedTo || '미지정'}
                                          </p>
                                          {visit.preparationNote && (
                                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#5e6b63]">
                                              <strong>준비 메모 · </strong>
                                              {visit.preparationNote}
                                            </p>
                                          )}
                                          {visit.status === 'completed' && (
                                            <p className="mt-1 text-xs leading-5 text-[#728078]">
                                              실제 작업{' '}
                                              {formatTimestamp(
                                                visit.actualStartedAt,
                                              )}{' '}
                                              ~{' '}
                                              {formatTimestamp(
                                                visit.actualEndedAt,
                                              )}
                                            </p>
                                          )}
                                          {visit.result && (
                                            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#5e6b63]">
                                              <strong>
                                                {visit.status === 'canceled'
                                                  ? '취소 사유 · '
                                                  : '조치 결과 · '}
                                              </strong>
                                              {visit.result}
                                            </p>
                                          )}
                                          {visit.recordedBy && (
                                            <p className="mt-2 text-[11px] text-[#7b877f]">
                                              기록자 {visit.recordedBy}
                                            </p>
                                          )}
                                          {visit.nextVisitAt > 0 && (
                                            <p className="mt-2 text-xs font-semibold text-[#416c9c]">
                                              후속 방문 등록 당시{' '}
                                              {formatTimestamp(
                                                visit.nextVisitAt,
                                              )}
                                            </p>
                                          )}
                                        </div>
                                        {visit.status === 'scheduled' ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              openVisitDialog(visit)
                                            }
                                          >
                                            <Pencil /> 수정
                                          </Button>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="border-[#d8ded9] bg-white text-[#6f7c73]"
                                          >
                                            <LockKeyhole className="size-3" />{' '}
                                            증빙 잠금
                                          </Badge>
                                        )}
                                      </div>
                                    </article>
                                  ))}
                                  {!selectedVisits.length && (
                                    <div className="rounded-xl border border-dashed border-[#d7dfd5] px-3 py-6 text-center text-xs text-[#7b877f]">
                                      등록된 현장 방문이 없습니다. 방문 전
                                      일정을 먼저 잡아 주세요.
                                    </div>
                                  )}
                                </div>
                              </div>
                              {selectedChecklist.length > 0 && (
                                <div className="mt-4 rounded-2xl border border-[#dce7dc] bg-white p-4">
                                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                    <div>
                                      <h4 className="text-sm font-bold">
                                        현장 체크리스트
                                      </h4>
                                      <p className="mt-1 text-xs text-[#7b877f]">
                                        완료{' '}
                                        {
                                          selectedChecklist.filter(
                                            (item) => item.isCompleted,
                                          ).length
                                        }
                                        /{selectedChecklist.length} · 확인자를
                                        남겨 누락을 줄입니다.
                                      </p>
                                    </div>
                                    <Input
                                      value={checklistActor}
                                      onChange={(event) =>
                                        setChecklistActor(event.target.value)
                                      }
                                      placeholder="확인 담당자"
                                      className="h-9 sm:w-44"
                                    />
                                  </div>
                                  <div className="mt-4 space-y-2">
                                    {selectedChecklist.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={item.isCompleted}
                                        disabled={
                                          checklistSubmitting ||
                                          selectedWorkItem.status ===
                                            'completed'
                                        }
                                        onClick={() =>
                                          void toggleChecklistItem(
                                            item.id,
                                            !item.isCompleted,
                                          )
                                        }
                                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-70 ${
                                          item.isCompleted
                                            ? 'border-[#cbe2d1] bg-[#eef8f1]'
                                            : 'border-[#e1e6e0] bg-[#fafbf9] hover:border-[#bdd8c5]'
                                        }`}
                                      >
                                        <span
                                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
                                            item.isCompleted
                                              ? 'border-[#4e9768] bg-[#4e9768] text-white'
                                              : 'border-[#b7c2ba] bg-white'
                                          }`}
                                        >
                                          {item.isCompleted && (
                                            <Check className="size-3.5" />
                                          )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span
                                            className={
                                              item.isCompleted
                                                ? 'text-sm text-[#5b6b61] line-through'
                                                : 'text-sm'
                                            }
                                          >
                                            {item.content}
                                          </span>
                                          {item.isCompleted && (
                                            <span className="mt-1 block text-[11px] text-[#7f8b83]">
                                              {item.completedBy} ·{' '}
                                              {formatTimestamp(
                                                item.completedAt,
                                              )}
                                            </span>
                                          )}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="mt-5 border-t border-[#dde7dc] pt-5">
                                <h4 className="text-sm font-bold">
                                  전체 진행 히스토리
                                </h4>
                                <ol className="mt-4 space-y-3">
                                  {selectedWorkHistory.map((entry) => (
                                    <li key={entry.id} className="flex gap-3">
                                      <div className="grid size-9 shrink-0 place-items-center rounded-full border bg-white text-[#52745e]">
                                        <ChannelIcon channel={entry.channel} />
                                      </div>
                                      <article className="min-w-0 flex-1 rounded-2xl border bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-xs font-semibold text-[#66736b]">
                                            {
                                              FARM_LOG_CHANNEL_LABELS[
                                                entry.channel
                                              ]
                                            }
                                            {entry.sender
                                              ? ` · ${entry.sender}`
                                              : ''}
                                          </p>
                                          <time className="text-[11px] text-[#929b94]">
                                            {formatTimestamp(entry.occurredAt)}
                                          </time>
                                        </div>
                                        {Boolean(
                                          entry.receivedContent ||
                                          entry.imageIds?.length,
                                        ) && (
                                          <div className="mt-3 rounded-xl bg-[#f6f8f6] p-3">
                                            <p className="text-[11px] font-semibold text-[#78847c]">
                                              받은 내용
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                              {entry.receivedContent}
                                            </p>
                                            <ReceivedImages
                                              imageIds={entry.imageIds}
                                            />
                                          </div>
                                        )}
                                        {entry.actionContent && (
                                          <div className="mt-3 rounded-xl bg-[#eef6f0] p-3">
                                            <p className="text-[11px] font-semibold text-[#477356]">
                                              처리 내용
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                              {entry.actionContent}
                                            </p>
                                          </div>
                                        )}
                                        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#8a948d]">
                                          <span>기록자 {entry.recorder}</span>
                                          {entry.amount > 0 && (
                                            <strong className="text-[#39795b]">
                                              {formatMoney(entry.amount)}
                                            </strong>
                                          )}
                                          {entry.subscriptionNewExpiryDate && (
                                            <span className="text-sm font-medium text-emerald-800">
                                              구독{' '}
                                              {entry.subscriptionPaymentOrdinal
                                                ? `${entry.subscriptionPaymentOrdinal}차 갱신 · `
                                                : ''}
                                              {entry.subscriptionYearsAdded}년
                                              자동 갱신 ·{' '}
                                              {
                                                entry.subscriptionPreviousExpiryDate
                                              }{' '}
                                              →{' '}
                                              {entry.subscriptionNewExpiryDate}
                                            </span>
                                          )}
                                          {entry.referenceUrl && (
                                            <a
                                              href={entry.referenceUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="flex items-center gap-1 font-semibold text-[#39795b]"
                                            >
                                              <ExternalLink className="size-3" />
                                              참고 링크
                                            </a>
                                          )}
                                        </div>
                                      </article>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </section>
                          </TabsContent>
                        )}

                      {!selectedWorkItem && (
                        <TabsContent value="history">
                          <section className="rounded-xl border border-[#d8e0e7] bg-white p-5">
                            <div>
                              <h3 className="font-bold">농가 전체 히스토리</h3>
                              <p className="mt-0.5 text-xs text-[#89938c]">
                                어느 사업과 업무에 속하는 기록인지 함께
                                표시합니다.
                              </p>
                            </div>
                            <ol className="mt-4 space-y-3">
                              {selectedFarmHistory.map(
                                ({ entry, workItem }) => (
                                  <li
                                    key={entry.id}
                                    className="rounded-2xl border border-[#e0e6df] bg-white p-4"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">
                                          {projectForWorkItem(workItem)?.name ??
                                            '사업 없음'}
                                        </Badge>
                                        <Badge variant="outline">
                                          {
                                            FARM_LOG_TYPE_LABELS[
                                              workItem.workType
                                            ]
                                          }
                                        </Badge>
                                        <span className="text-xs font-semibold">
                                          {workItem.title}
                                        </span>
                                      </div>
                                      <time className="text-[11px] text-[#929b94]">
                                        {formatTimestamp(entry.occurredAt)}
                                      </time>
                                    </div>
                                    {entry.receivedContent && (
                                      <p className="mt-3 line-clamp-2 text-sm leading-6">
                                        <strong className="text-[#78847c]">
                                          받은 내용 ·{' '}
                                        </strong>
                                        {entry.receivedContent}
                                      </p>
                                    )}
                                    {entry.actionContent && (
                                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#476752]">
                                        <strong>처리 내용 · </strong>
                                        {entry.actionContent}
                                      </p>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openFarm(workItem.farmId, workItem.id)
                                      }
                                      className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#39795b]"
                                    >
                                      업무 전체 과정 보기{' '}
                                      <ArrowRight className="size-3.5" />
                                    </button>
                                  </li>
                                ),
                              )}
                              {!selectedFarmHistory.length && (
                                <li className="rounded-2xl border border-dashed py-8 text-center text-sm text-[#89938c]">
                                  아직 기록된 히스토리가 없습니다.
                                </li>
                              )}
                            </ol>
                          </section>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>

        {workDeletionTarget && (
          <WorkDeletionDialog
            task={workDeletionTarget}
            onConfirm={confirmWorkDeletion}
            onClose={() => setWorkDeletionTarget(null)}
          />
        )}
        {projectDeletionTarget && (
          <ProjectDeletionDialog
            key={projectDeletionTarget.id}
            project={projectDeletionTarget}
            onConfirm={confirmProjectDeletion}
            onClose={() => setProjectDeletionTarget(null)}
          />
        )}
        <Dialog
          open={Boolean(quickDetailTaskId)}
          onOpenChange={(open) => {
            if (!open && !quickDetailBusy) setQuickDetailTaskId('');
          }}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>처리 기록·상태 변경</DialogTitle>
              <DialogDescription>
                상태와 처리 내용만 바로 입력하세요. 필요한 항목만 펼쳐 추가할 수
                있습니다.
              </DialogDescription>
            </DialogHeader>
            {workItemById.get(quickDetailTaskId) && (
              <WorkQuickEditor
                key={quickDetailTaskId}
                task={workItemById.get(quickDetailTaskId)!}
                recorder={accountName || accountEmail}
                onSave={saveQuickWork}
                onBusy={setQuickDetailBusy}
                onCancel={() => setQuickDetailTaskId('')}
                onAdvanced={() => {
                  const item = workItemById.get(quickDetailTaskId)!;
                  setQuickDetailTaskId('');
                  openHistoryDialog(item, true);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        {organization.personal &&
          member &&
          (taskRegistrationOpen || childTaskParent) && (
            <TaskRegistrationDialog
              key={childTaskParent?.id || 'new-task'}
              member={member}
              members={organization.members}
              departments={organization.departments}
              projects={activeProjects}
              parent={childTaskParent || undefined}
              onClose={() => {
                setTaskRegistrationOpen(false);
                setChildTaskParent(null);
              }}
              onCreated={() =>
                toast.add({ title: '업무를 등록했습니다', type: 'success' })
              }
            />
          )}
        <Dialog
          open={Boolean(childTaskParent) && !organization.personal}
          onOpenChange={(open) => {
            if (!open && !childTaskBusy) setChildTaskParent(null);
          }}
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle>세부 업무 추가</DialogTitle>
              <DialogDescription>
                상위 업무 아래에 담당자·상태·이력을 독립적으로 관리할 업무를
                추가합니다.
              </DialogDescription>
            </DialogHeader>
            {childTaskParent && (
              <ChildTaskForm
                key={childTaskParent.id}
                parent={childTaskParent}
                recorder={accountName || accountEmail}
                onSave={createChildTask}
                onBusy={setChildTaskBusy}
                onCancel={() => setChildTaskParent(null)}
              />
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={dialog === 'subscription_expiry'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'subscription_expiry' : null)
          }
        >
          <DialogContent className="p-5 sm:max-w-[560px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                구독 만료일 입력·정정
              </DialogTitle>
              <DialogDescription>
                농가와 사업에 연결된 현재 구독 만료일을 바로 지정합니다.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={submitSubscriptionExpiry}
              className="mt-1 space-y-4"
            >
              <div className="rounded-xl border border-[#dfe6dd] bg-[#f7f9f6] p-4">
                <p className="font-semibold">
                  {subscriptionExpiryFarm?.name ?? '농가 없음'}
                </p>
                <p className="mt-1 text-xs text-[#748078]">
                  {subscriptionExpiryProject?.name ?? '사업 없음'}
                </p>
                <p className="mt-2 text-xs text-[#748078]">
                  현재 만료일 ·{' '}
                  <strong className="text-[#365d45]">
                    {formatDate(
                      subscriptionExpiryRecord?.currentSubscriptionExpiresAt ??
                        '',
                    )}
                  </strong>
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="subscription-expiry-date">
                  변경할 만료일
                </FieldLabel>
                <Input
                  id="subscription-expiry-date"
                  type="date"
                  required
                  value={subscriptionExpiryForm.expiryDate}
                  onChange={(event) =>
                    setSubscriptionExpiryForm((current) => ({
                      ...current,
                      expiryDate: event.target.value,
                    }))
                  }
                />
                {subscriptionExpiryForm.expiryDate && (
                  <p className="text-xs text-[#748078]">
                    저장 후 상태 ·{' '}
                    <strong>
                      {subscriptionExpiryForm.expiryDate >= localDateString()
                        ? '사용중'
                        : '만료'}
                    </strong>
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="subscription-expiry-recorder">
                  변경 담당자
                </FieldLabel>
                <Input
                  id="subscription-expiry-recorder"
                  required
                  maxLength={100}
                  value={subscriptionExpiryForm.recorder}
                  onChange={(event) =>
                    setSubscriptionExpiryForm((current) => ({
                      ...current,
                      recorder: event.target.value,
                    }))
                  }
                  placeholder="만료일을 확인한 담당자"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="subscription-expiry-note">
                  변경 메모
                </FieldLabel>
                <Textarea
                  id="subscription-expiry-note"
                  maxLength={1000}
                  value={subscriptionExpiryForm.note}
                  onChange={(event) =>
                    setSubscriptionExpiryForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="계약서 확인, 기존 입력 오류 등 변경 근거"
                  className="min-h-20"
                />
              </Field>
              {formError && <FieldError>{formError}</FieldError>}
              <div className="rounded-xl bg-[#f5f8f4] px-4 py-3 text-xs leading-5 text-[#617066]">
                이 기능은 만료일 입력·정정용입니다. 갱신·이탈·재가입 실적은
                늘어나지 않으며 변경 이력만 남습니다. 실제 갱신은 ‘구독 처리’를
                사용해 주세요.
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#327a56] hover:bg-[#286848]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  만료일 저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'subscription_event'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'subscription_event' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[620px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">구독 처리 등록</DialogTitle>
              <DialogDescription>
                갱신·이탈·재가입 결과를 남기면 기간 실적과 현재 만료일이 함께
                반영됩니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitSubscriptionEvent} className="mt-1 space-y-4">
              <Field>
                <FieldLabel>농가·사업 구독</FieldLabel>
                <Select
                  value={subscriptionEventForm.farmRecordId}
                  onValueChange={(value) => {
                    if (!value) return;
                    const record = recordById.get(value);
                    if (!record) return;
                    setSubscriptionEventForm((current) => ({
                      ...current,
                      farmRecordId: value,
                      expectedCurrentExpiryDate:
                        record.currentSubscriptionExpiresAt,
                      expectedUpdatedAt: record.updatedAt,
                      basisExpiryDate: record.currentSubscriptionExpiresAt,
                      basisRenewalCount: '',
                      newExpiryDate:
                        current.eventType === 'churned' ||
                        !record.currentSubscriptionExpiresAt
                          ? ''
                          : addYears(record.currentSubscriptionExpiresAt, 1),
                      recorder:
                        current.recorder ||
                        projectById.get(record.projectId)?.manager ||
                        '',
                    }));
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="농가와 사업을 선택해 주세요">
                      {subscriptionEventForm.farmRecordId
                        ? subscriptionRecordSelectLabel(
                            subscriptionEventForm.farmRecordId,
                          )
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[...workspace.records]
                      .sort((left, right) => {
                        const leftFarm = farmById.get(left.farmId)?.name ?? '';
                        const rightFarm =
                          farmById.get(right.farmId)?.name ?? '';
                        return leftFarm.localeCompare(rightFarm, 'ko-KR');
                      })
                      .map((record) => (
                        <SelectItem key={record.id} value={record.id}>
                          {farmById.get(record.farmId)?.name ?? '농가 없음'} ·{' '}
                          {projectById.get(record.projectId)?.name ??
                            '사업 없음'}{' '}
                          ·{' '}
                          {record.currentSubscriptionExpiresAt ||
                            '만료일 미입력'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>처리 구분</FieldLabel>
                  <Select
                    value={subscriptionEventForm.eventType}
                    onValueChange={(value) =>
                      setSubscriptionEventForm((current) => ({
                        ...current,
                        eventType: value as FarmSubscriptionEventType,
                        basisRenewalCount:
                          value === 'rejoined' ? '' : current.basisRenewalCount,
                        newExpiryDate:
                          value === 'churned'
                            ? ''
                            : current.newExpiryDate ||
                              addYears(current.basisExpiryDate, 1),
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {
                          FARM_SUBSCRIPTION_EVENT_TYPE_LABELS[
                            subscriptionEventForm.eventType
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="renewed">갱신</SelectItem>
                      <SelectItem value="churned">이탈</SelectItem>
                      <SelectItem value="rejoined">재가입</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="subscription-processed-at">
                    처리일
                  </FieldLabel>
                  <Input
                    id="subscription-processed-at"
                    type="date"
                    value={subscriptionEventForm.processedAt}
                    onChange={(event) =>
                      setSubscriptionEventForm((current) => ({
                        ...current,
                        processedAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="subscription-basis-expiry">
                    기준 만료일
                  </FieldLabel>
                  <Input
                    id="subscription-basis-expiry"
                    type="date"
                    value={subscriptionEventForm.basisExpiryDate}
                    onChange={(event) => {
                      const basisExpiryDate = event.target.value;
                      setSubscriptionEventForm((current) => ({
                        ...current,
                        basisExpiryDate,
                        basisRenewalCount: '',
                        newExpiryDate:
                          current.eventType === 'churned'
                            ? ''
                            : addYears(basisExpiryDate, 1),
                      }));
                    }}
                  />
                </Field>
                {subscriptionEventForm.eventType !== 'churned' && (
                  <Field>
                    <FieldLabel htmlFor="subscription-new-expiry">
                      새 만료일
                    </FieldLabel>
                    <Input
                      id="subscription-new-expiry"
                      type="date"
                      value={subscriptionEventForm.newExpiryDate}
                      onChange={(event) =>
                        setSubscriptionEventForm((current) => ({
                          ...current,
                          newExpiryDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                )}
              </div>

              <p className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                갱신 회차는 실제 입금 순서로 정합니다. 첫 입금은 첫 갱신, 두
                번째부터는 반복 갱신입니다. 입금 업무에서 금액을 등록하면
                만료일과 갱신 이력이 함께 저장됩니다. 이 창에서 과거 처리만
                등록한 경우에는 해당 입금과의 연결이 필요할 수 있습니다.
              </p>
              <Field>
                <FieldLabel htmlFor="subscription-recorder">
                  처리 담당자
                </FieldLabel>
                <Input
                  id="subscription-recorder"
                  value={subscriptionEventForm.recorder}
                  onChange={(event) =>
                    setSubscriptionEventForm((current) => ({
                      ...current,
                      recorder: event.target.value,
                    }))
                  }
                  placeholder="예: 구독관리팀 홍길동"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="subscription-note">처리 메모</FieldLabel>
                <Textarea
                  id="subscription-note"
                  value={subscriptionEventForm.note}
                  onChange={(event) =>
                    setSubscriptionEventForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="갱신 조건, 이탈 사유, 재가입 경위 등을 적어 주세요."
                  className="min-h-24"
                />
              </Field>
              {formError && <FieldError>{formError}</FieldError>}
              <div className="rounded-xl bg-[#f5f8f4] px-4 py-3 text-xs leading-5 text-[#617066]">
                갱신·이탈은 기준 만료일이 속한 기간에, 재가입은 처리일이 속한
                기간에 집계됩니다. 같은 만료 회차에 갱신과 이탈을 중복 등록할 수
                없습니다.
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#327a56] hover:bg-[#286848]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  처리 결과 저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'project'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'project' : null)
          }
        >
          <DialogContent className="max-h-[92dvh] overflow-y-auto p-5 sm:max-w-[1100px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingProjectId
                  ? '프로젝트·정산 정보 수정'
                  : '스마트팜 사업 등록'}
              </DialogTitle>
              <DialogDescription>
                현재 단계, 담당자, 사업기간과 최종정산 기준을 함께 관리합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitProject} className="mt-1 space-y-4">
              <Field>
                <FieldLabel htmlFor="project-name">사업명</FieldLabel>
                <Input
                  id="project-name"
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="예: 2026 데이터 기반 스마트농업"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="project-type">사업 유형</FieldLabel>
                  <Select
                    value={projectForm.projectType}
                    onValueChange={(value) =>
                      setProjectForm((current) => ({
                        ...current,
                        projectType: value as FarmProjectType,
                      }))
                    }
                  >
                    <SelectTrigger id="project-type" className="h-10 w-full">
                      <SelectValue>
                        {FARM_PROJECT_TYPE_LABELS[projectForm.projectType]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">일반 사업</SelectItem>
                      <SelectItem value="research">연구 사업</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-year">기준 연도</FieldLabel>
                  <Input
                    id="project-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={projectForm.year}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        year: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-institution">
                    주관기관
                  </FieldLabel>
                  <Input
                    id="project-institution"
                    value={projectForm.institution}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        institution: event.target.value,
                      }))
                    }
                    placeholder="예: 지역 농업기술원"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-target-farms">
                    목표 농가 수
                  </FieldLabel>
                  <Input
                    id="project-target-farms"
                    type="number"
                    min={0}
                    value={projectForm.targetFarmCount}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        targetFarmCount: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-status">사업 상태</FieldLabel>
                  <Select
                    value={projectForm.status}
                    onValueChange={(value) =>
                      setProjectForm((current) => {
                        const status = value as FarmProjectStatus;
                        return {
                          ...current,
                          status,
                          currentStage:
                            status === 'completed'
                              ? 'closed'
                              : current.currentStage === 'closed'
                                ? 'settlement'
                                : current.currentStage,
                        };
                      })
                    }
                  >
                    <SelectTrigger id="project-status" className="h-10 w-full">
                      <SelectValue>
                        {FARM_PROJECT_STATUS_LABELS[projectForm.status]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">진행 중</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="on_hold">보류</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-manager">사업 담당자</FieldLabel>
                  <Input
                    id="project-manager"
                    value={projectForm.manager}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        manager: event.target.value,
                      }))
                    }
                    placeholder="예: 사업운영팀 홍길동"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-stage">
                    현재 사업 단계
                  </FieldLabel>
                  <Select
                    value={projectForm.currentStage}
                    onValueChange={(value) =>
                      setProjectForm((current) => {
                        const currentStage = value as FarmProjectStage;
                        return {
                          ...current,
                          currentStage,
                          status:
                            currentStage === 'closed'
                              ? 'completed'
                              : current.status === 'completed'
                                ? 'active'
                                : current.status,
                        };
                      })
                    }
                  >
                    <SelectTrigger id="project-stage" className="h-10 w-full">
                      <SelectValue>
                        {FARM_PROJECT_STAGE_LABELS[projectForm.currentStage]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FARM_PROJECT_STAGE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-start-date">
                    사업 시작일
                  </FieldLabel>
                  <Input
                    id="project-start-date"
                    type="date"
                    value={projectForm.startDate}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-end-date">
                    종료 예정일
                  </FieldLabel>
                  <Input
                    id="project-end-date"
                    type="date"
                    value={projectForm.endDate}
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="project-description">사업 설명</FieldLabel>
                <Textarea
                  id="project-description"
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="사업 목적과 범위를 적어 주세요."
                  className="min-h-24"
                />
              </Field>
              {editingProjectId && projectForm.status === 'completed' && (
                <div className="flex gap-3 rounded-2xl border border-[#d7d8b8] bg-[#fbfaed] p-4 text-sm text-[#746d2f]">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                  <p className="leading-6">
                    완료 근거인 목표 농가·기간·정산·필수서류는 잠겨 있습니다.
                    이를 바꾸거나 새 농가·업무를 연결하려면 사업 상태를 먼저
                    진행 중 또는 보류로 바꿔 저장해 주세요.
                  </p>
                </div>
              )}
              <ProjectSettlementEditor
                value={projectForm}
                onChange={setProjectForm}
                locked={Boolean(
                  editingProjectId &&
                  projectById.get(editingProjectId)?.status === 'completed',
                )}
              />
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  {editingProjectId ? '수정 저장' : '사업 등록'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'project_document'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'project_document' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[680px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingProjectDocumentId ? '제출서류 수정' : '제출서류 추가'}
              </DialogTitle>
              <DialogDescription>
                책임자, 현재 처리자, 기한과 제출·승인 상태를 기록합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitProjectDocument} className="mt-1 space-y-4">
              <Field>
                <FieldLabel htmlFor="project-document-title">서류명</FieldLabel>
                <Input
                  id="project-document-title"
                  value={projectDocumentForm.title}
                  onChange={(event) =>
                    setProjectDocumentForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="예: 최종 정산보고서"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="project-document-category">
                    서류 구분
                  </FieldLabel>
                  <Select
                    value={projectDocumentForm.category}
                    onValueChange={(value) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        category: value as FarmProjectDocumentCategory,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="project-document-category"
                      className="h-10 w-full"
                    >
                      <SelectValue>
                        {
                          FARM_PROJECT_DOCUMENT_CATEGORY_LABELS[
                            projectDocumentForm.category
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(
                        FARM_PROJECT_DOCUMENT_CATEGORY_LABELS,
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-required">
                    필수 여부
                  </FieldLabel>
                  <Select
                    value={
                      projectDocumentForm.isRequired ? 'required' : 'optional'
                    }
                    onValueChange={(value) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        isRequired: value === 'required',
                      }))
                    }
                  >
                    <SelectTrigger
                      id="project-document-required"
                      className="h-10 w-full"
                    >
                      <SelectValue>
                        {projectDocumentForm.isRequired
                          ? '필수서류'
                          : '선택서류'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">필수서류</SelectItem>
                      <SelectItem value="optional">선택서류</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-status">
                    서류 상태
                  </FieldLabel>
                  <Select
                    value={projectDocumentForm.status}
                    onValueChange={(value) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        status: value as FarmProjectDocumentStatus,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="project-document-status"
                      className="h-10 w-full"
                    >
                      <SelectValue>
                        {
                          FARM_PROJECT_DOCUMENT_STATUS_LABELS[
                            projectDocumentForm.status
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FARM_PROJECT_DOCUMENT_STATUS_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-revision">
                    개정번호
                  </FieldLabel>
                  <Input
                    id="project-document-revision"
                    type="number"
                    min={1}
                    max={1000}
                    value={projectDocumentForm.revision}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        revision: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-owner">
                    제출 책임자
                  </FieldLabel>
                  <Input
                    id="project-document-owner"
                    value={projectDocumentForm.owner}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        owner: event.target.value,
                      }))
                    }
                    placeholder="예: 사업운영팀"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-handler">
                    현재 처리자
                  </FieldLabel>
                  <Input
                    id="project-document-handler"
                    value={projectDocumentForm.currentHandler}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        currentHandler: event.target.value,
                      }))
                    }
                    placeholder="예: 주관기관 검토자"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-due-date">
                    제출 기한
                  </FieldLabel>
                  <Input
                    id="project-document-due-date"
                    type="date"
                    value={projectDocumentForm.dueDate}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-submitted-at">
                    제출일
                  </FieldLabel>
                  <Input
                    id="project-document-submitted-at"
                    type="date"
                    value={projectDocumentForm.submittedAt}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        submittedAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-approved-at">
                    승인일
                  </FieldLabel>
                  <Input
                    id="project-document-approved-at"
                    type="date"
                    value={projectDocumentForm.approvedAt}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        approvedAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-document-reference">
                    서류 링크
                  </FieldLabel>
                  <Input
                    id="project-document-reference"
                    value={projectDocumentForm.referenceUrl}
                    onChange={(event) =>
                      setProjectDocumentForm((current) => ({
                        ...current,
                        referenceUrl: event.target.value,
                      }))
                    }
                    placeholder="https://drive.google.com/..."
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="project-document-note">
                  메모·보완 내용
                </FieldLabel>
                <Textarea
                  id="project-document-note"
                  value={projectDocumentForm.note}
                  onChange={(event) =>
                    setProjectDocumentForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="반려·보완 사유와 다음 행동을 기록해 주세요."
                  className="min-h-24"
                />
              </Field>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  {editingProjectDocumentId ? '수정 저장' : '서류 추가'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'project_update'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'project_update' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[720px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">프로젝트 기록 추가</DialogTitle>
              <DialogDescription>
                특정 농가가 없는 공문, 회의 결정, 정산 연락과 프로젝트 막힘을
                바로 남깁니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitProjectUpdate} className="mt-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="project-update-kind">
                    기록 구분
                  </FieldLabel>
                  <Select
                    value={projectUpdateForm.kind}
                    onValueChange={(value) =>
                      setProjectUpdateForm((current) => ({
                        ...current,
                        kind: value as ProjectUpdateForm['kind'],
                      }))
                    }
                  >
                    <SelectTrigger
                      id="project-update-kind"
                      className="h-10 w-full"
                    >
                      <SelectValue>
                        {
                          FARM_PROJECT_UPDATE_KIND_LABELS[
                            projectUpdateForm.kind
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="communication">수신·연락</SelectItem>
                      <SelectItem value="decision">결정·변경</SelectItem>
                      <SelectItem value="blocker">프로젝트 막힘</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-update-title">제목</FieldLabel>
                  <Input
                    id="project-update-title"
                    value={projectUpdateForm.title}
                    onChange={(event) =>
                      setProjectUpdateForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="예: 주관기관 중간보고 보완 요청"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="project-update-action">
                  처리 내용·다음 행동
                </FieldLabel>
                <Textarea
                  id="project-update-action"
                  value={projectUpdateForm.actionContent}
                  onChange={(event) =>
                    setProjectUpdateForm((current) => ({
                      ...current,
                      actionContent: event.target.value,
                    }))
                  }
                  placeholder="현재까지 처리한 내용과 다음 행동"
                  className="min-h-28"
                />
              </Field>
              {projectUpdateForm.kind === 'blocker' && (
                <div className="grid gap-4 rounded-2xl border border-[#efc8bb] bg-[#fff6f1] p-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="project-update-blocked-reason">
                      막힘 사유
                    </FieldLabel>
                    <Textarea
                      id="project-update-blocked-reason"
                      value={projectUpdateForm.blockedReason}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          blockedReason: event.target.value,
                        }))
                      }
                      placeholder="무엇 때문에 다음 단계로 진행하지 못하는지"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="project-update-blocked-by">
                      해결해 줄 사람·기관
                    </FieldLabel>
                    <Input
                      id="project-update-blocked-by"
                      value={projectUpdateForm.blockedBy}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          blockedBy: event.target.value,
                        }))
                      }
                      placeholder="예: 주관기관 정산 담당자"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="project-update-unblock-date">
                      해결 예상일
                    </FieldLabel>
                    <Input
                      id="project-update-unblock-date"
                      type="date"
                      value={projectUpdateForm.expectedUnblockDate}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          expectedUnblockDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              )}
              <Collapsible>
                <CollapsibleTrigger className="min-h-11 text-sm font-semibold text-emerald-800">
                  수신 내용·참고 정보 (선택)
                </CollapsibleTrigger>
                <CollapsibleContent keepMounted className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="project-update-channel">
                        수신 경로
                      </FieldLabel>
                      <Select
                        value={projectUpdateForm.channel}
                        onValueChange={(value) =>
                          setProjectUpdateForm((current) => ({
                            ...current,
                            channel: value as HistoryChannel,
                          }))
                        }
                      >
                        <SelectTrigger
                          id="project-update-channel"
                          className="h-10 w-full"
                        >
                          <SelectValue>
                            {
                              FARM_HISTORY_CHANNEL_LABELS[
                                projectUpdateForm.channel
                              ]
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FARM_HISTORY_CHANNEL_LABELS)
                            .filter(([value]) => value !== 'system')
                            .map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="project-update-sender">
                        발신자·기관
                      </FieldLabel>
                      <Input
                        id="project-update-sender"
                        value={projectUpdateForm.sender}
                        onChange={(event) =>
                          setProjectUpdateForm((current) => ({
                            ...current,
                            sender: event.target.value,
                          }))
                        }
                        placeholder="예: 지역 농업기술원 담당자"
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="project-update-received">
                      받은 내용
                    </FieldLabel>
                    <Textarea
                      id="project-update-received"
                      value={projectUpdateForm.receivedContent}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          receivedContent: event.target.value,
                        }))
                      }
                      placeholder="메일·카톡·전화·구두로 전달받은 원문 요약"
                      className="min-h-28"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="project-update-reference">
                      참고 링크
                    </FieldLabel>
                    <Input
                      id="project-update-reference"
                      type="url"
                      value={projectUpdateForm.referenceUrl}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          referenceUrl: event.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="project-update-occurred-at">
                      기록 일시
                    </FieldLabel>
                    <Input
                      id="project-update-occurred-at"
                      type="datetime-local"
                      value={projectUpdateForm.occurredAt}
                      onChange={(event) =>
                        setProjectUpdateForm((current) => ({
                          ...current,
                          occurredAt: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </CollapsibleContent>
              </Collapsible>
              <p className="text-xs text-slate-500">
                작성자 {projectUpdateForm.recorder} · 기록 일시는 자동으로
                채워집니다.
              </p>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  기록 저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'project_blocker_resolve'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'project_blocker_resolve' : null)
          }
        >
          <DialogContent className="p-5 sm:max-w-[560px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                프로젝트 막힘 해결 처리
              </DialogTitle>
              <DialogDescription>
                무엇이 어떻게 해결됐는지 남기면 열린 막힘에서 빠집니다.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={submitProjectBlockerResolution}
              className="mt-1 space-y-4"
            >
              <Field>
                <FieldLabel htmlFor="project-blocker-resolution">
                  해결 내용
                </FieldLabel>
                <Textarea
                  id="project-blocker-resolution"
                  value={projectBlockerResolutionForm.resolution}
                  onChange={(event) =>
                    setProjectBlockerResolutionForm((current) => ({
                      ...current,
                      resolution: event.target.value,
                    }))
                  }
                  placeholder="확보된 자료, 합의된 내용, 재개된 다음 단계를 적어 주세요."
                  className="min-h-28"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-blocker-resolved-by">
                  처리 담당자
                </FieldLabel>
                <Input
                  id="project-blocker-resolved-by"
                  value={projectBlockerResolutionForm.resolvedBy}
                  onChange={(event) =>
                    setProjectBlockerResolutionForm((current) => ({
                      ...current,
                      resolvedBy: event.target.value,
                    }))
                  }
                />
              </Field>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  해결 완료
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={
            dialog === 'farm' ||
            dialog === 'farm_edit' ||
            dialog === 'record_add' ||
            dialog === 'record_edit'
          }
          onOpenChange={(open) => {
            if (
              !submitting &&
              !farmImageBusyRef.current &&
              !farmSaveBusyRef.current &&
              !open
            )
              setDialog(null);
          }}
        >
          <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-[860px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {dialog === 'farm'
                  ? '농가 관리대장 등록'
                  : dialog === 'farm_edit'
                    ? '농가 기본정보 수정'
                    : dialog === 'record_add'
                      ? '참여 사업 추가'
                      : '설치 정보 수정'}
              </DialogTitle>
              <DialogDescription>
                {dialog === 'farm'
                  ? '농가 기본정보와 첫 사업·설치·구독 정보를 함께 저장합니다.'
                  : dialog === 'farm_edit'
                    ? '농장번호, 연락처, 주소와 현장 링크를 수정합니다.'
                    : dialog === 'record_add'
                      ? `${selectedFarm?.name ?? ''} 농가를 다른 사업에 연결합니다.`
                      : '사업별 장비와 설치 단계를 수정합니다. 현재 만료일과 구독 상태는 관리대장의 전용 구독 관리에서 변경합니다.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitFarm} className="mt-1 space-y-6">
              {(dialog === 'farm' || dialog === 'farm_edit') && (
                <section>
                  <h3 className="mb-4 text-sm font-bold text-[#365644]">
                    1. 농가 기본정보
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field>
                      <FieldLabel>농장번호</FieldLabel>
                      <Input
                        value={farmForm.farmCode}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            farmCode: event.target.value,
                          }))
                        }
                        placeholder="예: FARM-001"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>농장명</FieldLabel>
                      <Input
                        value={farmForm.name}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="농장 또는 농가명"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>연락처</FieldLabel>
                      <Input
                        value={farmForm.phone}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="010-0000-0000"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>지역</FieldLabel>
                      <Input
                        value={farmForm.region}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            region: event.target.value,
                          }))
                        }
                        placeholder="예: 김천"
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel>주소</FieldLabel>
                      <Input
                        value={farmForm.address}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        placeholder="농장 주소"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>경영체번호</FieldLabel>
                      <Input
                        value={farmForm.businessNumber}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            businessNumber: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>농장 폴더 링크 (선택)</FieldLabel>
                      <Input
                        type="url"
                        value={farmForm.folderUrl}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            folderUrl: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </Field>
                    <Field>
                      <FieldLabel>농장 위치도 링크 (선택)</FieldLabel>
                      <Input
                        type="url"
                        value={farmForm.locationUrl}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            locationUrl: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </Field>
                    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                      <h4 className="text-sm font-semibold">
                        농장 위치도 사진 (선택)
                      </h4>
                      {farmLocationExpectedIds.length > 0 && (
                        <div className="space-y-2">
                          <ReceivedImages imageIds={farmLocationExpectedIds} />
                          {farmLocationExpectedIds.map((id, index) => {
                            const kept = farmLocationIds.includes(id);
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span>
                                  기존 위치도 {index + 1}
                                  {kept ? '' : ' · 저장 시 제외'}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    submitting ||
                                    farmLocationBusy ||
                                    (!kept &&
                                      farmLocationIds.length +
                                        farmLocationImages.length >=
                                        3)
                                  }
                                  onClick={() =>
                                    setFarmLocationIds((ids) =>
                                      kept
                                        ? ids.filter((value) => value !== id)
                                        : farmLocationExpectedIds.filter(
                                            (value) =>
                                              value === id ||
                                              ids.includes(value),
                                          ),
                                    )
                                  }
                                >
                                  {kept ? '첨부 제외' : '제외 취소'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <ReceivedContentInput
                        key={`${dialog}-${editingFarmId}`}
                        imageOnly
                        images={farmLocationImages}
                        existingCount={farmLocationIds.length}
                        onImagesChange={setFarmLocationImages}
                        onBusyChange={(busy) => {
                          farmImageBusyRef.current = busy;
                          setFarmLocationBusy(busy);
                        }}
                        disabled={submitting}
                      />
                    </div>
                    <Field className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>특이사항</FieldLabel>
                      <Textarea
                        value={farmForm.specialNotes}
                        onChange={(event) =>
                          setFarmForm((current) => ({
                            ...current,
                            specialNotes: event.target.value,
                          }))
                        }
                        placeholder="현장 대응에 필요한 특이사항"
                      />
                    </Field>
                  </div>
                </section>
              )}
              {dialog !== 'farm_edit' && (
                <>
                  <section
                    className={
                      dialog === 'farm' ? 'border-t border-[#e3e8e2] pt-6' : ''
                    }
                  >
                    <h3 className="mb-4 text-sm font-bold text-[#365644]">
                      2. 사업·장비 정보
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field className="sm:col-span-2 lg:col-span-3">
                        <FieldLabel>참여 사업</FieldLabel>
                        <Select
                          value={farmForm.projectId}
                          onValueChange={(value) =>
                            setFarmForm((current) => ({
                              ...current,
                              projectId: value ?? '',
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue>
                              {projectSelectLabel(farmForm.projectId)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {activeProjects
                              .filter(
                                (project) =>
                                  dialog === 'farm' ||
                                  !hasProjectParticipation(
                                    allSelectedRecords,
                                    project.id,
                                    editingRecordId,
                                  ),
                              )
                              .map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>작물</FieldLabel>
                        <Input
                          value={farmForm.crop}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              crop: event.target.value,
                            }))
                          }
                          placeholder="포도, 딸기, 사과 등"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>장비 종류</FieldLabel>
                        <Input
                          value={farmForm.deviceType}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              deviceType: event.target.value,
                            }))
                          }
                          placeholder="클라우드, 라떼판다 등"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>제품 종류</FieldLabel>
                        <Input
                          value={farmForm.productType}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              productType: event.target.value,
                            }))
                          }
                          placeholder="관수내비, 온실내비 등"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>장비업체</FieldLabel>
                        <Input
                          value={farmForm.vendor}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              vendor: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>인터넷 유형</FieldLabel>
                        <Input
                          value={farmForm.internetType}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              internetType: event.target.value,
                            }))
                          }
                          placeholder="유선, 무선 라우터 등"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>사업 비고</FieldLabel>
                        <Input
                          value={farmForm.notes}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </section>
                  <section className="border-t border-[#e3e8e2] pt-6">
                    <h3 className="mb-4 text-sm font-bold text-[#365644]">
                      3. 설치 진행 단계
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field>
                        <FieldLabel>제작·세팅 완료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.productionSetupDate}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              productionSetupDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>제품 설치일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.installationDate}
                          onChange={(event) => {
                            const installationDate = event.target.value;
                            setFarmForm((current) => ({
                              ...current,
                              installationDate,
                              warrantyExpiresAt: addYears(
                                installationDate,
                                current.warrantyYears,
                              ),
                            }));
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>시운전 완료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.commissioningDate}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              commissioningDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>교육 완료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.educationDate}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              educationDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </section>
                  <section className="border-t border-[#e3e8e2] pt-6">
                    <h3 className="mb-4 text-sm font-bold text-[#365644]">
                      4. 보증·구독
                    </h3>
                    {dialog === 'record_edit' && (
                      <div className="mb-4 rounded-xl border border-[#d8e5da] bg-[#f3f8f4] px-4 py-3 text-xs leading-5 text-[#55705e]">
                        현재 구독 만료일은{' '}
                        <strong className="text-[#315740]">
                          {formatDate(farmForm.currentSubscriptionExpiresAt)}
                        </strong>
                        입니다. 만료일·상태·갱신횟수는 관리대장의 ‘만료일’ 또는
                        ‘구독 처리’에서 변경해 주세요.
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field>
                        <FieldLabel>보증기간(년)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={farmForm.warrantyYears}
                          onChange={(event) => {
                            const years = Number(event.target.value);
                            setFarmForm((current) => ({
                              ...current,
                              warrantyYears: years,
                              warrantyExpiresAt: current.installationDate
                                ? addYears(current.installationDate, years)
                                : current.warrantyExpiresAt,
                            }));
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>보증 만료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.warrantyExpiresAt}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              warrantyExpiresAt: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>구독기간(년)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={farmForm.subscriptionYears}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              subscriptionYears: Number(event.target.value),
                            }))
                          }
                        />
                      </Field>
                      {dialog !== 'record_edit' && (
                        <Field>
                          <FieldLabel>구독 상태</FieldLabel>
                          <Select
                            value={farmForm.subscriptionStatus}
                            onValueChange={(value) =>
                              setFarmForm((current) => ({
                                ...current,
                                subscriptionStatus: value as SubscriptionStatus,
                              }))
                            }
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue>
                                {
                                  SUBSCRIPTION_STATUS_LABELS[
                                    farmForm.subscriptionStatus
                                  ]
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">사용중</SelectItem>
                              <SelectItem value="expired">만료</SelectItem>
                              <SelectItem value="unregistered">
                                미등록
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                      <Field>
                        <FieldLabel>최초 구독 만료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.initialSubscriptionExpiresAt}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              initialSubscriptionExpiresAt: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      {dialog !== 'record_edit' && (
                        <Field>
                          <FieldLabel>현재 구독 만료일</FieldLabel>
                          <Input
                            type="date"
                            value={farmForm.currentSubscriptionExpiresAt}
                            onChange={(event) =>
                              setFarmForm((current) => ({
                                ...current,
                                currentSubscriptionExpiresAt:
                                  event.target.value,
                              }))
                            }
                          />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel>마지막 입금일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.lastPaymentDate}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              lastPaymentDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      {dialog !== 'record_edit' && (
                        <Field>
                          <FieldLabel>갱신횟수</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            value={farmForm.renewalCount}
                            onChange={(event) =>
                              setFarmForm((current) => ({
                                ...current,
                                renewalCount: Number(event.target.value),
                              }))
                            }
                          />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel>등록자</FieldLabel>
                        <Input
                          value={farmForm.recorder}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              recorder: event.target.value,
                            }))
                          }
                          placeholder="기록한 담당자"
                        />
                      </Field>
                    </div>
                  </section>
                </>
              )}
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting || farmLocationBusy}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || farmLocationBusy}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  {dialog === 'farm'
                    ? '관리대장 등록'
                    : dialog === 'farm_edit'
                      ? '기본정보 저장'
                      : dialog === 'record_add'
                        ? '참여 사업 추가'
                        : '설치·구독 저장'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'inbox'}
          onOpenChange={(open) =>
            !submitting && !imagesBusy && setDialog(open ? 'inbox' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[660px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">빠른 수신</DialogTitle>
              <DialogDescription>
                프로젝트를 선택하면 수신함에 보관하면서 하위 업무로 바로
                등록합니다. 아직 프로젝트를 모르면 미지정으로 담아두세요.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitInbox} className="mt-1 space-y-4">
              <Field>
                <FieldLabel>프로젝트</FieldLabel>
                <Select
                  value={inboxForm.projectId || 'unassigned'}
                  onValueChange={(value) =>
                    setInboxForm((current) => ({
                      ...current,
                      projectId: value === 'unassigned' ? '' : value || '',
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      {inboxForm.projectId
                        ? projectSelectLabel(inboxForm.projectId, true)
                        : '미지정 · 수신함에만 보관'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      미지정 · 수신함에만 보관
                    </SelectItem>
                    {activeProjects
                      .filter((project) => project.status !== 'completed')
                      .map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.year} · {project.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              {inboxForm.projectId && (
                <Field>
                  <FieldLabel>하위 업무명</FieldLabel>
                  <Input
                    value={inboxForm.taskTitle}
                    maxLength={160}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        taskTitle: event.target.value,
                      }))
                    }
                    placeholder="예: 견적서 제출 / 문의사항 피드백 후 제출"
                  />
                  <p className="text-xs text-slate-500">
                    미입력 시 받은 내용의 첫 부분을 업무명으로 사용합니다. 최초
                    담당자는 기록자이며 이후 변경할 수 있습니다.
                  </p>
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>수신 경로</FieldLabel>
                  <Select
                    value={inboxForm.channel}
                    onValueChange={(value) =>
                      setInboxForm((current) => ({
                        ...current,
                        channel: value as HistoryChannel,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {FARM_HISTORY_CHANNEL_LABELS[inboxForm.channel]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">메일</SelectItem>
                      <SelectItem value="kakao">카톡</SelectItem>
                      <SelectItem value="verbal">구두</SelectItem>
                      <SelectItem value="phone">전화</SelectItem>
                      <SelectItem value="meeting">회의</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>받은 일시</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={inboxForm.receivedAt}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        receivedAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>전달자·기관</FieldLabel>
                  <Input
                    value={inboxForm.sender}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        sender: event.target.value,
                      }))
                    }
                    placeholder="예: 홍길동 농가, ○○사업단"
                  />
                </Field>
                <Field>
                  <FieldLabel>기록자</FieldLabel>
                  <Input
                    value={inboxForm.capturedBy}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        capturedBy: event.target.value,
                      }))
                    }
                    placeholder="내용을 옮긴 담당자"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>받은 내용</FieldLabel>
                  <ReceivedContentInput
                    images={draftImages}
                    onImagesChange={setDraftImages}
                    onBusyChange={setImagesBusy}
                    disabled={submitting || imagesBusy}
                    value={inboxForm.content}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    placeholder="메일·카톡·전화·구두로 받은 내용을 빠짐없이 붙여 넣으세요."
                    className="min-h-36"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>참고 링크</FieldLabel>
                  <Input
                    type="url"
                    value={inboxForm.referenceUrl}
                    onChange={(event) =>
                      setInboxForm((current) => ({
                        ...current,
                        referenceUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </Field>
              </div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting || imagesBusy}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || imagesBusy}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}수신함에
                  담기
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'inbox_route'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'inbox_route' : null)
          }
        >
          <DialogContent className="p-5 sm:max-w-[600px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                수신 내용을 업무로 정리
              </DialogTitle>
              <DialogDescription>
                프로젝트를 선택하면 농가 없이 하위 업무로 등록합니다. 농가별
                업무는 아래 농가·참여 사업을 선택해 정리할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-1 space-y-4">
              <Field>
                <FieldLabel>프로젝트 하위 업무로 연결</FieldLabel>
                <Select
                  value={inboxRouteProjectId || 'none'}
                  onValueChange={(value) =>
                    setInboxRouteProjectId(value === 'none' ? '' : value || '')
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      {inboxRouteProjectId
                        ? projectSelectLabel(inboxRouteProjectId, true)
                        : '프로젝트 선택'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      선택 안 함 · 농가별 업무로 정리
                    </SelectItem>
                    {activeProjects
                      .filter((project) => project.status !== 'completed')
                      .map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.year} · {project.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="rounded-xl bg-[#f5f8f4] p-3 text-sm leading-6">
                {
                  workspace.inboxItems.find(
                    (item) => item.id === clarifyingInboxId,
                  )?.content
                }
                <ReceivedImages
                  imageIds={
                    workspace.inboxItems.find(
                      (item) => item.id === clarifyingInboxId,
                    )?.imageIds
                  }
                />
              </div>
              {!inboxRouteProjectId && (
                <div className="space-y-4">
                  <Field>
                    <FieldLabel>농가 검색</FieldLabel>
                    <Input
                      value={inboxFarmSearch}
                      onChange={(event) =>
                        setInboxFarmSearch(event.target.value)
                      }
                      placeholder="농가명·농장번호·지역 검색"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>농가</FieldLabel>
                    <Select
                      value={inboxRouteFarmId}
                      onValueChange={(value) => {
                        const farmId = value ?? '';
                        const records = recordsByFarm.get(farmId) ?? [];
                        setInboxRouteFarmId(farmId);
                        setInboxRouteRecordId(
                          records.length === 1 ? records[0].id : '',
                        );
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="농가를 선택하세요">
                          {inboxRouteFarmId
                            ? farmSelectLabel(inboxRouteFarmId)
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {inboxRouteFarmOptions.map((farm) => (
                          <SelectItem key={farm.id} value={farm.id}>
                            {farm.name} · {farm.farmCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inboxRouteFarmOptions.length === 0 && (
                      <p className="text-xs text-[#8a938e]">
                        검색 조건에 맞는 참여 농가가 없습니다.
                      </p>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>참여 사업</FieldLabel>
                    <Select
                      value={inboxRouteRecordId}
                      onValueChange={(value) =>
                        setInboxRouteRecordId(value ?? '')
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="사업을 선택하세요">
                          {inboxRouteRecordId
                            ? recordSelectLabel(inboxRouteRecordId)
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(recordsByFarm.get(inboxRouteFarmId) ?? []).map(
                          (record) => (
                            <SelectItem key={record.id} value={record.id}>
                              {projectById.get(record.projectId)?.name ??
                                '사업 없음'}{' '}
                              · {record.deviceType || '장비 미입력'}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={continueInboxRoute}
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {inboxRouteProjectId
                    ? '프로젝트 하위 업무로 등록'
                    : '다음: 농가 업무 계획 작성'}{' '}
                  <ArrowRight />
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'work_item'}
          onOpenChange={(open) =>
            !submitting && !imagesBusy && setDialog(open ? 'work_item' : null)
          }
        >
          <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-[760px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {workItemForm.workType === 'service'
                  ? 'A/S 등록'
                  : workItemForm.workType === 'payment'
                    ? '입금 등록'
                    : '농가 업무 등록'}
              </DialogTitle>
              <DialogDescription>
                {selectedFarm?.name} 농가의 업무를 참여 사업에 연결하고 최초
                수신·처리 내용을 기록합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitWorkItem} className="mt-1 space-y-5">
              <section className="space-y-4">
                <Field>
                  <FieldLabel>연결 사업</FieldLabel>
                  <Select
                    value={workItemForm.farmRecordId}
                    onValueChange={(value) =>
                      setWorkItemForm((current) => ({
                        ...current,
                        farmRecordId: value ?? '',
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="업무를 연결할 사업을 선택하세요">
                        {workItemForm.farmRecordId
                          ? recordSelectLabel(workItemForm.farmRecordId)
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRecords.map((record) => (
                        <SelectItem key={record.id} value={record.id}>
                          {projectById.get(record.projectId)?.name ??
                            '사업 없음'}{' '}
                          · {record.deviceType || '장비 미입력'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selectedRecords.length > 1 && !workItemForm.farmRecordId && (
                  <p className="rounded-xl bg-[#fff6ef] px-3 py-2 text-xs text-[#9b613d]">
                    여러 사업에 참여 중입니다. 기록 오귀속을 막기 위해 사업을
                    직접 선택해 주세요.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>업무 유형</FieldLabel>
                    <Select
                      value={workItemForm.workType}
                      onValueChange={(value) =>
                        setWorkItemForm((current) => {
                          const workType = value as WorkType;
                          const knownTemplateValues = Object.values(
                            WORK_CHECKLIST_TEMPLATES,
                          ).map((items) => items.join('\n'));
                          const mayReplaceTemplate =
                            !current.checklistText.trim() ||
                            knownTemplateValues.includes(current.checklistText);
                          return {
                            ...current,
                            workType,
                            checklistText: mayReplaceTemplate
                              ? (WORK_CHECKLIST_TEMPLATES[workType] ?? []).join(
                                  '\n',
                                )
                              : current.checklistText,
                          };
                        })
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue>
                          {FARM_WORK_TYPE_LABELS[workItemForm.workType]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="communication">수신·연락</SelectItem>
                        <SelectItem value="installation">설치·교육</SelectItem>
                        <SelectItem value="subscription">구독</SelectItem>
                        <SelectItem value="payment">입금</SelectItem>
                        <SelectItem value="service">A/S</SelectItem>
                        <SelectItem value="note">관리 메모</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>현재 상태</FieldLabel>
                    <Select
                      value={workItemForm.status}
                      onValueChange={(value) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          status: value as WorkStatus,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue>
                          {FARM_WORK_STATUS_LABELS[workItemForm.status]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">접수</SelectItem>
                        <SelectItem value="in_progress">처리 중</SelectItem>
                        <SelectItem value="waiting">대기·막힘</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>업무 제목</FieldLabel>
                    <Input
                      value={workItemForm.title}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="예: 센서 게이트웨이 통신 불량 확인"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>담당자</FieldLabel>
                    <Input
                      value={workItemForm.owner}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          owner: event.target.value,
                        }))
                      }
                      placeholder="처리 담당자"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>처리 기한</FieldLabel>
                    <Input
                      type="date"
                      value={workItemForm.dueDate}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>우선순위</FieldLabel>
                    <Select
                      value={workItemForm.priority}
                      onValueChange={(value) => {
                        const priority = value as FarmWorkPriority;
                        setWorkItemForm((current) => ({
                          ...current,
                          priority,
                          responseDueAt: responseTargetValue(
                            priority,
                            current.occurredAt
                              ? new Date(current.occurredAt)
                              : new Date(),
                          ),
                        }));
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue>
                          {FARM_WORK_PRIORITY_LABELS[workItemForm.priority]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">높음</SelectItem>
                        <SelectItem value="medium">보통</SelectItem>
                        <SelectItem value="low">낮음</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>다시 볼 날짜</FieldLabel>
                    <Input
                      type="date"
                      value={workItemForm.reviewDate}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          reviewDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>최초 대응 목표</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={workItemForm.responseDueAt}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          responseDueAt: event.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] leading-5 text-[#7b877f]">
                      우선순위 기본값은 높음 24시간 · 보통 72시간 · 낮음
                      7일입니다. 필요하면 직접 바꿀 수 있습니다.
                    </p>
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>업무 설명</FieldLabel>
                    <Textarea
                      value={workItemForm.description}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="업무 범위, 확인 사항이나 다음 일정을 적어 주세요."
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>완료 기준</FieldLabel>
                    <Textarea
                      value={workItemForm.expectedOutcome}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          expectedOutcome: event.target.value,
                        }))
                      }
                      placeholder="어떤 상태가 되면 이 업무를 완료라고 판단할지 적어 주세요."
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>다음 행동</FieldLabel>
                    <Input
                      value={workItemForm.nextAction}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          nextAction: event.target.value,
                        }))
                      }
                      placeholder="예: 농가에 전화해 현장 방문 가능 시간을 확인한다"
                    />
                  </Field>
                  {workItemForm.status === 'waiting' && (
                    <div className="grid gap-4 rounded-2xl border border-[#ecd4c7] bg-[#fff8f3] p-4 sm:col-span-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="text-sm font-bold text-[#8d4f35]">
                          대기 사유를 구조화해 주세요
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#8f6a59]">
                          누구의 어떤 답을 기다리는지 명확해야 담당자가 바뀌어도
                          업무를 이어갈 수 있습니다.
                        </p>
                      </div>
                      <Field className="sm:col-span-2">
                        <FieldLabel>막힘 사유</FieldLabel>
                        <Textarea
                          required
                          value={workItemForm.blockedReason}
                          onChange={(event) =>
                            setWorkItemForm((current) => ({
                              ...current,
                              blockedReason: event.target.value,
                            }))
                          }
                          placeholder="예: 농가의 통신사 변경 확답을 기다리는 중"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>해제 책임자·회신 주체</FieldLabel>
                        <Input
                          required
                          value={workItemForm.blockedBy}
                          onChange={(event) =>
                            setWorkItemForm((current) => ({
                              ...current,
                              blockedBy: event.target.value,
                            }))
                          }
                          placeholder="예: 농가 김대표 / 통신사 담당자"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>예상 해제일</FieldLabel>
                        <Input
                          type="date"
                          value={workItemForm.expectedUnblockDate}
                          onChange={(event) =>
                            setWorkItemForm((current) => ({
                              ...current,
                              expectedUnblockDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  )}
                  <Field className="sm:col-span-2">
                    <FieldLabel>체크리스트</FieldLabel>
                    <Textarea
                      value={workItemForm.checklistText}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          checklistText: event.target.value,
                        }))
                      }
                      placeholder="한 줄에 한 항목씩 입력하세요. 업무 유형을 고르면 현장용 예시가 채워집니다."
                      className="min-h-28"
                    />
                  </Field>
                </div>
              </section>
              <section className="border-t border-[#e3e8e2] pt-5">
                <h3 className="mb-4 text-sm font-bold text-[#365644]">
                  최초 수신·처리 기록
                </h3>
                {clarifyingInboxId && (
                  <p className="mb-4 rounded-xl border border-[#d8e5d9] bg-[#f2f8f2] px-3 py-2 text-xs leading-5 text-[#53715d]">
                    수신함 원문은 기록의 신뢰성을 위해 수정할 수 없습니다. 새로
                    한 조치는 ‘처리 내용’에 입력하세요.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>수신 경로</FieldLabel>
                    <Select
                      value={workItemForm.channel}
                      disabled={Boolean(clarifyingInboxId)}
                      onValueChange={(value) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          channel: value as HistoryChannel,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue>
                          {FARM_HISTORY_CHANNEL_LABELS[workItemForm.channel]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">메일</SelectItem>
                        <SelectItem value="kakao">카톡</SelectItem>
                        <SelectItem value="verbal">구두</SelectItem>
                        <SelectItem value="phone">전화</SelectItem>
                        <SelectItem value="meeting">회의</SelectItem>
                        <SelectItem value="system">시스템</SelectItem>
                        <SelectItem value="other">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>발생 일시</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={workItemForm.occurredAt}
                      disabled={Boolean(clarifyingInboxId)}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          occurredAt: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>전달자·기관</FieldLabel>
                    <Input
                      value={workItemForm.sender}
                      disabled={Boolean(clarifyingInboxId)}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          sender: event.target.value,
                        }))
                      }
                      placeholder="받은 내용이 있다면 입력"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>금액(원)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step={workItemForm.workType === 'payment' ? 66000 : 1}
                      value={workItemForm.amount}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          amount: Number(event.target.value),
                        }))
                      }
                    />
                    {workItemForm.workType === 'payment' && (
                      <SubscriptionPaymentPreview
                        record={recordById.get(workItemForm.farmRecordId)}
                        amount={workItemForm.amount}
                        paymentDate={workItemForm.occurredAt.slice(0, 10)}
                        today={subscriptionToday}
                        paymentCount={Math.max(
                          recordedPayments.get(workItemForm.farmRecordId)
                            ?.count ?? 0,
                          recordById.get(workItemForm.farmRecordId)
                            ?.subscriptionPaymentCount ?? 0,
                        )}
                      />
                    )}
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>받은 내용</FieldLabel>
                    <ReceivedContentInput
                      images={draftImages}
                      onImagesChange={setDraftImages}
                      onBusyChange={setImagesBusy}
                      value={workItemForm.receivedContent}
                      disabled={Boolean(clarifyingInboxId)}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          receivedContent: event.target.value,
                        }))
                      }
                      placeholder="메일·카톡·전화·구두로 전달받은 내용을 적어 주세요."
                      className="min-h-24"
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>처리 내용</FieldLabel>
                    <Textarea
                      value={workItemForm.actionContent}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          actionContent: event.target.value,
                        }))
                      }
                      placeholder="확인, 조치, 회신 등 지금까지 처리한 내용을 적어 주세요."
                      className="min-h-24"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>기록자</FieldLabel>
                    <Input
                      value={workItemForm.recorder}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          recorder: event.target.value,
                        }))
                      }
                      placeholder="기록한 담당자"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>참고 링크</FieldLabel>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                      <Input
                        type="url"
                        value={workItemForm.referenceUrl}
                        disabled={Boolean(clarifyingInboxId)}
                        onChange={(event) =>
                          setWorkItemForm((current) => ({
                            ...current,
                            referenceUrl: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="pl-9"
                      />
                    </div>
                  </Field>
                </div>
              </section>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting || imagesBusy}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || imagesBusy}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  {workItemForm.workType === 'service'
                    ? 'A/S 등록'
                    : workItemForm.workType === 'payment'
                      ? '입금 등록'
                      : '업무 등록'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'history'}
          onOpenChange={(open) =>
            !submitting && !imagesBusy && setDialog(open ? 'history' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[700px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">진행 기록 추가</DialogTitle>
              <DialogDescription>
                {selectedWorkItem?.title} 업무의 계획을 정리하거나 새 수신·처리
                내용을 남깁니다. 내용 없이 계획만 저장해도 됩니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitHistory} className="mt-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>수신 경로</FieldLabel>
                  <Select
                    value={historyForm.channel}
                    onValueChange={(value) =>
                      setHistoryForm((current) => ({
                        ...current,
                        channel: value as HistoryChannel,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {FARM_HISTORY_CHANNEL_LABELS[historyForm.channel]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">메일</SelectItem>
                      <SelectItem value="kakao">카톡</SelectItem>
                      <SelectItem value="verbal">구두</SelectItem>
                      <SelectItem value="phone">전화</SelectItem>
                      <SelectItem value="meeting">회의</SelectItem>
                      <SelectItem value="system">시스템</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>변경 상태</FieldLabel>
                  <Select
                    value={historyForm.newStatus}
                    onValueChange={(value) => {
                      const newStatus = value as WorkStatus;
                      setHistoryForm((current) => ({
                        ...current,
                        newStatus,
                        responseDueAt:
                          newStatus === 'completed' && selectedWorkItem
                            ? selectedWorkItem.responseDueAt
                              ? localDateTimeValue(
                                  new Date(selectedWorkItem.responseDueAt),
                                )
                              : ''
                            : current.responseDueAt,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {FARM_WORK_STATUS_LABELS[historyForm.newStatus]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">접수</SelectItem>
                      <SelectItem value="in_progress">처리 중</SelectItem>
                      <SelectItem value="waiting">대기·막힘</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>담당자</FieldLabel>
                  <Input
                    value={historyForm.owner}
                    disabled={Boolean(selectedWorkItem?.assigneeUid)}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        owner: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>처리 기한</FieldLabel>
                  <Input
                    type="date"
                    value={historyForm.dueDate}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>우선순위</FieldLabel>
                  <Select
                    value={historyForm.priority}
                    onValueChange={(value) =>
                      setHistoryForm((current) => ({
                        ...current,
                        priority: value as FarmWorkPriority,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {FARM_WORK_PRIORITY_LABELS[historyForm.priority]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">높음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="low">낮음</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>다시 볼 날짜</FieldLabel>
                  <Input
                    type="date"
                    value={historyForm.reviewDate}
                    disabled={historyForm.newStatus === 'completed'}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        reviewDate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>최초 대응 목표</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={historyForm.responseDueAt}
                    disabled={
                      Boolean(selectedWorkItem?.respondedAt) ||
                      historyForm.markResponded ||
                      historyForm.newStatus === 'completed'
                    }
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        responseDueAt: event.target.value,
                      }))
                    }
                  />
                  {(Boolean(selectedWorkItem?.respondedAt) ||
                    historyForm.markResponded ||
                    historyForm.newStatus === 'completed') && (
                    <p className="text-[11px] leading-5 text-[#7b877f]">
                      최초 대응을 기록할 때 기존 목표와 판정 기준을 함께
                      잠급니다.
                    </p>
                  )}
                </Field>
                {selectedWorkItem && selectedWorkItem.respondedAt === 0 && (
                  <button
                    type="button"
                    aria-pressed={historyForm.markResponded}
                    onClick={() =>
                      setHistoryForm((current) => {
                        const markResponded = !current.markResponded;
                        return {
                          ...current,
                          markResponded,
                          responseDueAt:
                            markResponded && selectedWorkItem
                              ? selectedWorkItem.responseDueAt
                                ? localDateTimeValue(
                                    new Date(selectedWorkItem.responseDueAt),
                                  )
                                : ''
                              : current.responseDueAt,
                        };
                      })
                    }
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left sm:col-span-2 ${
                      historyForm.markResponded
                        ? 'border-[#bcdcc5] bg-[#eef8f1]'
                        : 'border-[#dce4dd] bg-[#fafbf9]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
                        historyForm.markResponded
                          ? 'border-[#4e9768] bg-[#4e9768] text-white'
                          : 'border-[#b7c2ba] bg-white'
                      }`}
                    >
                      {historyForm.markResponded && (
                        <Check className="size-3.5" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        최초 대응 완료로 기록
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#738078]">
                        농가 또는 전달자에게 처음 회신·안내한 기록이라면
                        선택하세요. 완료 상태로 바꾸면 자동으로 처리됩니다.
                      </span>
                    </span>
                  </button>
                )}
                <Field className="sm:col-span-2">
                  <FieldLabel>다음 행동</FieldLabel>
                  <Input
                    value={historyForm.nextAction}
                    disabled={historyForm.newStatus === 'completed'}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        nextAction: event.target.value,
                      }))
                    }
                    placeholder={
                      historyForm.newStatus === 'completed'
                        ? '완료 업무에는 다음 행동이 없습니다.'
                        : '이번 기록 이후 바로 할 한 가지 행동'
                    }
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>완료 기준</FieldLabel>
                  <Textarea
                    value={historyForm.expectedOutcome}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        expectedOutcome: event.target.value,
                      }))
                    }
                    placeholder="완료됐다고 판단할 기준"
                  />
                </Field>
                {historyForm.newStatus === 'waiting' && (
                  <div className="grid gap-4 rounded-2xl border border-[#ecd4c7] bg-[#fff8f3] p-4 sm:col-span-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="text-sm font-bold text-[#8d4f35]">
                        대기 사유와 해제 책임자를 남겨 주세요
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#8f6a59]">
                        단순히 ‘대기’라고만 남기지 않고, 무엇이 풀려야 다시
                        진행되는지 기록합니다.
                      </p>
                    </div>
                    <Field className="sm:col-span-2">
                      <FieldLabel>막힘 사유</FieldLabel>
                      <Textarea
                        required
                        value={historyForm.blockedReason}
                        onChange={(event) =>
                          setHistoryForm((current) => ({
                            ...current,
                            blockedReason: event.target.value,
                          }))
                        }
                        placeholder="예: 장비 교체 승인을 기다리는 중"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>해제에 필요한 사람·기관</FieldLabel>
                      <Input
                        required
                        value={historyForm.blockedBy}
                        onChange={(event) =>
                          setHistoryForm((current) => ({
                            ...current,
                            blockedBy: event.target.value,
                          }))
                        }
                        placeholder="예: 사업 담당 주무관"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>예상 해제일</FieldLabel>
                      <Input
                        type="date"
                        value={historyForm.expectedUnblockDate}
                        onChange={(event) =>
                          setHistoryForm((current) => ({
                            ...current,
                            expectedUnblockDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                )}
                <Field>
                  <FieldLabel>발생 일시</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={historyForm.occurredAt}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        occurredAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>전달자·기관</FieldLabel>
                  <Input
                    value={historyForm.sender}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        sender: event.target.value,
                      }))
                    }
                    placeholder="새로 받은 내용이 있다면 입력"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>받은 내용</FieldLabel>
                  <ReceivedContentInput
                    images={draftImages}
                    onImagesChange={setDraftImages}
                    onBusyChange={setImagesBusy}
                    disabled={submitting || imagesBusy}
                    value={historyForm.receivedContent}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        receivedContent: event.target.value,
                      }))
                    }
                    placeholder="추가로 전달받은 내용을 적어 주세요."
                    className="min-h-24"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>
                    {selectedWorkItem?.status === 'waiting' &&
                    historyForm.newStatus !== 'waiting'
                      ? '막힘 해제 결과·처리 내용'
                      : '처리 내용'}
                  </FieldLabel>
                  <Textarea
                    required={
                      selectedWorkItem?.status === 'waiting' &&
                      historyForm.newStatus !== 'waiting'
                    }
                    value={historyForm.actionContent}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        actionContent: event.target.value,
                      }))
                    }
                    placeholder="이번에 확인하거나 처리한 내용과 다음 일정을 적어 주세요."
                    className="min-h-24"
                  />
                  {selectedWorkItem?.status === 'waiting' &&
                    historyForm.newStatus !== 'waiting' && (
                      <p className="text-[11px] leading-5 text-[#8f6a59]">
                        무엇이 해결되어 다시 진행할 수 있는지 남겨야 막힘 이력이
                        닫힙니다.
                      </p>
                    )}
                </Field>
                <Field
                  className={
                    selectedWorkItem && isStandaloneWork(selectedWorkItem)
                      ? 'hidden'
                      : undefined
                  }
                >
                  <FieldLabel>금액(원)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step={selectedWorkItem?.workType === 'payment' ? 66000 : 1}
                    value={historyForm.amount}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        amount: Number(event.target.value),
                      }))
                    }
                  />
                  {selectedWorkItem?.workType === 'payment' && (
                    <SubscriptionPaymentPreview
                      record={recordById.get(selectedWorkItem.farmRecordId)}
                      amount={historyForm.amount}
                      paymentDate={historyForm.occurredAt.slice(0, 10)}
                      today={subscriptionToday}
                      paymentCount={Math.max(
                        recordedPayments.get(selectedWorkItem.farmRecordId)
                          ?.count ?? 0,
                        recordById.get(selectedWorkItem.farmRecordId)
                          ?.subscriptionPaymentCount ?? 0,
                      )}
                    />
                  )}
                </Field>
                <Field>
                  <FieldLabel>기록자</FieldLabel>
                  <Input
                    value={historyForm.recorder}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        recorder: event.target.value,
                      }))
                    }
                    placeholder="기록한 담당자"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>참고 링크</FieldLabel>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                    <Input
                      type="url"
                      value={historyForm.referenceUrl}
                      onChange={(event) =>
                        setHistoryForm((current) => ({
                          ...current,
                          referenceUrl: event.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>
              {historyForm.newStatus === 'completed' &&
                selectedChecklist.some((item) => !item.isCompleted) && (
                  <p className="rounded-xl bg-[#fff1ec] px-3 py-2 text-xs text-[#9d4e34]">
                    미완료 체크리스트가 있습니다. 모두 확인한 뒤 업무를 완료해
                    주세요.
                  </p>
                )}
              {historyForm.newStatus === 'completed' &&
                selectedVisits.some(
                  (visit) => visit.status === 'scheduled',
                ) && (
                  <p className="rounded-xl bg-[#fff1ec] px-3 py-2 text-xs text-[#9d4e34]">
                    예정된 현장 방문이 있습니다. 방문을 완료하거나 취소한 뒤
                    업무를 완료해 주세요.
                  </p>
                )}
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting || imagesBusy}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || imagesBusy}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}진행 기록
                  저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'visit'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'visit' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[640px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {visitForm.id ? '현장 방문 일정 수정' : '현장 방문 추가'}
              </DialogTitle>
              <DialogDescription>
                {selectedWorkItem?.title} 업무의 방문 일정과 실제 조치 결과를
                남깁니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitVisit} className="mt-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>방문 예정 일시</FieldLabel>
                  <Input
                    required
                    type="datetime-local"
                    value={visitForm.scheduledAt}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        scheduledAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>방문 담당자</FieldLabel>
                  <Input
                    required
                    value={visitForm.assignedTo}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        assignedTo: event.target.value,
                      }))
                    }
                    placeholder="현장 방문 담당자"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>방문 상태</FieldLabel>
                  <Select
                    value={visitForm.status}
                    onValueChange={(value) => {
                      const status = value as FarmVisitStatus;
                      const now = new Date();
                      const startedAt = new Date(
                        now.getTime() - 60 * 60 * 1000,
                      );
                      setVisitForm((current) => ({
                        ...current,
                        status,
                        actualStartedAt:
                          status === 'completed' && !current.actualStartedAt
                            ? localDateTimeValue(startedAt)
                            : status === 'completed'
                              ? current.actualStartedAt
                              : '',
                        actualEndedAt:
                          status === 'completed' && !current.actualEndedAt
                            ? localDateTimeValue(now)
                            : status === 'completed'
                              ? current.actualEndedAt
                              : '',
                        result: status === current.status ? current.result : '',
                        nextVisitAt:
                          status === 'scheduled' ? '' : current.nextVisitAt,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {FARM_VISIT_STATUS_LABELS[visitForm.status]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">예정</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="canceled">취소</SelectItem>
                    </SelectContent>
                  </Select>
                  {!visitForm.id && visitForm.status !== 'scheduled' && (
                    <p className="mt-1 text-[11px] leading-5 text-[#8f6a59]">
                      이미 끝난 방문을 소급 기록할 때만 선택하세요. 저장한
                      완료·취소 증빙은 수정할 수 없습니다.
                    </p>
                  )}
                </Field>
                {visitForm.status === 'completed' && (
                  <>
                    <Field>
                      <FieldLabel>실제 시작 일시</FieldLabel>
                      <Input
                        required
                        type="datetime-local"
                        value={visitForm.actualStartedAt}
                        onChange={(event) =>
                          setVisitForm((current) => ({
                            ...current,
                            actualStartedAt: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>실제 완료 일시</FieldLabel>
                      <Input
                        required
                        type="datetime-local"
                        value={visitForm.actualEndedAt}
                        onChange={(event) =>
                          setVisitForm((current) => ({
                            ...current,
                            actualEndedAt: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </>
                )}
                <Field className="sm:col-span-2">
                  <FieldLabel>방문 준비 메모</FieldLabel>
                  <Textarea
                    value={visitForm.preparationNote}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        preparationNote: event.target.value,
                      }))
                    }
                    placeholder="준비할 부품·장비나 농가 요청사항을 적어 주세요."
                    className="min-h-20"
                  />
                </Field>
                {visitForm.status !== 'scheduled' && (
                  <Field className="sm:col-span-2">
                    <FieldLabel>
                      {visitForm.status === 'canceled'
                        ? '취소 사유'
                        : '현장 조치 결과'}
                    </FieldLabel>
                    <Textarea
                      required
                      value={visitForm.result}
                      onChange={(event) =>
                        setVisitForm((current) => ({
                          ...current,
                          result: event.target.value,
                        }))
                      }
                      placeholder={
                        visitForm.status === 'completed'
                          ? '증상, 원인, 조치, 농가 확인 결과를 적어 주세요.'
                          : '방문을 취소한 이유와 다시 잡을 계획을 적어 주세요.'
                      }
                      className="min-h-28"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel>기록자</FieldLabel>
                  <Input
                    required
                    value={visitForm.recordedBy}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        recordedBy: event.target.value,
                      }))
                    }
                    placeholder="일정을 등록하거나 결과를 기록한 사람"
                  />
                </Field>
                {visitForm.status !== 'scheduled' && (
                  <Field>
                    <FieldLabel>후속 방문 일시</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={visitForm.nextVisitAt}
                      onChange={(event) =>
                        setVisitForm((current) => ({
                          ...current,
                          nextVisitAt: event.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] leading-5 text-[#7b877f]">
                      입력하면 같은 담당자의 새 방문 일정이 실제 작업함에
                      등록됩니다.
                    </p>
                  </Field>
                )}
              </div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  방문 기록 저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </Toaster>
  );
}
