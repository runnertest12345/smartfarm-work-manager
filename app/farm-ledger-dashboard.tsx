'use client';

import {
  useCallback,
  useEffect,
  useMemo,
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
  Building2,
  CalendarCheck2,
  CalendarClock,
  CircleAlert,
  Check,
  CheckCircle2,
  ClipboardList,
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
  Warehouse,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import {
  FARM_HISTORY_CHANNEL_LABELS,
  FARM_INBOX_STATUS_LABELS,
  FARM_PROJECT_STATUS_LABELS,
  FARM_PROJECT_TYPE_LABELS,
  FARM_VISIT_STATUS_LABELS,
  FARM_WORK_STATUS_LABELS,
  FARM_WORK_PRIORITY_LABELS,
  FARM_WORK_TYPE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type Farm,
  type FarmHistoryEntry,
  type FarmInboxItem,
  type FarmInput,
  type FarmLedgerWorkspace,
  type FarmProjectInput,
  type FarmProjectStatus,
  type FarmProjectType,
  type FarmRecord,
  type FarmRecordInput,
  type FarmVisitStatus,
  type FarmWorkItem,
  type FarmWorkVisit,
  type FarmWorkPriority,
  type SubscriptionStatus,
} from '@/lib/farm-types';

type View =
  | 'overview'
  | 'work'
  | 'farms'
  | 'projects'
  | 'business'
  | 'subscriptions'
  | 'service'
  | 'quality';
type DialogKind =
  | 'farm'
  | 'farm_edit'
  | 'record_add'
  | 'record_edit'
  | 'project'
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
type HistoryChannel = FarmHistoryEntry['channel'];

const FARM_LOG_TYPE_LABELS = FARM_WORK_TYPE_LABELS;
const FARM_LOG_STATUS_LABELS = FARM_WORK_STATUS_LABELS;
const FARM_LOG_CHANNEL_LABELS = FARM_HISTORY_CHANNEL_LABELS;

interface FarmForm extends FarmInput, FarmRecordInput {
  recorder: string;
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

interface InboxForm {
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
  category: 'duplicate' | 'contact' | 'installation' | 'subscription';
  title: string;
  description: string;
  severity: 'high' | 'medium';
}

const emptyWorkspace: FarmLedgerWorkspace = {
  projects: [],
  farms: [],
  records: [],
  inboxItems: [],
  workItems: [],
  blockerEpisodes: [],
  visits: [],
  checklistItems: [],
  historyEntries: [],
};

const WORK_IN_PROGRESS_LIMIT = 5;
const WORK_COLUMNS: Array<{ status: WorkStatus; description: string }> = [
  { status: 'open', description: '아직 시작하지 않은 업무' },
  { status: 'in_progress', description: '지금 집중해서 처리 중' },
  { status: 'waiting', description: '회신·부품·일정 대기' },
  { status: 'completed', description: '최근 7일 내 완료' },
];

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

const sourceSheetUrl =
  'https://docs.google.com/spreadsheets/d/1EHwCMPR6Nm7A1oCq2EjrSd6tkrH8EufK8liYfCR2KCk/edit?gid=1284515894#gid=1284515894';

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

function emptyProjectForm(): FarmProjectInput {
  return {
    name: '',
    projectType: 'general',
    year: new Date().getFullYear(),
    institution: '',
    status: 'active',
    description: '',
    targetFarmCount: 0,
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
    channel: 'kakao',
    sender: '',
    content: '',
    capturedBy: '',
    receivedAt: localDateTimeValue(),
    referenceUrl: '',
  };
}

function subscriptionClass(status: SubscriptionStatus) {
  if (status === 'active')
    return 'border-[#bfe3cb] bg-[#edf8f1] text-[#28744f]';
  if (status === 'expired')
    return 'border-[#f0cdbb] bg-[#fff4ed] text-[#ac5a32]';
  return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
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
    record.productionSetupDate,
    record.installationDate,
    record.commissioningDate,
    record.educationDate,
  ];
  return { complete: stages.filter(Boolean).length, total: stages.length };
}

async function readResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & { error?: string };
}

