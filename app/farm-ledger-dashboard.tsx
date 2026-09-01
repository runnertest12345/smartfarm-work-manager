'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CircleAlert,
  CreditCard,
  ExternalLink,
  FileText,
  FolderOpen,
  Leaf,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageCircleMore,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Search,
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
  FARM_PROJECT_STATUS_LABELS,
  FARM_PROJECT_TYPE_LABELS,
  FARM_WORK_STATUS_LABELS,
  FARM_WORK_TYPE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type Farm,
  type FarmHistoryEntry,
  type FarmInput,
  type FarmLedgerWorkspace,
  type FarmProjectInput,
  type FarmProjectStatus,
  type FarmProjectType,
  type FarmRecord,
  type FarmRecordInput,
  type FarmWorkItem,
  type SubscriptionStatus,
} from '@/lib/farm-types';

type View = 'overview' | 'farms' | 'projects' | 'subscriptions' | 'service';
type DialogKind = 'farm' | 'project' | 'work_item' | 'history' | null;
type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0];
type WorkType = FarmWorkItem['workType'];
type WorkStatus = FarmWorkItem['status'];
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
}

interface HistoryForm extends HistoryDraft {
  newStatus: WorkStatus;
}

const emptyWorkspace: FarmLedgerWorkspace = {
  projects: [],
  farms: [],
  records: [],
  workItems: [],
  historyEntries: [],
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
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dateWithOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
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
  if (localDateString(date) === localDateString(yesterday)) return `어제 ${time}`;
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
  };
}

function emptyHistoryForm(status: WorkStatus = 'in_progress'): HistoryForm {
  return { ...emptyHistoryDraft(), newStatus: status };
}

function subscriptionClass(status: SubscriptionStatus) {
  if (status === 'active') return 'border-[#bfe3cb] bg-[#edf8f1] text-[#28744f]';
  if (status === 'expired') return 'border-[#f0cdbb] bg-[#fff4ed] text-[#ac5a32]';
  return 'border-[#d9dfda] bg-[#f5f7f5] text-[#707b73]';
}

function workStatusClass(status: WorkStatus) {
  if (status === 'completed') return 'border-[#c7dfcf] bg-[#eef8f1] text-[#2e7650]';
  if (status === 'in_progress') return 'border-[#c9d9ef] bg-[#f0f5fb] text-[#416c9c]';
  if (status === 'waiting') return 'border-[#ead9b8] bg-[#fff9ed] text-[#94601c]';
  return 'border-[#f0cdbb] bg-[#fff4ed] text-[#a75b35]';
}

function WorkIcon({ type, className = 'size-4' }: { type: WorkType; className?: string }) {
  if (type === 'service') return <Wrench className={className} />;
  if (type === 'payment') return <CreditCard className={className} />;
  if (type === 'installation') return <CalendarCheck2 className={className} />;
  if (type === 'subscription') return <CalendarClock className={className} />;
  if (type === 'communication') return <MessageSquareText className={className} />;
  return <FileText className={className} />;
}