export function FarmLedgerDashboard() {
  const [workspace, setWorkspace] =
    useState<FarmLedgerWorkspace>(emptyWorkspace);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riskNow, setRiskNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<
    'all' | SubscriptionStatus
  >('all');
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
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('');
  const [editingRecordId, setEditingRecordId] = useState('');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [projectForm, setProjectForm] =
    useState<FarmProjectInput>(emptyProjectForm);
  const [farmForm, setFarmForm] = useState<FarmForm>(() => emptyFarmForm(''));
  const [workItemForm, setWorkItemForm] = useState<WorkItemForm>(() =>
    emptyWorkItemForm(),
  );
  const [historyForm, setHistoryForm] = useState<HistoryForm>(() =>
    emptyHistoryForm(),
  );
  const [visitForm, setVisitForm] = useState<VisitForm>(() => emptyVisitForm());
  const [inboxForm, setInboxForm] = useState<InboxForm>(() => emptyInboxForm());
  const [clarifyingInboxId, setClarifyingInboxId] = useState('');
  const [inboxRouteFarmId, setInboxRouteFarmId] = useState('');
  const [inboxRouteRecordId, setInboxRouteRecordId] = useState('');
  const [inboxFarmSearch, setInboxFarmSearch] = useState('');
  const [checklistActor, setChecklistActor] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/farm-ledger', { cache: 'no-store' });
      const data = (await readResponse(
        response,
      )) as unknown as FarmLedgerWorkspace & { error?: string };
      if (
        !response.ok ||
        !Array.isArray(data.farms) ||
        !Array.isArray(data.inboxItems) ||
        !Array.isArray(data.workItems) ||
        !Array.isArray(data.blockerEpisodes) ||
        !Array.isArray(data.visits) ||
        !Array.isArray(data.checklistItems) ||
        !Array.isArray(data.historyEntries)
      ) {
        throw new Error(data.error || '관리대장을 불러오지 못했습니다.');
      }
      setWorkspace(data);
      setSelectedFarmId((current) =>
        data.farms.some((farm) => farm.id === current) ? current : '',
      );
      setSelectedWorkItemId((current) =>
        data.workItems.some((workItem) => workItem.id === current)
          ? current
          : '',
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : '관리대장을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

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

  const selectedFarm = farmById.get(selectedFarmId) ?? null;
  const selectedRecords = selectedFarm
    ? (recordsByFarm.get(selectedFarm.id) ?? [])
    : [];
  const selectedWorkItems = selectedFarm
    ? (workItemsByFarm.get(selectedFarm.id) ?? [])
    : [];
  const selectedWorkItem = workItemById.get(selectedWorkItemId) ?? null;
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
    const record = recordById.get(workItem.farmRecordId);
    return record ? (projectById.get(record.projectId) ?? null) : null;
  }

  function latestEntryWith(
    workItem: FarmWorkItem,
    field: 'receivedContent' | 'actionContent',
  ) {
    return (
      (historiesByWorkItem.get(workItem.id) ?? []).find((entry) =>
        entry[field].trim(),
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

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return workspace.farms
      .filter((farm) => {
        const records = recordsByFarm.get(farm.id) ?? [];
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
          projectFilter === 'all' ||
          records.some((record) => record.projectId === projectFilter);
        const matchesSubscription =
          subscriptionFilter === 'all' ||
          records.some(
            (record) => record.subscriptionStatus === subscriptionFilter,
          );
        return (
          (!query || text.includes(query)) &&
          matchesProject &&
          matchesSubscription
        );
      })
      .sort((a, b) => farmLastActivity(b) - farmLastActivity(a));
  }, [
    historiesByWorkItem,
    farmLastActivity,
    projectById,
    projectFilter,
    recordsByFarm,
    search,
    subscriptionFilter,
    workItemsByFarm,
    workspace.farms,
  ]);

  const filteredWorkItems = useMemo(() => {
    const query = workSearch.trim().toLocaleLowerCase('ko-KR');
    return workspace.workItems
      .filter((workItem) => {
        const farm = farmById.get(workItem.farmId);
        const record = recordById.get(workItem.farmRecordId);
        const project = record ? projectById.get(record.projectId) : null;
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
          (workTypeFilter === 'all' || workItem.workType === workTypeFilter) &&
          (workStatusFilter === 'all' || workItem.status === workStatusFilter)
        );
      })
      .sort((a, b) => {
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
    workTypeFilter,
    workspace.workItems,
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
  const totalInProgressCount = workspace.workItems.filter(
    (item) => item.status === 'in_progress' || item.status === 'waiting',
  ).length;
  const today = localDateString();
  const sevenDaysAgo =
    new Date(`${today}T00:00:00`).getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentCompletedWorkItems = workspace.workItems.filter(
    (item) => item.status === 'completed' && item.completedAt >= sevenDaysAgo,
  );
  const missingNextActionWorkItems = workspace.workItems.filter(
    (item) => item.status !== 'completed' && !item.nextAction.trim(),
  );
  const reviewDueWorkItems = workspace.workItems.filter(
    (item) =>
      item.status !== 'completed' &&
      item.reviewDate &&
      item.reviewDate <= today,
  );
  const staleWaitingWorkItems = workspace.workItems.filter(
    (item) => item.status === 'waiting' && item.blockedAt < sevenDaysAgo,
  );
  const overdueWorkItems = workspace.workItems.filter((workItem) => {
    const days = daysUntil(workItem.dueDate);
    return workItem.status !== 'completed' && days !== null && days < 0;
  });
  const dueSoonWorkItems = workspace.workItems.filter((workItem) => {
    const days = daysUntil(workItem.dueDate);
    return (
      workItem.status !== 'completed' && days !== null && days >= 0 && days <= 7
    );
  });
  const pendingResponseWorkItems = workspace.workItems
    .filter(
      (item) =>
        item.status !== 'completed' &&
        item.responseDueAt > 0 &&
        item.respondedAt === 0,
    )
    .sort((a, b) => a.responseDueAt - b.responseDueAt);
  const untargetedResponseWorkItems = workspace.workItems
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
  const blockedWorkItems = workspace.workItems
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
        visit.status === 'scheduled' &&
        visit.scheduledAt < startOfToday + 8 * 86400000,
    )
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const todayVisits = visitQueue.filter(
    (visit) =>
      visit.scheduledAt >= startOfToday && visit.scheduledAt < endOfToday,
  );
  const ownerLoadSummaries = [
    ...workspace.workItems
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
  const projectHealthSummaries = workspace.projects
    .filter((project) => project.status === 'active')
    .map((project) => {
      const items = workspace.workItems.filter(
        (item) => recordById.get(item.farmRecordId)?.projectId === project.id,
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
    ...new Set(workspace.projects.map((project) => project.year)),
  ].sort((a, b) => b - a);
  const businessProjects = workspace.projects.filter(
    (project) =>
      (businessYearFilter === 'all' ||
        project.year === Number(businessYearFilter)) &&
      (businessTypeFilter === 'all' ||
        project.projectType === businessTypeFilter),
  );
  const businessProjectIds = new Set(
    businessProjects.map((project) => project.id),
  );
  const businessRecords = workspace.records.filter((record) =>
    businessProjectIds.has(record.projectId),
  );
  const businessProjectSummaries = businessProjects.map((project) => {
    const records = businessRecords.filter(
      (record) => record.projectId === project.id,
    );
    const production = records.filter(
      (record) => record.productionSetupDate,
    ).length;
    const installation = records.filter(
      (record) => record.installationDate,
    ).length;
    const commissioning = records.filter(
      (record) => record.commissioningDate,
    ).length;
    const education = records.filter((record) => record.educationDate).length;
    const progress = records.length
      ? Math.round(
          ((production + installation + commissioning + education) /
            (records.length * 4)) *
            100,
        )
      : 0;
    return {
      project,
      records,
      production,
      installation,
      commissioning,
      education,
      progress,
    };
  });
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
  const paymentFarmCount = new Set(
    paymentHistory.map(({ workItem }) => workItem.farmId),
  ).size;
  const averagePayment = paymentFarmCount
    ? Math.round(
        paymentHistory.reduce((sum, { entry }) => sum + entry.amount, 0) /
          paymentFarmCount,
      )
    : 0;
  const expiringSoonRecords = workspace.records.filter((record) => {
    const days = daysUntil(record.currentSubscriptionExpiresAt);
    return (
      record.subscriptionStatus === 'active' &&
      days !== null &&
      days >= 0 &&
      days <= 90
    );
  });
  const monthlyPayments = countValues(
    paymentHistory.map(({ entry }) =>
      localDateString(new Date(entry.occurredAt)).slice(0, 7),
    ),
  )
    .map((month) => ({
      ...month,
      amount: paymentHistory
        .filter(({ entry }) =>
          localDateString(new Date(entry.occurredAt)).startsWith(month.label),
        )
        .reduce((sum, { entry }) => sum + entry.amount, 0),
    }))
    .sort((a, b) => b.label.localeCompare(a.label))
    .slice(0, 6);

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
    for (const record of workspace.records) {
      const farm = farmById.get(record.farmId);
      if (!record.installationDate) {
        issues.push({
          id: `installation-${record.id}`,
          farmId: record.farmId,
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

  const activeProjects = workspace.projects.filter(
    (project) => project.status === 'active',
  ).length;
  const activeSubscriptions = workspace.records.filter(
    (record) => record.subscriptionStatus === 'active',
  ).length;
  const expiredSubscriptions = workspace.records.filter(
    (record) => record.subscriptionStatus === 'expired',
  ).length;
  const installFollowups = workspace.records.filter(
    (record) => !record.commissioningDate || !record.educationDate,
  ).length;
  const serviceWorkItems = workspace.workItems.filter(
    (workItem) => workItem.workType === 'service',
  );
  const openServices = serviceWorkItems.filter(
    (workItem) => workItem.status !== 'completed',
  ).length;
  const openWorkItems = workspace.workItems.filter(
    (workItem) => workItem.status !== 'completed',
  ).length;
  const paymentTotal = workspace.historyEntries.reduce((sum, entry) => {
    return workItemById.get(entry.workItemId)?.workType === 'payment'
      ? sum + entry.amount
      : sum;
  }, 0);
  const recentHistoryEntries = [...workspace.historyEntries]
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

  const navItems: Array<{
    id: View;
    label: string;
    icon: typeof Warehouse;
    count?: number;
  }> = [
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
      label: '사업 관리',
      icon: BriefcaseBusiness,
      count: workspace.projects.length,
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

  function changeView(next: View) {
    setView(next);
    if (next !== 'farms') setSearch('');
  }

  function openFarm(farmId: string, workItemId = '') {
    setSelectedFarmId(farmId);
    setSelectedWorkItemId(workItemId);
  }

  function openFarmDialog() {
    setFarmForm(
      emptyFarmForm(
        workspace.projects.find((project) => project.status === 'active')?.id ??
          workspace.projects[0]?.id ??
          '',
      ),
    );
    setFormError('');
    setDialog('farm');
  }

  function openFarmEditDialog() {
    if (!selectedFarm) return;
    const form = emptyFarmForm(
      selectedRecords[0]?.projectId ?? workspace.projects[0]?.id ?? '',
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
      selectedRecords.map((record) => record.projectId),
    );
    const availableProject = workspace.projects.find(
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
    setProjectForm(emptyProjectForm());
    setFormError('');
    setDialog('project');
  }

  function openWorkItemDialog(farmRecordId = '') {
    if (!selectedFarm || !selectedRecords.length) return;
    const safeRecordId = selectedRecords.some(
      (record) => record.id === farmRecordId,
    )
      ? farmRecordId
      : selectedRecords.length === 1
        ? selectedRecords[0].id
        : '';
    setWorkItemForm(emptyWorkItemForm(safeRecordId));
    setClarifyingInboxId('');
    setFormError('');
    setDialog('work_item');
  }

  function openQuickWorkItem(
    record: FarmRecord,
    workType: WorkType,
    title: string,
  ) {
    setSelectedFarmId(record.farmId);
    setSelectedWorkItemId('');
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

  function openHistoryDialog(workItem: FarmWorkItem) {
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

  function openInboxDialog() {
    setInboxForm(emptyInboxForm());
    setFormError('');
    setDialog('inbox');
  }

  function openInboxRoute(item: FarmInboxItem) {
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
    const inboxItem = workspace.inboxItems.find(
      (item) => item.id === clarifyingInboxId,
    );
    const record = recordById.get(inboxRouteRecordId);
    if (!inboxItem || !record || record.farmId !== inboxRouteFarmId) {
      setFormError('농가와 연결 사업을 선택해 주세요.');
      return;
    }
    setSelectedFarmId(inboxRouteFarmId);
    setSelectedWorkItemId('');
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

  async function submitInbox(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'inbox',
          inboxItem: {
            ...inboxForm,
            receivedAt: new Date(inboxForm.receivedAt).getTime(),
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.inboxItem) {
        throw new Error(data.error || '수신 내용을 저장하지 못했습니다.');
      }
      await loadWorkspace(true);
      setWorkMode('inbox');
      setDialog(null);
      toast.add({
        title: '수신함에 담았습니다',
        description: '업무로 정리할 때까지 원문을 그대로 보관합니다.',
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
      const response = await fetch('/api/farm-ledger', {
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
      await loadWorkspace(true);
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
      const response = await fetch('/api/farm-ledger', {
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
      await loadWorkspace(true);
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
      const response = await fetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'project', project: projectForm }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.project)
        throw new Error(data.error || '사업을 등록하지 못했습니다.');
      await loadWorkspace(true);
      setDialog(null);
      toast.add({
        title: '사업을 등록했습니다',
        description: projectForm.name,
        type: 'success',
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : '사업을 등록하지 못했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFarm(event: FormSubmitEvent) {
    event.preventDefault();
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
      selectedRecords.some(
        (record) => record.projectId === recordPayload.projectId,
      )
    ) {
      setFormError('이미 참여 중인 사업입니다. 다른 사업을 선택해 주세요.');
      return;
    }
    if (
      mode === 'record_edit' &&
      selectedRecords.some(
        (record) =>
          record.id !== editingRecordId &&
          record.projectId === recordPayload.projectId,
      )
    ) {
      setFormError('같은 농가에 동일 사업을 중복 연결할 수 없습니다.');
      return;
    }
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
          }
        : isFarmEdit
          ? { kind: 'farm', farmId: selectedFarm?.id, farm: farmPayload }
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
      const response = await fetch('/api/farm-ledger', {
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
          : selectedFarm?.id;
      await loadWorkspace(true);
      if (createdFarmId) setSelectedFarmId(createdFarmId);
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
      setSubmitting(false);
    }
  }

  async function submitWorkItem(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedFarm) return;
    if (!workItemForm.farmRecordId) {
      setFormError('업무를 연결할 참여 사업을 선택해 주세요.');
      return;
    }
    if (
      !workItemForm.receivedContent.trim() &&
      !workItemForm.actionContent.trim()
    ) {
      setFormError('최초 받은 내용 또는 처리 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'work_item',
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
      const workItemId = (data.workItem as { id: string }).id;
      await loadWorkspace(true);
      setSelectedWorkItemId(workItemId);
      setClarifyingInboxId('');
      setDialog(null);
      toast.add({
        title: '업무를 등록했습니다',
        description: workItemForm.title,
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
    if (!selectedWorkItem) return;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'history',
          history: {
            workItemId: selectedWorkItem.id,
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
      await loadWorkspace(true);
      setDialog(null);
      toast.add({
        title: '진행 기록을 추가했습니다',
        description: selectedWorkItem.title,
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
      const response = await fetch('/api/farm-ledger', {
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
      await loadWorkspace(true);
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
    return {
      record,
      project: record ? projectById.get(record.projectId) : null,
      latestWorkItem: workItemsByFarm.get(farm.id)?.[0] ?? null,
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
        onClick={() => {
          if (selectedFarm?.id === workItem.farmId)
            setSelectedWorkItemId(workItem.id);
          else openFarm(workItem.farmId, workItem.id);
        }}
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
                {latestReceived?.receivedContent || '받은 내용이 없습니다.'}
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

  return (
    <Toaster toastManager={toast} timeout={4500}>
      <main className="min-h-screen bg-[#f4f7f2] text-[#203027]">
        <div className="mx-auto flex min-h-screen max-w-[1720px]">
          <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col bg-[#173f32] px-4 py-6 text-white lg:flex">
            <div className="mb-9 flex items-center gap-3 px-2">
              <div className="grid size-10 place-items-center rounded-xl bg-[#62b982] shadow-[0_10px_24px_rgba(98,185,130,0.24)]">
                <Leaf className="size-5" />
              </div>
              <div>
                <p className="font-bold">팜로그</p>
                <p className="text-[11px] text-white/45">Smart farm ledger</p>
              </div>
            </div>
            <nav aria-label="주요 메뉴" className="space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeView(item.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm ${
                    view === item.id
                      ? 'bg-white/13 font-semibold text-white'
                      : 'text-white/60 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <item.icon className="size-[18px]" />
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span className="ml-auto rounded-full bg-white/9 px-2 py-0.5 text-[10px]">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs font-semibold text-white/80">
                원본 관리대장 분석
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[92%] rounded-full bg-[#8bd1a3]" />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/42">
                297개 농가 · 35개 연결 사업
                <br />
                실제 데이터는 이관 전입니다.
              </p>
              <a
                href={sourceSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#a9dfb9] hover:underline"
              >
                <ExternalLink className="size-3" />
                Google 관리대장 열기
              </a>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#dfe7dc] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
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
                    <SelectValue />
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
                <p className="text-sm font-semibold">스마트팜 통합 관리</p>
                <p className="text-xs text-[#748178]">
                  사업과 농가 업무 현황을 한눈에 확인합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  onClick={openProjectDialog}
                  variant="outline"
                  className="hidden rounded-xl sm:flex"
                >
                  <Building2 />
                  사업 추가
                </Button>
                <Button
                  onClick={openFarmDialog}
                  disabled={!workspace.projects.length}
                  className="rounded-xl bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  <Plus />
                  농가 등록
                </Button>
              </div>
            </header>

            <div className="px-5 py-7 sm:px-8 lg:px-10">
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
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d9e7d7] bg-[#f1f8ef] p-4">
                    <Leaf className="mt-0.5 size-5 shrink-0 text-[#3f8058]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#315f43]">
                        Google 관리대장 구조를 반영한 새 관리 화면입니다
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#66806d]">
                        현재는 개인정보가 없는 예시 농가{' '}
                        {workspace.farms.length}곳만 들어 있습니다. 원본 297개
                        농가와 입금·A/S 데이터는 별도 승인 후 안전하게 이관할 수
                        있습니다.
                      </p>
                    </div>
                    <a
                      href={sourceSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[#39795b] hover:underline sm:flex"
                    >
                      <ExternalLink className="size-3.5" />
                      원본 열기
                    </a>
                  </div>

                  {view === 'overview' && (
                    <>
                      <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div>
                          <p className="mb-1 text-sm font-medium text-[#647568]">
                            프로그램 등록 현황
                          </p>
                          <h1 className="text-[27px] font-bold tracking-[-0.04em] sm:text-[32px]">
                            스마트팜 업무 관리대장
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            사업별 업무의 마지막 수신 내용, 처리 결과와 전체
                            과정을 연결합니다.
                          </p>
                        </div>
                        <div className="relative w-full xl:w-80">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                          <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onFocus={() => setView('farms')}
                            placeholder="농가명, 사업, 업무, 장비 검색"
                            className="h-10 rounded-xl border-[#dbe3d9] bg-white pl-9"
                          />
                        </div>
                      </div>
                      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          {
                            label: '등록 농가',
                            value: `${workspace.farms.length}곳`,
                            note: `활성 구독 ${activeSubscriptions}곳`,
                            icon: Warehouse,
                            tone: 'bg-[#e6f3ea] text-[#2f7b59]',
                          },
                          {
                            label: '진행 사업',
                            value: `${activeProjects}개`,
                            note: `전체 사업 ${workspace.projects.length}개`,
                            icon: BriefcaseBusiness,
                            tone: 'bg-[#e9f0df] text-[#66843d]',
                          },
                          {
                            label: '처리할 업무',
                            value: `${openWorkItems}건`,
                            note: `마감 지연 ${overdueWorkItems.length}건`,
                            icon: CalendarClock,
                            tone: 'bg-[#fff0e6] text-[#b46438]',
                          },
                          {
                            label: '입금 기록',
                            value: formatMoney(paymentTotal),
                            note: `구독 만료 ${expiredSubscriptions}곳`,
                            icon: CreditCard,
                            tone: 'bg-[#edf5e8] text-[#5c823e]',
                          },
                        ].map((metric) => (
                          <Card
                            key={metric.label}
                            className="border-0 bg-white shadow-sm ring-[#e0e7de]"
                          >
                            <CardContent className="flex items-center justify-between px-5 py-1">
                              <div>
                                <p className="text-xs text-[#78847b]">
                                  {metric.label}
                                </p>
                                <p className="mt-1 text-2xl font-bold">
                                  {metric.value}
                                </p>
                                <p className="mt-1 text-[11px] text-[#929c95]">
                                  {metric.note}
                                </p>
                              </div>
                              <div
                                className={`grid size-11 place-items-center rounded-2xl ${metric.tone}`}
                              >
                                <metric.icon className="size-5" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
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
                              onClick={() => setView('farms')}
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
                              onClick={() => setView('work')}
                              className="w-full rounded-xl bg-[#fff6ef] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#a75b35]">
                                마감 지연 업무
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                {overdueWorkItems.length}건
                              </p>
                              <p className="mt-1 text-xs text-[#8b7a70]">
                                지연 업무부터 확인하고 처리 기록을 이어갑니다.
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setView('subscriptions')}
                              className="w-full rounded-xl bg-[#f4f8f1] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#5e7b43]">
                                구독 만료
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                {expiredSubscriptions}개 농가 갱신 확인
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setView('quality')}
                              className="w-full rounded-xl bg-[#f2f6f3] p-4 text-left"
                            >
                              <p className="text-xs font-semibold text-[#547160]">
                                데이터 점검
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                확인 필요 {qualityIssues.length}건
                              </p>
                              <p className="mt-1 text-xs text-[#7b877f]">
                                설치 후속 단계 {installFollowups}곳 포함
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
                            GTD · Kanban · Service Operations
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            업무 현황
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            들어온 내용을 한곳에 모으고, 다음 행동을 정해 흐름과
                            완료 기준을 관리하고 대응 위험·막힘·현장 방문을
                            관제합니다.
                          </p>
                        </div>
                        <Button
                          onClick={openInboxDialog}
                          className="bg-[#2f7b59] hover:bg-[#286b4d]"
                        >
                          <Inbox />
                          빠른 수신
                        </Button>
                      </div>
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
                              if (mode === 'board') setWorkStatusFilter('all');
                            }}
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
                      {(workMode === 'board' || workMode === 'list') && (
                        <>
                          <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
                                {Object.entries(FARM_WORK_TYPE_LABELS).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
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
                                              {farm?.name ?? '농가 미확인'} ·{' '}
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
                        <div className="flex snap-x gap-4 overflow-x-auto pb-3">
                          {WORK_COLUMNS.map((column) => {
                            const columnItems = filteredWorkItems.filter(
                              (item) =>
                                item.status === column.status &&
                                (column.status !== 'completed' ||
                                  item.lastActivityAt >= sevenDaysAgo),
                            );
                            const wipExceeded =
                              column.status === 'in_progress' &&
                              totalInProgressCount > WORK_IN_PROGRESS_LIMIT;
                            return (
                              <section
                                key={column.status}
                                className="w-[86vw] max-w-[360px] shrink-0 snap-start rounded-2xl border border-[#dfe6dd] bg-[#eef3ed] p-3 xl:w-auto xl:max-w-none xl:flex-1"
                              >
                                <div className="mb-3 flex items-start justify-between gap-2 px-1">
                                  <div>
                                    <h2 className="text-sm font-bold">
                                      {FARM_WORK_STATUS_LABELS[column.status]}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] text-[#7e8a82]">
                                      {column.description}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={
                                      wipExceeded
                                        ? 'border-[#efc8bb] bg-[#fff1ec] text-[#a94f32]'
                                        : 'bg-white'
                                    }
                                  >
                                    {column.status === 'in_progress'
                                      ? `처리+대기 ${totalInProgressCount} / ${WORK_IN_PROGRESS_LIMIT}`
                                      : columnItems.length}
                                  </Badge>
                                </div>
                                {wipExceeded && (
                                  <div className="mb-3 flex gap-2 rounded-xl bg-[#fff1ec] p-3 text-xs text-[#9d4e34]">
                                    <CircleAlert className="mt-0.5 size-4 shrink-0" />
                                    처리 중과 대기·막힘 업무를 합친 한도입니다.
                                    새 업무보다 기존 약속을 먼저 정리해 주세요.
                                  </div>
                                )}
                                <div className="space-y-3">
                                  {columnItems.map((item) => (
                                    <WorkItemCard
                                      key={item.id}
                                      workItem={item}
                                      compact
                                    />
                                  ))}
                                  {!columnItems.length && (
                                    <div className="rounded-xl border border-dashed border-[#d5ded4] bg-white/60 py-8 text-center text-xs text-[#8b958e]">
                                      업무 없음
                                    </div>
                                  )}
                                </div>
                              </section>
                            );
                          })}
                        </div>
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
                        <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-[#f7f9f6]">
                                <TableHead className="pl-5">
                                  업무·농가
                                </TableHead>
                                <TableHead>사업</TableHead>
                                <TableHead>마지막 받은 내용</TableHead>
                                <TableHead>마지막 처리 내용</TableHead>
                                <TableHead>담당자</TableHead>
                                <TableHead>마감</TableHead>
                                <TableHead className="pr-5">상태</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredWorkItems.map((workItem) => {
                                const farm = farmById.get(workItem.farmId);
                                const latestReceived = latestEntryWith(
                                  workItem,
                                  'receivedContent',
                                );
                                const latestAction = latestEntryWith(
                                  workItem,
                                  'actionContent',
                                );
                                return (
                                  <TableRow key={workItem.id}>
                                    <TableCell className="pl-5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openFarm(workItem.farmId, workItem.id)
                                        }
                                        className="max-w-[250px] text-left"
                                      >
                                        <p className="truncate font-semibold hover:text-[#2f7b59]">
                                          {workItem.title}
                                        </p>
                                        <p className="mt-1 truncate text-xs text-[#89938c]">
                                          {farm?.name ?? '농가 없음'} ·{' '}
                                          {
                                            FARM_WORK_TYPE_LABELS[
                                              workItem.workType
                                            ]
                                          }
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-[11px] text-[#4f765c]">
                                          다음 행동 ·{' '}
                                          {workItem.nextAction || '미지정'}
                                        </p>
                                      </button>
                                    </TableCell>
                                    <TableCell className="max-w-[220px] truncate">
                                      {projectForWorkItem(workItem)?.name ??
                                        '사업 없음'}
                                    </TableCell>
                                    <TableCell className="max-w-[250px]">
                                      <p className="line-clamp-2 text-xs leading-5">
                                        {latestReceived?.receivedContent ||
                                          '받은 내용 없음'}
                                      </p>
                                    </TableCell>
                                    <TableCell className="max-w-[250px]">
                                      <p className="line-clamp-2 text-xs leading-5 text-[#476752]">
                                        {latestAction?.actionContent ||
                                          '처리 내용 없음'}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      {workItem.owner || '미지정'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={dueClass(
                                          workItem.dueDate,
                                          workItem.status === 'completed',
                                        )}
                                      >
                                        {dueLabel(
                                          workItem.dueDate,
                                          workItem.status === 'completed',
                                        )}
                                      </Badge>
                                      <p className="mt-1 text-[11px] text-[#89938c]">
                                        {formatDate(workItem.dueDate)}
                                      </p>
                                    </TableCell>
                                    <TableCell className="pr-5">
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
                                      <p className="mt-1 text-[11px] text-[#7f8b83]">
                                        우선순위{' '}
                                        {
                                          FARM_WORK_PRIORITY_LABELS[
                                            workItem.priority
                                          ]
                                        }
                                        {(
                                          checklistByWorkItem.get(
                                            workItem.id,
                                          ) ?? []
                                        ).length > 0 &&
                                          ` · 체크 ${(checklistByWorkItem.get(workItem.id) ?? []).filter((item) => item.isCompleted).length}/${(checklistByWorkItem.get(workItem.id) ?? []).length}`}
                                      </p>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {!filteredWorkItems.length && (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="h-40 text-center text-[#89938c]"
                                  >
                                    조건에 맞는 업무가 없습니다.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
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
                            className="bg-[#2f7b59] hover:bg-[#286b4d]"
                          >
                            <Plus />
                            농가 등록
                          </Button>
                        </div>
                      </div>
                      <div className="mb-4 grid gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:grid-cols-[1fr_190px_150px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" />
                          <Input
                            value={search}
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
                            <SelectValue />
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
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">모든 구독</SelectItem>
                            <SelectItem value="active">사용중</SelectItem>
                            <SelectItem value="expired">만료</SelectItem>
                            <SelectItem value="unregistered">미등록</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#f7f9f6]">
                              <TableHead className="pl-5">농가</TableHead>
                              <TableHead>사업</TableHead>
                              <TableHead>지역·장비</TableHead>
                              <TableHead>최근 업무</TableHead>
                              <TableHead>업무 상태</TableHead>
                              <TableHead>구독</TableHead>
                              <TableHead className="pr-5 text-right">
                                최근 활동
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFarms.map((farm) => {
                              const { record, project, latestWorkItem } =
                                farmRow(farm);
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
                                    {record && (
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
                                    )}
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
                                  colSpan={7}
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
                            사업 중심 조회
                          </p>
                          <h1 className="mt-1 text-[28px] font-bold">
                            사업 관리
                          </h1>
                          <p className="mt-2 text-sm text-[#77847b]">
                            사업별 참여 농가와 진행 업무를 확인합니다.
                          </p>
                        </div>
                        <Button
                          onClick={openProjectDialog}
                          className="bg-[#2f7b59] hover:bg-[#286b4d]"
                        >
                          <Plus />
                          사업 추가
                        </Button>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {workspace.projects.map((project) => {
                          const records = workspace.records.filter(
                            (record) => record.projectId === project.id,
                          );
                          const ids = new Set(
                            records.map((record) => record.id),
                          );
                          const items = workspace.workItems.filter((item) =>
                            ids.has(item.farmRecordId),
                          );
                          const openCount = items.filter(
                            (item) => item.status !== 'completed',
                          ).length;
                          const done = records.reduce(
                            (sum, record) =>
                              sum + installProgress(record).complete,
                            0,
                          );
                          const progress = records.length
                            ? Math.round((done / (records.length * 4)) * 100)
                            : 0;
                          return (
                            <Card
                              key={project.id}
                              className="border-0 bg-white shadow-sm ring-[#dfe6dd]"
                            >
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
                                      {records.length}곳
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
                                      {openCount}건
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-[#89938c]">
                                      설치
                                    </p>
                                    <p className="mt-1 font-bold">
                                      {progress}%
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1ec]">
                                  <div
                                    className="h-full rounded-full bg-[#62b982]"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
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
                            사업별 제작·설치·시운전·교육 진행률과 지역·작물·제품
                            분포를 비교합니다.
                          </p>
                        </div>
                        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[430px]">
                          <Select
                            value={businessYearFilter}
                            onValueChange={(value) =>
                              setBusinessYearFilter(value ?? 'all')
                            }
                          >
                            <SelectTrigger className="h-10 w-full bg-white">
                              <SelectValue />
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
                            <SelectTrigger className="h-10 w-full bg-white">
                              <SelectValue />
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
                      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          {
                            label: '대상 사업',
                            value: `${businessProjects.length}개`,
                            icon: BriefcaseBusiness,
                          },
                          {
                            label: '참여 농가',
                            value: `${new Set(businessRecords.map((record) => record.farmId)).size}곳`,
                            icon: Warehouse,
                          },
                          {
                            label: '설치 완료',
                            value: `${businessRecords.filter((record) => record.installationDate).length}곳`,
                            icon: CalendarCheck2,
                          },
                          {
                            label: '교육 완료',
                            value: `${businessRecords.filter((record) => record.educationDate).length}곳`,
                            icon: TrendingUp,
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
                              </div>
                              <div className="grid size-10 place-items-center rounded-xl bg-[#edf5e8] text-[#4d7b50]">
                                <metric.icon className="size-5" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <div className="border-b border-[#e5ebe3] px-5 py-4">
                          <h2 className="font-bold">사업별 설치 진행</h2>
                          <p className="mt-0.5 text-xs text-[#89938c]">
                            날짜가 입력된 단계만 완료로 집계합니다.
                          </p>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#f7f9f6]">
                              <TableHead className="pl-5">사업</TableHead>
                              <TableHead>참여</TableHead>
                              <TableHead>제작</TableHead>
                              <TableHead>설치</TableHead>
                              <TableHead>시운전</TableHead>
                              <TableHead>교육</TableHead>
                              <TableHead className="pr-5">
                                전체 진행률
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
                                  <TableCell>{installation}곳</TableCell>
                                  <TableCell>{commissioning}곳</TableCell>
                                  <TableCell>{education}곳</TableCell>
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
                                  colSpan={7}
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
                      <div className="mb-6">
                        <p className="text-sm font-medium text-[#647568]">
                          구독과 입금
                        </p>
                        <h1 className="mt-1 text-[28px] font-bold">
                          구독·입금 관리
                        </h1>
                        <p className="mt-2 text-sm text-[#77847b]">
                          사용 상태, 90일 이내 만료와 월별 입금 흐름을 함께
                          확인합니다.
                        </p>
                      </div>
                      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <Card className="border-0 bg-white ring-[#dfe6dd]">
                          <CardContent>
                            <p className="text-xs text-[#7a867d]">사용중</p>
                            <p className="mt-1 text-2xl font-bold text-[#2f7b59]">
                              {activeSubscriptions}곳
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white ring-[#dfe6dd]">
                          <CardContent>
                            <p className="text-xs text-[#7a867d]">
                              만료·미등록
                            </p>
                            <p className="mt-1 text-2xl font-bold text-[#b46438]">
                              {workspace.records.length - activeSubscriptions}곳
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white ring-[#eadfca]">
                          <CardContent>
                            <p className="text-xs text-[#7a867d]">
                              90일 이내 만료
                            </p>
                            <p className="mt-1 text-2xl font-bold text-[#94601c]">
                              {expiringSoonRecords.length}곳
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white ring-[#dfe6dd]">
                          <CardContent>
                            <p className="text-xs text-[#7a867d]">
                              입금 기록 합계
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                              {formatMoney(paymentTotal)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white ring-[#dfe6dd]">
                          <CardContent>
                            <p className="text-xs text-[#7a867d]">
                              입금 농가당 평균
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                              {formatMoney(averagePayment)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#eadfca] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#80663f]">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" />
                        <p>
                          입금 합계는 입금 업무의 히스토리를 기준으로 합니다.
                          구독 만료일·갱신횟수는 농가 상세의 설치·구독 수정에서
                          확인해 주세요.
                        </p>
                      </div>
                      <div className="grid gap-4 2xl:grid-cols-[1fr_290px]">
                        <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-[#f7f9f6]">
                                <TableHead className="pl-5">농가</TableHead>
                                <TableHead>사업</TableHead>
                                <TableHead>구독 만료일</TableHead>
                                <TableHead>마지막 입금일</TableHead>
                                <TableHead>갱신</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead className="pr-5">입금</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...workspace.records]
                                .sort((a, b) =>
                                  (
                                    a.currentSubscriptionExpiresAt || '9999'
                                  ).localeCompare(
                                    b.currentSubscriptionExpiresAt || '9999',
                                  ),
                                )
                                .map((record) => {
                                  const farm = farmById.get(record.farmId);
                                  const project = projectById.get(
                                    record.projectId,
                                  );
                                  const expiryDays = daysUntil(
                                    record.currentSubscriptionExpiresAt,
                                  );
                                  return (
                                    <TableRow key={record.id}>
                                      <TableCell className="pl-5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openFarm(record.farmId)
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
                                        {formatDate(record.lastPaymentDate)}
                                      </TableCell>
                                      <TableCell>
                                        {record.renewalCount}회
                                      </TableCell>
                                      <TableCell>
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
                                      </TableCell>
                                      <TableCell className="pr-5">
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
                                          입금 등록
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
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
                              {monthlyPayments.map((month) => (
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
                              {!monthlyPayments.length && (
                                <p className="py-8 text-center text-sm text-[#89938c]">
                                  입금 기록이 없습니다.
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
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
                            value: qualityIssues.length,
                            tone: 'text-[#203027]',
                            icon: FileWarning,
                          },
                          {
                            label: '중복 가능성',
                            value: qualityIssues.filter(
                              (issue) => issue.category === 'duplicate',
                            ).length,
                            tone: 'text-[#aa4e30]',
                            icon: CircleAlert,
                          },
                          {
                            label: '기본·설치 누락',
                            value: qualityIssues.filter(
                              (issue) =>
                                issue.category === 'contact' ||
                                issue.category === 'installation',
                            ).length,
                            tone: 'text-[#94601c]',
                            icon: ClipboardList,
                          },
                          {
                            label: '구독 기준 누락',
                            value: qualityIssues.filter(
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
                      {qualityIssues.length ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {qualityIssues.map((issue) => {
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
                                onClick={() => openFarm(issue.farmId)}
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
          </section>
        </div>

        <Sheet
          open={Boolean(selectedFarm)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedFarmId('');
              setSelectedWorkItemId('');
            }
          }}
        >
          <SheetContent
            side="right"
            className="w-full gap-0 p-0 sm:max-w-[820px]"
          >
            {selectedFarm && (
              <>
                <SheetHeader className="border-b border-[#e2e8e1] px-6 py-5 pr-14">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="bg-[#f1f7ef] text-[#4a7448]"
                    >
                      {selectedFarm.farmCode}
                    </Badge>
                    <Badge variant="outline">{selectedFarm.region}</Badge>
                    <Badge variant="outline">
                      참여 사업 {selectedRecords.length}개
                    </Badge>
                    <Badge variant="outline">
                      진행 업무{' '}
                      {
                        selectedWorkItems.filter(
                          (item) => item.status !== 'completed',
                        ).length
                      }
                      건
                    </Badge>
                  </div>
                  <SheetTitle className="text-xl font-bold">
                    {selectedFarm.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {selectedFarm.phone || '연락처 미입력'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {selectedFarm.address || selectedFarm.region}
                    </span>
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="flex flex-wrap gap-2">
                    {selectedFarm.folderUrl && (
                      <a
                        href={selectedFarm.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <FolderOpen />
                          농장 폴더
                        </Button>
                      </a>
                    )}
                    {selectedFarm.locationUrl && (
                      <a
                        href={selectedFarm.locationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <MapPin />
                          위치도
                        </Button>
                      </a>
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
                      onClick={() => openWorkItemDialog()}
                      size="sm"
                      disabled={!selectedRecords.length}
                      className="bg-[#2f7b59] hover:bg-[#286b4d]"
                    >
                      <Plus />새 업무 등록
                    </Button>
                  </div>
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

                  <section className="mt-6">
                    <div>
                      <h3 className="font-bold">참여 사업·설치 정보</h3>
                      <p className="mt-0.5 text-xs text-[#89938c]">
                        업무를 등록할 때 반드시 아래 사업 중 하나에 연결합니다.
                      </p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedRecords.map((record) => {
                        const project = projectById.get(record.projectId);
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
                                <h4 className="mt-2 font-semibold">
                                  {project?.name ?? '사업 없음'}
                                </h4>
                                <p className="mt-1 text-xs text-[#879088]">
                                  {record.crop || '작물 미입력'} ·{' '}
                                  {record.deviceType || '장비 미입력'} ·{' '}
                                  {record.productType || '제품 미입력'}
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
                                보증 {formatDate(record.warrantyExpiresAt)} ·
                                구독{' '}
                                {formatDate(
                                  record.currentSubscriptionExpiresAt,
                                )}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  onClick={() => openRecordEditDialog(record)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Pencil />
                                  설치·구독 수정
                                </Button>
                                <Button
                                  onClick={() => openWorkItemDialog(record.id)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Plus />이 사업에 업무 등록
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="mt-7">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">농가 업무</h3>
                        <p className="mt-0.5 text-xs text-[#89938c]">
                          현재 상태와 마지막 받은·처리 내용을 확인합니다.
                        </p>
                      </div>
                      <Button
                        onClick={() => openWorkItemDialog()}
                        size="sm"
                        variant="outline"
                      >
                        <Plus />
                        업무 등록
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {selectedWorkItems.map((item) => (
                        <WorkItemCard key={item.id} workItem={item} />
                      ))}
                      {!selectedWorkItems.length && (
                        <div className="rounded-2xl border border-dashed border-[#d7dfd5] py-10 text-center">
                          <FileText className="mx-auto size-7 text-[#9aa49d]" />
                          <p className="mt-3 text-sm font-semibold">
                            등록된 업무가 없습니다.
                          </p>
                          <p className="mt-1 text-xs text-[#89938c]">
                            메일·카톡·전화·구두 내용을 첫 업무로 남겨보세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedWorkItem &&
                    selectedWorkItem.farmId === selectedFarm.id && (
                      <section className="mt-7 rounded-3xl border border-[#cfe0d1] bg-[#f8fbf7] p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedWorkItemId('')}
                              className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#66806d]"
                            >
                              <ArrowLeft className="size-3.5" />
                              업무 목록으로
                            </button>
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
                                {projectForWorkItem(selectedWorkItem)?.name ??
                                  '사업 없음'}
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
                              담당 {selectedWorkItem.owner || '미지정'} · 기한{' '}
                              {formatDate(selectedWorkItem.dueDate)}
                            </p>
                            {selectedWorkItem.description && (
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                {selectedWorkItem.description}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => openHistoryDialog(selectedWorkItem)}
                            size="sm"
                            className="shrink-0 bg-[#2f7b59] hover:bg-[#286b4d]"
                          >
                            <Plus />
                            진행 기록 추가
                          </Button>
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
                                      responseRisk(selectedWorkItem, riskNow),
                                    )}
                                  >
                                    {responseRiskLabel(
                                      responseRisk(selectedWorkItem, riskNow),
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
                                    {elapsedDays(selectedWorkItem.blockedAt)}
                                    일째
                                  </Badge>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                  {selectedWorkItem.blockedReason ||
                                    '막힘 사유 확인 필요'}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-[#8f6a59]">
                                  해제 책임자{' '}
                                  {selectedWorkItem.blockedBy || '미입력'} ·
                                  예상{' '}
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
                              <h4 className="text-sm font-bold">막힘 이력</h4>
                              <p className="mt-1 text-xs text-[#7b877f]">
                                원인, 해제에 필요한 주체, 해결 결과를 기간별로
                                보존합니다.
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
                                    {formatDate(episode.expectedUnblockDate)}
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
                              <h4 className="text-sm font-bold">현장 방문</h4>
                              <p className="mt-1 text-xs text-[#7b877f]">
                                한 업무에 여러 번 방문해도 일정과 결과를 각각
                                남깁니다.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={selectedWorkItem.status === 'completed'}
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
                                        {FARM_VISIT_STATUS_LABELS[visit.status]}
                                      </Badge>
                                      <span className="text-xs font-semibold text-[#536259]">
                                        {formatTimestamp(visit.scheduledAt)}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm">
                                      방문 담당 {visit.assignedTo || '미지정'}
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
                                        {formatTimestamp(visit.actualStartedAt)}{' '}
                                        ~ {formatTimestamp(visit.actualEndedAt)}
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
                                        {formatTimestamp(visit.nextVisitAt)}
                                      </p>
                                    )}
                                  </div>
                                  {visit.status === 'scheduled' ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openVisitDialog(visit)}
                                    >
                                      <Pencil /> 수정
                                    </Button>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-[#d8ded9] bg-white text-[#6f7c73]"
                                    >
                                      <LockKeyhole className="size-3" /> 증빙
                                      잠금
                                    </Badge>
                                  )}
                                </div>
                              </article>
                            ))}
                            {!selectedVisits.length && (
                              <div className="rounded-xl border border-dashed border-[#d7dfd5] px-3 py-6 text-center text-xs text-[#7b877f]">
                                등록된 현장 방문이 없습니다. 방문 전 일정을 먼저
                                잡아 주세요.
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
                                  /{selectedChecklist.length} · 확인자를 남겨
                                  누락을 줄입니다.
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
                                    selectedWorkItem.status === 'completed'
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
                                        {formatTimestamp(item.completedAt)}
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
                                      {FARM_LOG_CHANNEL_LABELS[entry.channel]}
                                      {entry.sender ? ` · ${entry.sender}` : ''}
                                    </p>
                                    <time className="text-[11px] text-[#929b94]">
                                      {formatTimestamp(entry.occurredAt)}
                                    </time>
                                  </div>
                                  {entry.receivedContent && (
                                    <div className="mt-3 rounded-xl bg-[#f6f8f6] p-3">
                                      <p className="text-[11px] font-semibold text-[#78847c]">
                                        받은 내용
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                        {entry.receivedContent}
                                      </p>
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
                    )}

                  <section className="mt-7">
                    <div>
                      <h3 className="font-bold">농가 전체 히스토리</h3>
                      <p className="mt-0.5 text-xs text-[#89938c]">
                        어느 사업과 업무에 속하는 기록인지 함께 표시합니다.
                      </p>
                    </div>
                    <ol className="mt-4 space-y-3">
                      {selectedFarmHistory.map(({ entry, workItem }) => (
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
                                {FARM_LOG_TYPE_LABELS[workItem.workType]}
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
                            onClick={() => setSelectedWorkItemId(workItem.id)}
                            className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#39795b]"
                          >
                            업무 전체 과정 보기{' '}
                            <ArrowRight className="size-3.5" />
                          </button>
                        </li>
                      ))}
                      {!selectedFarmHistory.length && (
                        <li className="rounded-2xl border border-dashed py-8 text-center text-sm text-[#89938c]">
                          아직 기록된 히스토리가 없습니다.
                        </li>
                      )}
                    </ol>
                  </section>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog
          open={dialog === 'project'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'project' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[600px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">스마트팜 사업 등록</DialogTitle>
              <DialogDescription>
                사업별 참여 농가와 진행 업무를 연결합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitProject} className="mt-1 space-y-4">
              <Field>
                <FieldLabel>사업명</FieldLabel>
                <Input
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
                  <FieldLabel>사업 유형</FieldLabel>
                  <Select
                    value={projectForm.projectType}
                    onValueChange={(value) =>
                      setProjectForm((current) => ({
                        ...current,
                        projectType: value as FarmProjectType,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
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
                  <FieldLabel>기준 연도</FieldLabel>
                  <Input
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
                  <FieldLabel>주관기관</FieldLabel>
                  <Input
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
                  <FieldLabel>목표 농가 수</FieldLabel>
                  <Input
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
                  <FieldLabel>사업 상태</FieldLabel>
                  <Select
                    value={projectForm.status}
                    onValueChange={(value) =>
                      setProjectForm((current) => ({
                        ...current,
                        status: value as FarmProjectStatus,
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">진행 중</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="on_hold">보류</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>사업 설명</FieldLabel>
                <Textarea
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
                  {submitting && <Loader2 className="animate-spin" />}사업 등록
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
            if (!submitting && !open) setDialog(null);
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
                      : '설치·구독 정보 수정'}
              </DialogTitle>
              <DialogDescription>
                {dialog === 'farm'
                  ? '농가 기본정보와 첫 사업·설치·구독 정보를 함께 저장합니다.'
                  : dialog === 'farm_edit'
                    ? '농장번호, 연락처, 주소와 현장 링크를 수정합니다.'
                    : dialog === 'record_add'
                      ? `${selectedFarm?.name ?? ''} 농가를 다른 사업에 연결합니다.`
                      : '사업별 장비, 설치 단계와 구독 기준을 수정하고 변경 이력을 남깁니다.'}
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
                      <FieldLabel>농장 폴더 링크</FieldLabel>
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
                      <FieldLabel>농장 위치도 링크</FieldLabel>
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
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {workspace.projects
                              .filter(
                                (project) =>
                                  dialog === 'farm' ||
                                  !selectedRecords.some(
                                    (record) =>
                                      record.id !== editingRecordId &&
                                      record.projectId === project.id,
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
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">사용중</SelectItem>
                            <SelectItem value="expired">만료</SelectItem>
                            <SelectItem value="unregistered">미등록</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
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
                      <Field>
                        <FieldLabel>현재 구독 만료일</FieldLabel>
                        <Input
                          type="date"
                          value={farmForm.currentSubscriptionExpiresAt}
                          onChange={(event) =>
                            setFarmForm((current) => ({
                              ...current,
                              currentSubscriptionExpiresAt: event.target.value,
                            }))
                          }
                        />
                      </Field>
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
            !submitting && setDialog(open ? 'inbox' : null)
          }
        >
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[660px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">빠른 수신</DialogTitle>
              <DialogDescription>
                농가와 사업을 아직 몰라도 괜찮습니다. 받은 내용을 먼저 원문
                그대로 담아두세요.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitInbox} className="mt-1 space-y-4">
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
                  <Textarea
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
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
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
                어느 농가의 어떤 사업에서 처리할 내용인지 먼저 연결합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-1 space-y-4">
              <div className="rounded-xl bg-[#f5f8f4] p-3 text-sm leading-6">
                {
                  workspace.inboxItems.find(
                    (item) => item.id === clarifyingInboxId,
                  )?.content
                }
              </div>
              <Field>
                <FieldLabel>농가 검색</FieldLabel>
                <Input
                  value={inboxFarmSearch}
                  onChange={(event) => setInboxFarmSearch(event.target.value)}
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
                    <SelectValue placeholder="농가를 선택하세요" />
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
                  onValueChange={(value) => setInboxRouteRecordId(value ?? '')}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="사업을 선택하세요" />
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
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  다음: 업무 계획 작성 <ArrowRight />
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'work_item'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'work_item' : null)
          }
        >
          <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-[760px] sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg">농가 업무 등록</DialogTitle>
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
                      <SelectValue placeholder="업무를 연결할 사업을 선택하세요" />
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
                      value={workItemForm.amount}
                      onChange={(event) =>
                        setWorkItemForm((current) => ({
                          ...current,
                          amount: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>받은 내용</FieldLabel>
                    <Textarea
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
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2f7b59] hover:bg-[#286b4d]"
                >
                  {submitting && <Loader2 className="animate-spin" />}업무 등록
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog === 'history'}
          onOpenChange={(open) =>
            !submitting && setDialog(open ? 'history' : null)
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
                  <Textarea
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
                <Field>
                  <FieldLabel>금액(원)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={historyForm.amount}
                    onChange={(event) =>
                      setHistoryForm((current) => ({
                        ...current,
                        amount: Number(event.target.value),
                      }))
                    }
                  />
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
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
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