function ChannelIcon({ channel, className = 'size-4' }: { channel: HistoryChannel; className?: string }) {
  if (channel === 'email') return <Mail className={className} />;
  if (channel === 'kakao') return <MessageCircleMore className={className} />;
  if (channel === 'phone') return <Phone className={className} />;
  if (channel === 'verbal' || channel === 'meeting') return <MessageSquareText className={className} />;
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
  return (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
}

export function FarmLedgerDashboard() {
  const [workspace, setWorkspace] = useState<FarmLedgerWorkspace>(emptyWorkspace);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | SubscriptionStatus>('all');
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [projectForm, setProjectForm] = useState<FarmProjectInput>(emptyProjectForm);
  const [farmForm, setFarmForm] = useState<FarmForm>(() => emptyFarmForm(''));
  const [workItemForm, setWorkItemForm] = useState<WorkItemForm>(() => emptyWorkItemForm());
  const [historyForm, setHistoryForm] = useState<HistoryForm>(() => emptyHistoryForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/farm-ledger', { cache: 'no-store' });
      const data = (await readResponse(response)) as unknown as FarmLedgerWorkspace & { error?: string };
      if (
        !response.ok ||
        !Array.isArray(data.farms) ||
        !Array.isArray(data.workItems) ||
        !Array.isArray(data.historyEntries)
      ) {
        throw new Error(data.error || '관리대장을 불러오지 못했습니다.');
      }
      setWorkspace(data);
      setSelectedFarmId((current) => (data.farms.some((farm) => farm.id === current) ? current : ''));
      setSelectedWorkItemId((current) =>
        data.workItems.some((workItem) => workItem.id === current) ? current : '',
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '관리대장을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const recordsByFarm = useMemo(() => {
    const map = new Map<string, FarmRecord[]>();
    for (const record of workspace.records) {
      map.set(record.farmId, [...(map.get(record.farmId) ?? []), record]);
    }
    for (const records of map.values()) records.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return map;
  }, [workspace.records]);

  const workItemsByFarm = useMemo(() => {
    const map = new Map<string, FarmWorkItem[]>();
    for (const workItem of workspace.workItems) {
      map.set(workItem.farmId, [...(map.get(workItem.farmId) ?? []), workItem]);
    }
    for (const workItems of map.values()) workItems.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return map;
  }, [workspace.workItems]);

  const historiesByWorkItem = useMemo(() => {
    const map = new Map<string, FarmHistoryEntry[]>();
    for (const entry of workspace.historyEntries) {
      map.set(entry.workItemId, [...(map.get(entry.workItemId) ?? []), entry]);
    }
    for (const entries of map.values()) {
      entries.sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
    }
    return map;
  }, [workspace.historyEntries]);

  const projectById = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project])),
    [workspace.projects],
  );
  const recordById = useMemo(
    () => new Map(workspace.records.map((record) => [record.id, record])),
    [workspace.records],
  );
  const farmById = useMemo(() => new Map(workspace.farms.map((farm) => [farm.id, farm])), [workspace.farms]);
  const workItemById = useMemo(
    () => new Map(workspace.workItems.map((workItem) => [workItem.id, workItem])),
    [workspace.workItems],
  );

  const selectedFarm = farmById.get(selectedFarmId) ?? null;
  const selectedRecords = selectedFarm ? recordsByFarm.get(selectedFarm.id) ?? [] : [];
  const selectedWorkItems = selectedFarm ? workItemsByFarm.get(selectedFarm.id) ?? [] : [];
  const selectedWorkItem = workItemById.get(selectedWorkItemId) ?? null;
  const selectedWorkHistory = selectedWorkItem
    ? historiesByWorkItem.get(selectedWorkItem.id) ?? []
    : [];

  function projectForWorkItem(workItem: FarmWorkItem) {
    const record = recordById.get(workItem.farmRecordId);
    return record ? projectById.get(record.projectId) ?? null : null;
  }

  function latestEntryWith(workItem: FarmWorkItem, field: 'receivedContent' | 'actionContent') {
    return (historiesByWorkItem.get(workItem.id) ?? []).find((entry) => entry[field].trim()) ?? null;
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
      : records.find((record) => record.projectId === projectFilter) ?? records[0];
  }

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return workspace.farms
      .filter((farm) => {
        const records = recordsByFarm.get(farm.id) ?? [];
        const workItems = workItemsByFarm.get(farm.id) ?? [];
        const histories = workItems.flatMap((workItem) => historiesByWorkItem.get(workItem.id) ?? []);
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
          ...workItems.flatMap((workItem) => [workItem.title, workItem.owner, workItem.description]),
          ...histories.flatMap((entry) => [entry.receivedContent, entry.actionContent, entry.sender]),
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        const matchesProject =
          projectFilter === 'all' || records.some((record) => record.projectId === projectFilter);
        const matchesSubscription =
          subscriptionFilter === 'all' ||
          records.some((record) => record.subscriptionStatus === subscriptionFilter);
        return (!query || text.includes(query)) && matchesProject && matchesSubscription;
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

  const activeProjects = workspace.projects.filter((project) => project.status === 'active').length;
  const activeSubscriptions = workspace.records.filter((record) => record.subscriptionStatus === 'active').length;
  const expiredSubscriptions = workspace.records.filter((record) => record.subscriptionStatus === 'expired').length;
  const installFollowups = workspace.records.filter(
    (record) => !record.commissioningDate || !record.educationDate,
  ).length;
  const serviceWorkItems = workspace.workItems.filter((workItem) => workItem.workType === 'service');
  const openServices = serviceWorkItems.filter((workItem) => workItem.status !== 'completed').length;
  const openWorkItems = workspace.workItems.filter((workItem) => workItem.status !== 'completed').length;
  const paymentTotal = workspace.historyEntries.reduce((sum, entry) => {
    return workItemById.get(entry.workItemId)?.workType === 'payment' ? sum + entry.amount : sum;
  }, 0);
  const recentHistoryEntries = [...workspace.historyEntries]
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
    .slice(0, 6);

  const selectedFarmHistory = selectedFarm
    ? selectedWorkItems
      .flatMap((workItem) =>
        (historiesByWorkItem.get(workItem.id) ?? []).map((entry) => ({ entry, workItem })),
      )
      .sort((a, b) => b.entry.occurredAt - a.entry.occurredAt || b.entry.createdAt - a.entry.createdAt)
    : [];

  const navItems: Array<{ id: View; label: string; icon: typeof Warehouse; count?: number }> = [
    { id: 'overview', label: '통합 현황', icon: Leaf },
    { id: 'farms', label: '농가 관리대장', icon: Warehouse, count: workspace.farms.length },
    { id: 'projects', label: '사업 관리', icon: BriefcaseBusiness, count: workspace.projects.length },
    { id: 'subscriptions', label: '구독·입금', icon: CreditCard, count: expiredSubscriptions },
    { id: 'service', label: 'A/S 업무', icon: Wrench, count: openServices },
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

  function openProjectDialog() {
    setProjectForm(emptyProjectForm());
    setFormError('');
    setDialog('project');
  }

  function openWorkItemDialog(farmRecordId = '') {
    if (!selectedFarm || !selectedRecords.length) return;
    const safeRecordId = selectedRecords.some((record) => record.id === farmRecordId)
      ? farmRecordId
      : selectedRecords.length === 1
        ? selectedRecords[0].id
        : '';
    setWorkItemForm(emptyWorkItemForm(safeRecordId));
    setFormError('');
    setDialog('work_item');
  }

  function openHistoryDialog(workItem: FarmWorkItem) {
    setSelectedWorkItemId(workItem.id);
    setHistoryForm(emptyHistoryForm(workItem.status));
    setFormError('');
    setDialog('history');
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
      if (!response.ok || !data.project) throw new Error(data.error || '사업을 등록하지 못했습니다.');
      await loadWorkspace(true);
      setDialog(null);
      toast.add({ title: '사업을 등록했습니다', description: projectForm.name, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '사업을 등록하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFarm(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/farm-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'farm',
          farm: {
            farmCode: farmForm.farmCode,
            name: farmForm.name,
            phone: farmForm.phone,
            address: farmForm.address,
            region: farmForm.region,
            businessNumber: farmForm.businessNumber,
            folderUrl: farmForm.folderUrl,
            locationUrl: farmForm.locationUrl,
            specialNotes: farmForm.specialNotes,
          },
          record: {
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
          },
          recorder: farmForm.recorder,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.farm || typeof data.farm !== 'object') {
        throw new Error(data.error || '농가를 등록하지 못했습니다.');
      }
      const farmId = (data.farm as { id: string }).id;
      await loadWorkspace(true);
      setSelectedFarmId(farmId);
      setDialog(null);
      toast.add({ title: '농가를 등록했습니다', description: farmForm.name, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '농가를 등록하지 못했습니다.');
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
    if (!workItemForm.receivedContent.trim() && !workItemForm.actionContent.trim()) {
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
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.workItem) throw new Error(data.error || '업무를 등록하지 못했습니다.');
      const workItemId = (data.workItem as { id: string }).id;
      await loadWorkspace(true);
      setSelectedWorkItemId(workItemId);
      setDialog(null);
      toast.add({ title: '업무를 등록했습니다', description: workItemForm.title, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '업무를 등록하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitHistory(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedWorkItem) return;
    if (!historyForm.receivedContent.trim() && !historyForm.actionContent.trim()) {
      setFormError('받은 내용 또는 처리 내용을 입력해 주세요.');
      return;
    }
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
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.historyEntry) {
        throw new Error(data.error || '진행 기록을 추가하지 못했습니다.');
      }
      await loadWorkspace(true);
      setDialog(null);
      toast.add({ title: '진행 기록을 추가했습니다', description: selectedWorkItem.title, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '진행 기록을 추가하지 못했습니다.');
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

  function WorkItemCard({ workItem, compact = false }: { workItem: FarmWorkItem; compact?: boolean }) {
    const project = projectForWorkItem(workItem);
    const latestReceived = latestEntryWith(workItem, 'receivedContent');
    const latestAction = latestEntryWith(workItem, 'actionContent');
    const isSelected = selectedWorkItemId === workItem.id;
    return (
      <button
        type="button"
        onClick={() => {
          if (selectedFarm?.id === workItem.farmId) setSelectedWorkItemId(workItem.id);
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
              <Badge variant="outline"><WorkIcon type={workItem.workType} className="size-3" />{FARM_WORK_TYPE_LABELS[workItem.workType]}</Badge>
              <Badge variant="outline" className={workStatusClass(workItem.status)}>
                {FARM_WORK_STATUS_LABELS[workItem.status]}
              </Badge>
            </div>
            <h4 className="mt-2 font-semibold text-[#29382f]">{workItem.title}</h4>
            <p className="mt-1 truncate text-xs text-[#7b877f]">
              {project?.name ?? '사업 미연결'} · 담당 {workItem.owner || '미지정'}
            </p>
          </div>
          <time className="shrink-0 text-[11px] text-[#929b94]">
            {formatTimestamp(workItem.lastActivityAt, true)}
          </time>
        </div>
        {!compact && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f6f8f6] p-3">
              <p className="text-[11px] font-semibold text-[#78847c]">마지막 받은 내용</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4e5c53]">
                {latestReceived?.receivedContent || '받은 내용이 없습니다.'}
              </p>
            </div>
            <div className="rounded-xl bg-[#eef6f0] p-3">
              <p className="text-[11px] font-semibold text-[#477356]">마지막 처리 내용</p>
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
              <div><p className="font-bold">팜로그</p><p className="text-[11px] text-white/45">Smart farm ledger</p></div>
            </div>
            <nav aria-label="주요 메뉴" className="space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeView(item.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm ${
                    view === item.id ? 'bg-white/13 font-semibold text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <item.icon className="size-[18px]" /><span>{item.label}</span>
                  {item.count !== undefined && <span className="ml-auto rounded-full bg-white/9 px-2 py-0.5 text-[10px]">{item.count}</span>}
                </button>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs font-semibold text-white/80">원본 관리대장 분석</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[92%] rounded-full bg-[#8bd1a3]" /></div>
              <p className="mt-2 text-[11px] leading-5 text-white/42">297개 농가 · 35개 연결 사업<br />실제 데이터는 이관 전입니다.</p>
              <a href={sourceSheetUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#a9dfb9] hover:underline">
                <ExternalLink className="size-3" />Google 관리대장 열기
              </a>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#dfe7dc] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="grid size-9 place-items-center rounded-xl bg-[#2f7b59] text-white"><Leaf className="size-5" /></div>
                <Select value={view} onValueChange={(value) => changeView(value as View)}>
                  <SelectTrigger aria-label="화면 선택" className="h-9 border-0 bg-transparent font-semibold shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">{navItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="hidden lg:block"><p className="text-sm font-semibold">스마트팜 통합 관리</p><p className="text-xs text-[#748178]">사업과 농가 업무 현황을 한눈에 확인합니다.</p></div>
              <div className="flex items-center gap-2">
                <Button onClick={() => void loadWorkspace(true)} variant="ghost" size="icon-lg" aria-label="새로고침" disabled={refreshing} className="rounded-xl text-[#6e7c73]">
                  {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                </Button>
                <Button onClick={openProjectDialog} variant="outline" className="hidden rounded-xl sm:flex"><Building2 />사업 추가</Button>
                <Button onClick={openFarmDialog} disabled={!workspace.projects.length} className="rounded-xl bg-[#2f7b59] hover:bg-[#286b4d]"><Plus />농가 등록</Button>
              </div>
            </header>

            <div className="px-5 py-7 sm:px-8 lg:px-10">
              {loading ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto size-7 animate-spin text-[#2f7b59]" /><p className="mt-3 text-sm text-[#748178]">농가 관리대장을 불러오는 중입니다.</p></div></div>
              ) : loadError ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="max-w-sm text-center"><AlertCircle className="mx-auto size-8 text-[#b65e3a]" /><h1 className="mt-3 font-bold">관리대장을 불러오지 못했습니다</h1><p className="mt-2 text-sm text-[#748178]">{loadError}</p><Button onClick={() => void loadWorkspace()} className="mt-5"><RefreshCw />다시 시도</Button></div></div>
              ) : (
                <>
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d9e7d7] bg-[#f1f8ef] p-4">
                    <Leaf className="mt-0.5 size-5 shrink-0 text-[#3f8058]" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#315f43]">Google 관리대장 구조를 반영한 새 관리 화면입니다</p><p className="mt-1 text-xs leading-5 text-[#66806d]">현재는 개인정보가 없는 예시 농가 {workspace.farms.length}곳만 들어 있습니다. 원본 297개 농가와 입금·A/S 데이터는 별도 승인 후 안전하게 이관할 수 있습니다.</p></div>
                    <a href={sourceSheetUrl} target="_blank" rel="noreferrer" className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[#39795b] hover:underline sm:flex"><ExternalLink className="size-3.5" />원본 열기</a>
                  </div>

                  {view === 'overview' && (
                    <>
                      <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                        <div><p className="mb-1 text-sm font-medium text-[#647568]">프로그램 등록 현황</p><h1 className="text-[27px] font-bold tracking-[-0.04em] sm:text-[32px]">스마트팜 업무 관리대장</h1><p className="mt-2 text-sm text-[#77847b]">사업별 업무의 마지막 수신 내용, 처리 결과와 전체 과정을 연결합니다.</p></div>
                        <div className="relative w-full xl:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setView('farms')} placeholder="농가명, 사업, 업무, 장비 검색" className="h-10 rounded-xl border-[#dbe3d9] bg-white pl-9" /></div>
                      </div>
                      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          { label: '등록 농가', value: `${workspace.farms.length}곳`, note: `활성 구독 ${activeSubscriptions}곳`, icon: Warehouse, tone: 'bg-[#e6f3ea] text-[#2f7b59]' },
                          { label: '진행 사업', value: `${activeProjects}개`, note: `전체 사업 ${workspace.projects.length}개`, icon: BriefcaseBusiness, tone: 'bg-[#e9f0df] text-[#66843d]' },
                          { label: '처리할 업무', value: `${openWorkItems}건`, note: `처리 중 A/S ${openServices}건`, icon: CalendarClock, tone: 'bg-[#fff0e6] text-[#b46438]' },
                          { label: '입금 기록', value: formatMoney(paymentTotal), note: `구독 만료 ${expiredSubscriptions}곳`, icon: CreditCard, tone: 'bg-[#edf5e8] text-[#5c823e]' },
                        ].map((metric) => <Card key={metric.label} className="border-0 bg-white shadow-sm ring-[#e0e7de]"><CardContent className="flex items-center justify-between px-5 py-1"><div><p className="text-xs text-[#78847b]">{metric.label}</p><p className="mt-1 text-2xl font-bold">{metric.value}</p><p className="mt-1 text-[11px] text-[#929c95]">{metric.note}</p></div><div className={`grid size-11 place-items-center rounded-2xl ${metric.tone}`}><metric.icon className="size-5" /></div></CardContent></Card>)}
                      </section>
                      <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_320px]">
                        <section className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-[#e5ebe3] px-5 py-4"><div><h2 className="font-bold">최근 업무·처리 히스토리</h2><p className="mt-0.5 text-xs text-[#89938c]">업무별 최신 수신 내용과 마지막 처리 결과입니다.</p></div><Button onClick={() => setView('farms')} variant="ghost" className="text-[#39795b]">전체 보기</Button></div>
                          <div className="grid gap-3 p-4 xl:grid-cols-2">
                            {recentHistoryEntries.map((entry) => {
                              const workItem = workItemById.get(entry.workItemId);
                              const farm = workItem ? farmById.get(workItem.farmId) : null;
                              if (!workItem) return null;
                              return <button key={entry.id} type="button" onClick={() => openFarm(workItem.farmId, workItem.id)} className="rounded-2xl border border-[#dfe6dd] bg-white p-4 text-left hover:border-[#bdd8c5]"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{FARM_WORK_TYPE_LABELS[workItem.workType]}</Badge><Badge variant="outline" className={workStatusClass(workItem.status)}>{FARM_WORK_STATUS_LABELS[workItem.status]}</Badge></div><time className="text-[11px] text-[#929b94]">{formatTimestamp(entry.occurredAt, true)}</time></div><h3 className="mt-3 font-semibold">{workItem.title}</h3><p className="mt-1 truncate text-xs text-[#7b877f]">{farm?.name ?? '농가 없음'} · {projectForWorkItem(workItem)?.name ?? '사업 없음'}</p>{entry.receivedContent && <p className="mt-3 line-clamp-2 rounded-xl bg-[#f6f8f6] p-3 text-xs leading-5"><strong className="text-[#78847c]">받은 내용 · </strong>{entry.receivedContent}</p>}{entry.actionContent && <p className="mt-2 line-clamp-2 rounded-xl bg-[#eef6f0] p-3 text-xs leading-5 text-[#476752]"><strong>처리 내용 · </strong>{entry.actionContent}</p>}</button>;
                            })}
                            {!recentHistoryEntries.length && <p className="col-span-full py-14 text-center text-sm text-[#89938c]">농가 상세에서 첫 업무를 등록해 주세요.</p>}
                          </div>
                        </section>
                        <aside className="rounded-2xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
                          <div className="flex items-center gap-2"><CircleAlert className="size-5 text-[#bd6b3d]" /><h2 className="font-bold">확인 필요</h2></div>
                          <div className="mt-4 space-y-3">
                            <button type="button" onClick={() => setView('service')} className="w-full rounded-xl bg-[#fff6ef] p-4 text-left"><p className="text-xs font-semibold text-[#a75b35]">처리 중 A/S</p><p className="mt-1 text-sm font-bold">{openServices}건</p><p className="mt-1 text-xs text-[#8b7a70]">업무의 현재 상태를 기준으로 집계합니다.</p></button>
                            <button type="button" onClick={() => setView('subscriptions')} className="w-full rounded-xl bg-[#f4f8f1] p-4 text-left"><p className="text-xs font-semibold text-[#5e7b43]">구독 만료</p><p className="mt-1 text-sm font-bold">{expiredSubscriptions}개 농가 갱신 확인</p></button>
                            <button type="button" onClick={() => setView('farms')} className="w-full rounded-xl bg-[#f2f6f3] p-4 text-left"><p className="text-xs font-semibold text-[#547160]">설치 후속 단계</p><p className="mt-1 text-sm font-bold">시운전·교육 확인 {installFollowups}곳</p></button>
                          </div>
                        </aside>
                      </div>
                    </>
                  )}

                  {view === 'farms' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><p className="text-sm font-medium text-[#647568]">농가 중심 조회</p><h1 className="mt-1 text-[28px] font-bold">농가 관리대장</h1><p className="mt-2 text-sm text-[#77847b]">농가의 사업 참여, 업무별 마지막 처리 내용과 전체 진행 과정을 연결해서 봅니다.</p></div><Button onClick={openFarmDialog} className="bg-[#2f7b59] hover:bg-[#286b4d]"><Plus />농가 등록</Button></div>
                      <div className="mb-4 grid gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-4 sm:grid-cols-[1fr_190px_150px]">
                        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="농가, 사업, 업무, 받은·처리 내용 검색" className="h-10 pl-9" /></div>
                        <Select value={projectFilter} onValueChange={(value) => setProjectFilter(value ?? 'all')}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 사업</SelectItem>{workspace.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
                        <Select value={subscriptionFilter} onValueChange={(value) => setSubscriptionFilter(value as typeof subscriptionFilter)}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 구독</SelectItem><SelectItem value="active">사용중</SelectItem><SelectItem value="expired">만료</SelectItem><SelectItem value="unregistered">미등록</SelectItem></SelectContent></Select>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm">
                        <Table><TableHeader><TableRow className="bg-[#f7f9f6]"><TableHead className="pl-5">농가</TableHead><TableHead>사업</TableHead><TableHead>지역·장비</TableHead><TableHead>최근 업무</TableHead><TableHead>업무 상태</TableHead><TableHead>구독</TableHead><TableHead className="pr-5 text-right">최근 활동</TableHead></TableRow></TableHeader>
                          <TableBody>{filteredFarms.map((farm) => { const { record, project, latestWorkItem } = farmRow(farm); return <TableRow key={farm.id}><TableCell className="pl-5"><button type="button" onClick={() => openFarm(farm.id)} className="text-left"><p className="font-semibold hover:text-[#2f7b59]">{farm.name}</p><p className="mt-1 text-xs text-[#89938c]">{farm.farmCode}</p></button></TableCell><TableCell className="max-w-[230px]"><p className="truncate">{project?.name ?? '미연결'}</p><p className="mt-1 text-xs text-[#8b958e]">{recordsByFarm.get(farm.id)?.length ?? 0}개 참여 사업</p></TableCell><TableCell><p>{farm.region}</p><p className="mt-1 text-xs text-[#8b958e]">{record?.deviceType || '장비 미입력'}</p></TableCell><TableCell className="max-w-[230px]"><p className="truncate">{latestWorkItem?.title || '등록된 업무 없음'}</p><p className="mt-1 text-xs text-[#8b958e]">{latestWorkItem ? FARM_WORK_TYPE_LABELS[latestWorkItem.workType] : ''}</p></TableCell><TableCell>{latestWorkItem && <Badge variant="outline" className={workStatusClass(latestWorkItem.status)}>{FARM_WORK_STATUS_LABELS[latestWorkItem.status]}</Badge>}</TableCell><TableCell>{record && <Badge variant="outline" className={subscriptionClass(record.subscriptionStatus)}>{SUBSCRIPTION_STATUS_LABELS[record.subscriptionStatus]}</Badge>}</TableCell><TableCell className="pr-5 text-right text-xs text-[#89938c]">{formatTimestamp(farmLastActivity(farm), true)}</TableCell></TableRow>; })}{!filteredFarms.length && <TableRow><TableCell colSpan={7} className="h-40 text-center text-[#89938c]">검색 조건에 맞는 농가가 없습니다.</TableCell></TableRow>}</TableBody>
                        </Table>
                      </div>
                    </section>
                  )}

                  {view === 'projects' && (
                    <section>
                      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#647568]">사업 중심 조회</p><h1 className="mt-1 text-[28px] font-bold">사업 관리</h1><p className="mt-2 text-sm text-[#77847b]">사업별 참여 농가와 진행 업무를 확인합니다.</p></div><Button onClick={openProjectDialog} className="bg-[#2f7b59] hover:bg-[#286b4d]"><Plus />사업 추가</Button></div>
                      <div className="grid gap-4 xl:grid-cols-2">{workspace.projects.map((project) => { const records = workspace.records.filter((record) => record.projectId === project.id); const ids = new Set(records.map((record) => record.id)); const items = workspace.workItems.filter((item) => ids.has(item.farmRecordId)); const openCount = items.filter((item) => item.status !== 'completed').length; const done = records.reduce((sum, record) => sum + installProgress(record).complete, 0); const progress = records.length ? Math.round(done / (records.length * 4) * 100) : 0; return <Card key={project.id} className="border-0 bg-white shadow-sm ring-[#dfe6dd]"><CardContent className="px-5 py-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline">{project.year}</Badge><Badge variant="outline">{FARM_PROJECT_TYPE_LABELS[project.projectType]}</Badge><Badge variant="outline">{FARM_PROJECT_STATUS_LABELS[project.status]}</Badge></div><h2 className="truncate text-lg font-bold">{project.name}</h2><p className="mt-1 text-sm text-[#748178]">{project.institution}</p></div><div className="grid size-12 place-items-center rounded-2xl bg-[#e8f3e5] text-[#4c7c48]"><BriefcaseBusiness className="size-5" /></div></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[#66736b]">{project.description || '사업 설명이 없습니다.'}</p><div className="mt-5 grid grid-cols-4 gap-3"><div><p className="text-[11px] text-[#89938c]">농가</p><p className="mt-1 font-bold">{records.length}곳</p></div><div><p className="text-[11px] text-[#89938c]">목표</p><p className="mt-1 font-bold">{project.targetFarmCount || '-'}곳</p></div><div><p className="text-[11px] text-[#89938c]">진행 업무</p><p className="mt-1 font-bold">{openCount}건</p></div><div><p className="text-[11px] text-[#89938c]">설치</p><p className="mt-1 font-bold">{progress}%</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1ec]"><div className="h-full rounded-full bg-[#62b982]" style={{ width: `${progress}%` }} /></div></CardContent></Card>; })}</div>
                    </section>
                  )}

                  {view === 'subscriptions' && (
                    <section>
                      <div className="mb-6"><p className="text-sm font-medium text-[#647568]">구독과 입금</p><h1 className="mt-1 text-[28px] font-bold">구독·입금 관리</h1><p className="mt-2 text-sm text-[#77847b]">만료일과 마지막 입금일, 입금 업무 히스토리를 함께 확인합니다.</p></div>
                      <div className="mb-4 grid gap-3 sm:grid-cols-3"><Card className="border-0 bg-white ring-[#dfe6dd]"><CardContent><p className="text-xs text-[#7a867d]">사용중</p><p className="mt-1 text-2xl font-bold text-[#2f7b59]">{activeSubscriptions}곳</p></CardContent></Card><Card className="border-0 bg-white ring-[#dfe6dd]"><CardContent><p className="text-xs text-[#7a867d]">만료·미등록</p><p className="mt-1 text-2xl font-bold text-[#b46438]">{workspace.records.length - activeSubscriptions}곳</p></CardContent></Card><Card className="border-0 bg-white ring-[#dfe6dd]"><CardContent><p className="text-xs text-[#7a867d]">히스토리 입금 합계</p><p className="mt-1 text-2xl font-bold">{formatMoney(paymentTotal)}</p></CardContent></Card></div>
                      <div className="overflow-hidden rounded-2xl border border-[#dfe6dd] bg-white shadow-sm"><Table><TableHeader><TableRow className="bg-[#f7f9f6]"><TableHead className="pl-5">농가</TableHead><TableHead>사업</TableHead><TableHead>구독 만료일</TableHead><TableHead>마지막 입금일</TableHead><TableHead>갱신횟수</TableHead><TableHead className="pr-5">상태</TableHead></TableRow></TableHeader><TableBody>{[...workspace.records].sort((a, b) => (a.currentSubscriptionExpiresAt || '9999').localeCompare(b.currentSubscriptionExpiresAt || '9999')).map((record) => { const farm = farmById.get(record.farmId); const project = projectById.get(record.projectId); return <TableRow key={record.id}><TableCell className="pl-5"><button type="button" onClick={() => openFarm(record.farmId)} className="font-semibold hover:text-[#2f7b59]">{farm?.name ?? '농가 없음'}</button></TableCell><TableCell className="max-w-[280px] truncate">{project?.name ?? '사업 없음'}</TableCell><TableCell>{formatDate(record.currentSubscriptionExpiresAt)}</TableCell><TableCell>{formatDate(record.lastPaymentDate)}</TableCell><TableCell>{record.renewalCount}회</TableCell><TableCell className="pr-5"><Badge variant="outline" className={subscriptionClass(record.subscriptionStatus)}>{SUBSCRIPTION_STATUS_LABELS[record.subscriptionStatus]}</Badge></TableCell></TableRow>; })}</TableBody></Table></div>
                    </section>
                  )}

                  {view === 'service' && (
                    <section>
                      <div className="mb-6"><p className="text-sm font-medium text-[#647568]">농가 장애 대응</p><h1 className="mt-1 text-[28px] font-bold">A/S 업무 관리</h1><p className="mt-2 text-sm text-[#77847b]">A/S 업무의 현재 상태와 마지막 수신·처리 결과를 확인합니다.</p></div>
                      {serviceWorkItems.length ? <div className="grid gap-4 xl:grid-cols-2">{[...serviceWorkItems].sort((a, b) => b.lastActivityAt - a.lastActivityAt).map((item) => { const farm = farmById.get(item.farmId); const project = projectForWorkItem(item); const received = latestEntryWith(item, 'receivedContent'); const action = latestEntryWith(item, 'actionContent'); return <button key={item.id} type="button" onClick={() => openFarm(item.farmId, item.id)} className="rounded-2xl border border-[#dfe6dd] bg-white p-5 text-left shadow-sm hover:bg-[#fafcf9]"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={workStatusClass(item.status)}>{FARM_LOG_STATUS_LABELS[item.status]}</Badge><span className="text-xs text-[#89938c]">{formatTimestamp(item.lastActivityAt)}</span></div><h2 className="mt-3 font-bold">{item.title}</h2><p className="mt-1 text-sm text-[#69766e]">{farm?.name ?? '농가 없음'} · {project?.name ?? '사업 없음'}</p></div><div className="grid size-10 place-items-center rounded-xl bg-[#fff1e8] text-[#b46438]"><Wrench className="size-5" /></div></div><div className="mt-4 rounded-xl bg-[#f6f8f6] p-3"><p className="text-[11px] font-semibold text-[#7a867d]">마지막 받은 내용</p><p className="mt-1 line-clamp-2 text-sm leading-6">{received?.receivedContent || '받은 내용이 없습니다.'}</p></div><div className="mt-3 rounded-xl bg-[#eef6f0] p-3"><p className="text-[11px] font-semibold text-[#477356]">마지막 처리 내용</p><p className="mt-1 line-clamp-2 text-sm leading-6">{action?.actionContent || '처리 내용이 없습니다.'}</p></div><div className="mt-3 flex items-center justify-between text-xs text-[#89938c]"><span>담당 {item.owner || '미지정'}</span><ArrowRight className="size-4" /></div></button>; })}</div> : <div className="rounded-2xl border border-[#dfe6dd] bg-white py-16 text-center"><Wrench className="mx-auto size-8 text-[#9aa49d]" /><p className="mt-3 font-semibold">등록된 A/S 업무가 없습니다.</p></div>}
                    </section>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        <Sheet open={Boolean(selectedFarm)} onOpenChange={(open) => { if (!open) { setSelectedFarmId(''); setSelectedWorkItemId(''); } }}>
          <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[820px]">
            {selectedFarm && <><SheetHeader className="border-b border-[#e2e8e1] px-6 py-5 pr-14"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="bg-[#f1f7ef] text-[#4a7448]">{selectedFarm.farmCode}</Badge><Badge variant="outline">{selectedFarm.region}</Badge><Badge variant="outline">참여 사업 {selectedRecords.length}개</Badge><Badge variant="outline">진행 업무 {selectedWorkItems.filter((item) => item.status !== 'completed').length}건</Badge></div><SheetTitle className="text-xl font-bold">{selectedFarm.name}</SheetTitle><SheetDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1"><span className="flex items-center gap-1"><Phone className="size-3.5" />{selectedFarm.phone || '연락처 미입력'}</span><span className="flex items-center gap-1"><MapPin className="size-3.5" />{selectedFarm.address || selectedFarm.region}</span></SheetDescription></SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-wrap gap-2">{selectedFarm.folderUrl && <a href={selectedFarm.folderUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><FolderOpen />농장 폴더</Button></a>}{selectedFarm.locationUrl && <a href={selectedFarm.locationUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><MapPin />위치도</Button></a>}<Button onClick={() => openWorkItemDialog()} size="sm" disabled={!selectedRecords.length} className="bg-[#2f7b59] hover:bg-[#286b4d]"><Plus />새 업무 등록</Button></div>
                {selectedFarm.specialNotes && <div className="mt-4 rounded-2xl bg-[#f4f7f3] p-4"><p className="text-xs font-semibold text-[#65736a]">특이사항</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selectedFarm.specialNotes}</p></div>}

                <section className="mt-6"><div><h3 className="font-bold">참여 사업·설치 정보</h3><p className="mt-0.5 text-xs text-[#89938c]">업무를 등록할 때 반드시 아래 사업 중 하나에 연결합니다.</p></div><div className="mt-3 space-y-3">{selectedRecords.map((record) => { const project = projectById.get(record.projectId); const progress = installProgress(record); return <article key={record.id} className="rounded-2xl border border-[#dfe6dd] p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{project?.year ?? '-'}</Badge><Badge variant="outline" className={subscriptionClass(record.subscriptionStatus)}>{SUBSCRIPTION_STATUS_LABELS[record.subscriptionStatus]}</Badge></div><h4 className="mt-2 font-semibold">{project?.name ?? '사업 없음'}</h4><p className="mt-1 text-xs text-[#879088]">{record.crop || '작물 미입력'} · {record.deviceType || '장비 미입력'} · {record.productType || '제품 미입력'}</p></div><div className="text-right"><p className="text-[11px] text-[#879088]">설치 단계</p><p className="mt-1 font-bold text-[#39795b]">{progress.complete}/4</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#68766d]">보증 {formatDate(record.warrantyExpiresAt)} · 구독 {formatDate(record.currentSubscriptionExpiresAt)}</p><Button onClick={() => openWorkItemDialog(record.id)} size="sm" variant="outline"><Plus />이 사업에 업무 등록</Button></div></article>; })}</div></section>

                <section className="mt-7"><div className="flex items-center justify-between"><div><h3 className="font-bold">농가 업무</h3><p className="mt-0.5 text-xs text-[#89938c]">현재 상태와 마지막 받은·처리 내용을 확인합니다.</p></div><Button onClick={() => openWorkItemDialog()} size="sm" variant="outline"><Plus />업무 등록</Button></div><div className="mt-4 grid gap-3">{selectedWorkItems.map((item) => <WorkItemCard key={item.id} workItem={item} />)}{!selectedWorkItems.length && <div className="rounded-2xl border border-dashed border-[#d7dfd5] py-10 text-center"><FileText className="mx-auto size-7 text-[#9aa49d]" /><p className="mt-3 text-sm font-semibold">등록된 업무가 없습니다.</p><p className="mt-1 text-xs text-[#89938c]">메일·카톡·전화·구두 내용을 첫 업무로 남겨보세요.</p></div>}</div></section>

                {selectedWorkItem && selectedWorkItem.farmId === selectedFarm.id && <section className="mt-7 rounded-3xl border border-[#cfe0d1] bg-[#f8fbf7] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><button type="button" onClick={() => setSelectedWorkItemId('')} className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#66806d]"><ArrowLeft className="size-3.5" />업무 목록으로</button><div className="flex flex-wrap gap-2"><Badge variant="outline">{FARM_LOG_TYPE_LABELS[selectedWorkItem.workType]}</Badge><Badge variant="outline" className={workStatusClass(selectedWorkItem.status)}>{FARM_LOG_STATUS_LABELS[selectedWorkItem.status]}</Badge><Badge variant="outline">{projectForWorkItem(selectedWorkItem)?.name ?? '사업 없음'}</Badge></div><h3 className="mt-3 text-lg font-bold">{selectedWorkItem.title}</h3><p className="mt-1 text-sm text-[#68766d]">담당 {selectedWorkItem.owner || '미지정'} · 기한 {formatDate(selectedWorkItem.dueDate)}</p>{selectedWorkItem.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{selectedWorkItem.description}</p>}</div><Button onClick={() => openHistoryDialog(selectedWorkItem)} size="sm" className="shrink-0 bg-[#2f7b59] hover:bg-[#286b4d]"><Plus />진행 기록 추가</Button></div><div className="mt-5 border-t border-[#dde7dc] pt-5"><h4 className="text-sm font-bold">전체 진행 히스토리</h4><ol className="mt-4 space-y-3">{selectedWorkHistory.map((entry) => <li key={entry.id} className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full border bg-white text-[#52745e]"><ChannelIcon channel={entry.channel} /></div><article className="min-w-0 flex-1 rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[#66736b]">{FARM_LOG_CHANNEL_LABELS[entry.channel]}{entry.sender ? ` · ${entry.sender}` : ''}</p><time className="text-[11px] text-[#929b94]">{formatTimestamp(entry.occurredAt)}</time></div>{entry.receivedContent && <div className="mt-3 rounded-xl bg-[#f6f8f6] p-3"><p className="text-[11px] font-semibold text-[#78847c]">받은 내용</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{entry.receivedContent}</p></div>}{entry.actionContent && <div className="mt-3 rounded-xl bg-[#eef6f0] p-3"><p className="text-[11px] font-semibold text-[#477356]">처리 내용</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{entry.actionContent}</p></div>}<div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#8a948d]"><span>기록자 {entry.recorder}</span>{entry.amount > 0 && <strong className="text-[#39795b]">{formatMoney(entry.amount)}</strong>}{entry.referenceUrl && <a href={entry.referenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-[#39795b]"><ExternalLink className="size-3" />참고 링크</a>}</div></article></li>)}</ol></div></section>}

                <section className="mt-7"><div><h3 className="font-bold">농가 전체 히스토리</h3><p className="mt-0.5 text-xs text-[#89938c]">어느 사업과 업무에 속하는 기록인지 함께 표시합니다.</p></div><ol className="mt-4 space-y-3">{selectedFarmHistory.map(({ entry, workItem }) => <li key={entry.id} className="rounded-2xl border border-[#e0e6df] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{projectForWorkItem(workItem)?.name ?? '사업 없음'}</Badge><Badge variant="outline">{FARM_LOG_TYPE_LABELS[workItem.workType]}</Badge><span className="text-xs font-semibold">{workItem.title}</span></div><time className="text-[11px] text-[#929b94]">{formatTimestamp(entry.occurredAt)}</time></div>{entry.receivedContent && <p className="mt-3 line-clamp-2 text-sm leading-6"><strong className="text-[#78847c]">받은 내용 · </strong>{entry.receivedContent}</p>}{entry.actionContent && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#476752]"><strong>처리 내용 · </strong>{entry.actionContent}</p>}<button type="button" onClick={() => setSelectedWorkItemId(workItem.id)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#39795b]">업무 전체 과정 보기 <ArrowRight className="size-3.5" /></button></li>)}{!selectedFarmHistory.length && <li className="rounded-2xl border border-dashed py-8 text-center text-sm text-[#89938c]">아직 기록된 히스토리가 없습니다.</li>}</ol></section>
              </div></>}
          </SheetContent>
        </Sheet>

        <Dialog open={dialog === 'project'} onOpenChange={(open) => !submitting && setDialog(open ? 'project' : null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[600px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">스마트팜 사업 등록</DialogTitle><DialogDescription>사업별 참여 농가와 진행 업무를 연결합니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitProject} className="mt-1 space-y-4">
              <Field><FieldLabel>사업명</FieldLabel><Input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="예: 2026 데이터 기반 스마트농업" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>사업 유형</FieldLabel><Select value={projectForm.projectType} onValueChange={(value) => setProjectForm((current) => ({ ...current, projectType: value as FarmProjectType }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">일반 사업</SelectItem><SelectItem value="research">연구 사업</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>기준 연도</FieldLabel><Input type="number" min={2000} max={2100} value={projectForm.year} onChange={(event) => setProjectForm((current) => ({ ...current, year: Number(event.target.value) }))} /></Field>
                <Field><FieldLabel>주관기관</FieldLabel><Input value={projectForm.institution} onChange={(event) => setProjectForm((current) => ({ ...current, institution: event.target.value }))} placeholder="예: 지역 농업기술원" /></Field>
                <Field><FieldLabel>목표 농가 수</FieldLabel><Input type="number" min={0} value={projectForm.targetFarmCount} onChange={(event) => setProjectForm((current) => ({ ...current, targetFarmCount: Number(event.target.value) }))} /></Field>
                <Field><FieldLabel>사업 상태</FieldLabel><Select value={projectForm.status} onValueChange={(value) => setProjectForm((current) => ({ ...current, status: value as FarmProjectStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">진행 중</SelectItem><SelectItem value="completed">완료</SelectItem><SelectItem value="on_hold">보류</SelectItem></SelectContent></Select></Field>
              </div>
              <Field><FieldLabel>사업 설명</FieldLabel><Textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="사업 목적과 범위를 적어 주세요." className="min-h-24" /></Field>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#2f7b59] hover:bg-[#286b4d]">{submitting && <Loader2 className="animate-spin" />}사업 등록</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'farm'} onOpenChange={(open) => !submitting && setDialog(open ? 'farm' : null)}>
          <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-[860px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">농가 관리대장 등록</DialogTitle><DialogDescription>농가 기본정보와 첫 사업·설치·구독 정보를 함께 저장합니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitFarm} className="mt-1 space-y-6">
              <section><h3 className="mb-4 text-sm font-bold text-[#365644]">1. 농가 기본정보</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field><FieldLabel>농장번호</FieldLabel><Input value={farmForm.farmCode} onChange={(event) => setFarmForm((current) => ({ ...current, farmCode: event.target.value }))} placeholder="예: FARM-001" /></Field>
                <Field><FieldLabel>농장명</FieldLabel><Input value={farmForm.name} onChange={(event) => setFarmForm((current) => ({ ...current, name: event.target.value }))} placeholder="농장 또는 농가명" /></Field>
                <Field><FieldLabel>연락처</FieldLabel><Input value={farmForm.phone} onChange={(event) => setFarmForm((current) => ({ ...current, phone: event.target.value }))} placeholder="010-0000-0000" /></Field>
                <Field><FieldLabel>지역</FieldLabel><Input value={farmForm.region} onChange={(event) => setFarmForm((current) => ({ ...current, region: event.target.value }))} placeholder="예: 김천" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>주소</FieldLabel><Input value={farmForm.address} onChange={(event) => setFarmForm((current) => ({ ...current, address: event.target.value }))} placeholder="농장 주소" /></Field>
                <Field><FieldLabel>경영체번호</FieldLabel><Input value={farmForm.businessNumber} onChange={(event) => setFarmForm((current) => ({ ...current, businessNumber: event.target.value }))} /></Field>
                <Field><FieldLabel>농장 폴더 링크</FieldLabel><Input type="url" value={farmForm.folderUrl} onChange={(event) => setFarmForm((current) => ({ ...current, folderUrl: event.target.value }))} placeholder="https://..." /></Field>
                <Field><FieldLabel>농장 위치도 링크</FieldLabel><Input type="url" value={farmForm.locationUrl} onChange={(event) => setFarmForm((current) => ({ ...current, locationUrl: event.target.value }))} placeholder="https://..." /></Field>
                <Field className="sm:col-span-2 lg:col-span-3"><FieldLabel>특이사항</FieldLabel><Textarea value={farmForm.specialNotes} onChange={(event) => setFarmForm((current) => ({ ...current, specialNotes: event.target.value }))} placeholder="현장 대응에 필요한 특이사항" /></Field>
              </div></section>
              <section className="border-t border-[#e3e8e2] pt-6"><h3 className="mb-4 text-sm font-bold text-[#365644]">2. 사업·장비 정보</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field className="sm:col-span-2 lg:col-span-3"><FieldLabel>참여 사업</FieldLabel><Select value={farmForm.projectId} onValueChange={(value) => setFarmForm((current) => ({ ...current, projectId: value ?? '' }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{workspace.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field><FieldLabel>작물</FieldLabel><Input value={farmForm.crop} onChange={(event) => setFarmForm((current) => ({ ...current, crop: event.target.value }))} placeholder="포도, 딸기, 사과 등" /></Field>
                <Field><FieldLabel>장비 종류</FieldLabel><Input value={farmForm.deviceType} onChange={(event) => setFarmForm((current) => ({ ...current, deviceType: event.target.value }))} placeholder="클라우드, 라떼판다 등" /></Field>
                <Field><FieldLabel>제품 종류</FieldLabel><Input value={farmForm.productType} onChange={(event) => setFarmForm((current) => ({ ...current, productType: event.target.value }))} placeholder="관수내비, 온실내비 등" /></Field>
                <Field><FieldLabel>장비업체</FieldLabel><Input value={farmForm.vendor} onChange={(event) => setFarmForm((current) => ({ ...current, vendor: event.target.value }))} /></Field>
                <Field><FieldLabel>인터넷 유형</FieldLabel><Input value={farmForm.internetType} onChange={(event) => setFarmForm((current) => ({ ...current, internetType: event.target.value }))} placeholder="유선, 무선 라우터 등" /></Field>
                <Field><FieldLabel>사업 비고</FieldLabel><Input value={farmForm.notes} onChange={(event) => setFarmForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
              </div></section>
              <section className="border-t border-[#e3e8e2] pt-6"><h3 className="mb-4 text-sm font-bold text-[#365644]">3. 설치 진행 단계</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field><FieldLabel>제작·세팅 완료일</FieldLabel><Input type="date" value={farmForm.productionSetupDate} onChange={(event) => setFarmForm((current) => ({ ...current, productionSetupDate: event.target.value }))} /></Field>
                <Field><FieldLabel>제품 설치일</FieldLabel><Input type="date" value={farmForm.installationDate} onChange={(event) => { const installationDate = event.target.value; setFarmForm((current) => ({ ...current, installationDate, warrantyExpiresAt: addYears(installationDate, current.warrantyYears) })); }} /></Field>
                <Field><FieldLabel>시운전 완료일</FieldLabel><Input type="date" value={farmForm.commissioningDate} onChange={(event) => setFarmForm((current) => ({ ...current, commissioningDate: event.target.value }))} /></Field>
                <Field><FieldLabel>교육 완료일</FieldLabel><Input type="date" value={farmForm.educationDate} onChange={(event) => setFarmForm((current) => ({ ...current, educationDate: event.target.value }))} /></Field>
              </div></section>
              <section className="border-t border-[#e3e8e2] pt-6"><h3 className="mb-4 text-sm font-bold text-[#365644]">4. 보증·구독</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field><FieldLabel>보증기간(년)</FieldLabel><Input type="number" min={0} max={20} value={farmForm.warrantyYears} onChange={(event) => { const years = Number(event.target.value); setFarmForm((current) => ({ ...current, warrantyYears: years, warrantyExpiresAt: current.installationDate ? addYears(current.installationDate, years) : current.warrantyExpiresAt })); }} /></Field>
                <Field><FieldLabel>보증 만료일</FieldLabel><Input type="date" value={farmForm.warrantyExpiresAt} onChange={(event) => setFarmForm((current) => ({ ...current, warrantyExpiresAt: event.target.value }))} /></Field>
                <Field><FieldLabel>구독기간(년)</FieldLabel><Input type="number" min={0} max={20} value={farmForm.subscriptionYears} onChange={(event) => setFarmForm((current) => ({ ...current, subscriptionYears: Number(event.target.value) }))} /></Field>
                <Field><FieldLabel>구독 상태</FieldLabel><Select value={farmForm.subscriptionStatus} onValueChange={(value) => setFarmForm((current) => ({ ...current, subscriptionStatus: value as SubscriptionStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">사용중</SelectItem><SelectItem value="expired">만료</SelectItem><SelectItem value="unregistered">미등록</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>최초 구독 만료일</FieldLabel><Input type="date" value={farmForm.initialSubscriptionExpiresAt} onChange={(event) => setFarmForm((current) => ({ ...current, initialSubscriptionExpiresAt: event.target.value }))} /></Field>
                <Field><FieldLabel>현재 구독 만료일</FieldLabel><Input type="date" value={farmForm.currentSubscriptionExpiresAt} onChange={(event) => setFarmForm((current) => ({ ...current, currentSubscriptionExpiresAt: event.target.value }))} /></Field>
                <Field><FieldLabel>마지막 입금일</FieldLabel><Input type="date" value={farmForm.lastPaymentDate} onChange={(event) => setFarmForm((current) => ({ ...current, lastPaymentDate: event.target.value }))} /></Field>
                <Field><FieldLabel>갱신횟수</FieldLabel><Input type="number" min={0} value={farmForm.renewalCount} onChange={(event) => setFarmForm((current) => ({ ...current, renewalCount: Number(event.target.value) }))} /></Field>
                <Field><FieldLabel>등록자</FieldLabel><Input value={farmForm.recorder} onChange={(event) => setFarmForm((current) => ({ ...current, recorder: event.target.value }))} placeholder="기록한 담당자" /></Field>
              </div></section>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#2f7b59] hover:bg-[#286b4d]">{submitting && <Loader2 className="animate-spin" />}관리대장 등록</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'work_item'} onOpenChange={(open) => !submitting && setDialog(open ? 'work_item' : null)}>
          <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-[760px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">농가 업무 등록</DialogTitle><DialogDescription>{selectedFarm?.name} 농가의 업무를 참여 사업에 연결하고 최초 수신·처리 내용을 기록합니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitWorkItem} className="mt-1 space-y-5">
              <section className="space-y-4">
                <Field><FieldLabel>연결 사업</FieldLabel><Select value={workItemForm.farmRecordId} onValueChange={(value) => setWorkItemForm((current) => ({ ...current, farmRecordId: value ?? '' }))}><SelectTrigger className="h-10 w-full"><SelectValue placeholder="업무를 연결할 사업을 선택하세요" /></SelectTrigger><SelectContent>{selectedRecords.map((record) => <SelectItem key={record.id} value={record.id}>{projectById.get(record.projectId)?.name ?? '사업 없음'} · {record.deviceType || '장비 미입력'}</SelectItem>)}</SelectContent></Select></Field>
                {selectedRecords.length > 1 && !workItemForm.farmRecordId && <p className="rounded-xl bg-[#fff6ef] px-3 py-2 text-xs text-[#9b613d]">여러 사업에 참여 중입니다. 기록 오귀속을 막기 위해 사업을 직접 선택해 주세요.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>업무 유형</FieldLabel><Select value={workItemForm.workType} onValueChange={(value) => setWorkItemForm((current) => ({ ...current, workType: value as WorkType }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="communication">수신·연락</SelectItem><SelectItem value="installation">설치·교육</SelectItem><SelectItem value="subscription">구독</SelectItem><SelectItem value="payment">입금</SelectItem><SelectItem value="service">A/S</SelectItem><SelectItem value="note">관리 메모</SelectItem></SelectContent></Select></Field>
                  <Field><FieldLabel>현재 상태</FieldLabel><Select value={workItemForm.status} onValueChange={(value) => setWorkItemForm((current) => ({ ...current, status: value as WorkStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">접수</SelectItem><SelectItem value="in_progress">처리 중</SelectItem><SelectItem value="waiting">회신 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
                  <Field className="sm:col-span-2"><FieldLabel>업무 제목</FieldLabel><Input value={workItemForm.title} onChange={(event) => setWorkItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 센서 게이트웨이 통신 불량 확인" /></Field>
                  <Field><FieldLabel>담당자</FieldLabel><Input value={workItemForm.owner} onChange={(event) => setWorkItemForm((current) => ({ ...current, owner: event.target.value }))} placeholder="처리 담당자" /></Field>
                  <Field><FieldLabel>처리 기한</FieldLabel><Input type="date" value={workItemForm.dueDate} onChange={(event) => setWorkItemForm((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
                  <Field className="sm:col-span-2"><FieldLabel>업무 설명</FieldLabel><Textarea value={workItemForm.description} onChange={(event) => setWorkItemForm((current) => ({ ...current, description: event.target.value }))} placeholder="업무 범위, 확인 사항이나 다음 일정을 적어 주세요." /></Field>
                </div>
              </section>
              <section className="border-t border-[#e3e8e2] pt-5"><h3 className="mb-4 text-sm font-bold text-[#365644]">최초 수신·처리 기록</h3><div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>수신 경로</FieldLabel><Select value={workItemForm.channel} onValueChange={(value) => setWorkItemForm((current) => ({ ...current, channel: value as HistoryChannel }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">메일</SelectItem><SelectItem value="kakao">카톡</SelectItem><SelectItem value="verbal">구두</SelectItem><SelectItem value="phone">전화</SelectItem><SelectItem value="meeting">회의</SelectItem><SelectItem value="system">시스템</SelectItem><SelectItem value="other">기타</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>발생 일시</FieldLabel><Input type="datetime-local" value={workItemForm.occurredAt} onChange={(event) => setWorkItemForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <Field><FieldLabel>전달자·기관</FieldLabel><Input value={workItemForm.sender} onChange={(event) => setWorkItemForm((current) => ({ ...current, sender: event.target.value }))} placeholder="받은 내용이 있다면 입력" /></Field>
                <Field><FieldLabel>금액(원)</FieldLabel><Input type="number" min={0} value={workItemForm.amount} onChange={(event) => setWorkItemForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></Field>
                <Field className="sm:col-span-2"><FieldLabel>받은 내용</FieldLabel><Textarea value={workItemForm.receivedContent} onChange={(event) => setWorkItemForm((current) => ({ ...current, receivedContent: event.target.value }))} placeholder="메일·카톡·전화·구두로 전달받은 내용을 적어 주세요." className="min-h-24" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>처리 내용</FieldLabel><Textarea value={workItemForm.actionContent} onChange={(event) => setWorkItemForm((current) => ({ ...current, actionContent: event.target.value }))} placeholder="확인, 조치, 회신 등 지금까지 처리한 내용을 적어 주세요." className="min-h-24" /></Field>
                <Field><FieldLabel>기록자</FieldLabel><Input value={workItemForm.recorder} onChange={(event) => setWorkItemForm((current) => ({ ...current, recorder: event.target.value }))} placeholder="기록한 담당자" /></Field>
                <Field><FieldLabel>참고 링크</FieldLabel><div className="relative"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" /><Input type="url" value={workItemForm.referenceUrl} onChange={(event) => setWorkItemForm((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className="pl-9" /></div></Field>
              </div></section>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#2f7b59] hover:bg-[#286b4d]">{submitting && <Loader2 className="animate-spin" />}업무 등록</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'history'} onOpenChange={(open) => !submitting && setDialog(open ? 'history' : null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[700px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">진행 기록 추가</DialogTitle><DialogDescription>{selectedWorkItem?.title} 업무의 새 수신·처리 내용과 변경 상태를 남깁니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitHistory} className="mt-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>수신 경로</FieldLabel><Select value={historyForm.channel} onValueChange={(value) => setHistoryForm((current) => ({ ...current, channel: value as HistoryChannel }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">메일</SelectItem><SelectItem value="kakao">카톡</SelectItem><SelectItem value="verbal">구두</SelectItem><SelectItem value="phone">전화</SelectItem><SelectItem value="meeting">회의</SelectItem><SelectItem value="system">시스템</SelectItem><SelectItem value="other">기타</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>변경 상태</FieldLabel><Select value={historyForm.newStatus} onValueChange={(value) => setHistoryForm((current) => ({ ...current, newStatus: value as WorkStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">접수</SelectItem><SelectItem value="in_progress">처리 중</SelectItem><SelectItem value="waiting">회신 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>발생 일시</FieldLabel><Input type="datetime-local" value={historyForm.occurredAt} onChange={(event) => setHistoryForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <Field><FieldLabel>전달자·기관</FieldLabel><Input value={historyForm.sender} onChange={(event) => setHistoryForm((current) => ({ ...current, sender: event.target.value }))} placeholder="새로 받은 내용이 있다면 입력" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>받은 내용</FieldLabel><Textarea value={historyForm.receivedContent} onChange={(event) => setHistoryForm((current) => ({ ...current, receivedContent: event.target.value }))} placeholder="추가로 전달받은 내용을 적어 주세요." className="min-h-24" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>처리 내용</FieldLabel><Textarea value={historyForm.actionContent} onChange={(event) => setHistoryForm((current) => ({ ...current, actionContent: event.target.value }))} placeholder="이번에 확인하거나 처리한 내용과 다음 일정을 적어 주세요." className="min-h-24" /></Field>
                <Field><FieldLabel>금액(원)</FieldLabel><Input type="number" min={0} value={historyForm.amount} onChange={(event) => setHistoryForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></Field>
                <Field><FieldLabel>기록자</FieldLabel><Input value={historyForm.recorder} onChange={(event) => setHistoryForm((current) => ({ ...current, recorder: event.target.value }))} placeholder="기록한 담당자" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>참고 링크</FieldLabel><div className="relative"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#99a39c]" /><Input type="url" value={historyForm.referenceUrl} onChange={(event) => setHistoryForm((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className="pl-9" /></div></Field>
              </div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 px-0 pb-0 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#2f7b59] hover:bg-[#286b4d]">{submitting && <Loader2 className="animate-spin" />}진행 기록 저장</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </Toaster>
  );
}
