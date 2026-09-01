'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Inbox,
  Link2,
  Loader2,
  Mail,
  MessageCircleMore,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
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
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import {
  HISTORY_CHANNEL_LABELS,
  PROJECT_STATUS_LABELS,
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  type BusinessWorkspace,
  type HistoryChannel,
  type HistoryEntry,
  type ProjectInput,
  type ProjectStatus,
  type WorkItem,
  type WorkItemInput,
  type WorkPriority,
  type WorkStatus,
} from '@/lib/business-types';

type DialogKind = 'project' | 'work' | 'history' | null;
type StatusFilter = 'all' | WorkStatus;
type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0];

interface HistoryForm {
  channel: HistoryChannel;
  sourceSender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: string;
  referenceUrl: string;
  newStatus: WorkStatus;
}

interface WorkForm extends WorkItemInput {
  channel: HistoryChannel;
  sourceSender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: string;
  referenceUrl: string;
}

const emptyWorkspace: BusinessWorkspace = {
  projects: [],
  workItems: [],
  historyEntries: [],
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateWithOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDateString(date);
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatTimestamp(timestamp: number, compact = false) {
  const date = new Date(timestamp);
  const today = localDateString();
  const target = localDateString(date);
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  if (target === today) return compact ? `오늘 ${time}` : `오늘 ${time}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (target === localDateString(yesterday)) return `어제 ${time}`;

  return new Intl.DateTimeFormat('ko-KR', {
    ...(compact ? {} : { year: 'numeric' as const }),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function dueLabel(item: WorkItem) {
  if (item.status === 'completed') return '완료됨';
  const today = localDateString();
  if (item.dueDate === today) return '오늘까지';
  if (item.dueDate < today) {
    const due = new Date(`${item.dueDate}T00:00:00`);
    const now = new Date(`${today}T00:00:00`);
    const days = Math.max(1, Math.round((now.getTime() - due.getTime()) / 86400000));
    return `${days}일 지연`;
  }
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(`${item.dueDate}T00:00:00`),
  );
}

function emptyProjectForm(): ProjectInput {
  return {
    name: '',
    client: '',
    manager: '',
    status: 'active',
    description: '',
  };
}

function emptyWorkForm(projectId: string): WorkForm {
  return {
    projectId,
    title: '',
    category: '일반',
    status: 'received',
    priority: 'medium',
    owner: '',
    dueDate: dateWithOffset(3),
    description: '',
    channel: 'email',
    sourceSender: '',
    receivedContent: '',
    actionContent: '',
    recorder: '',
    occurredAt: localDateTimeValue(),
    referenceUrl: '',
  };
}

function emptyHistoryForm(status: WorkStatus): HistoryForm {
  return {
    channel: 'email',
    sourceSender: '',
    receivedContent: '',
    actionContent: '',
    recorder: '',
    occurredAt: localDateTimeValue(),
    referenceUrl: '',
    newStatus: status,
  };
}

function statusClass(status: WorkStatus) {
  if (status === 'in_progress') return 'border-[#bee9d8] bg-[#eefaf5] text-[#16805b]';
  if (status === 'waiting') return 'border-[#ead9b8] bg-[#fff9ed] text-[#9b641b]';
  if (status === 'completed') return 'border-[#cddaf5] bg-[#eef3fc] text-[#355db7]';
  return 'border-[#d9dfea] bg-[#f7f8fa] text-[#6b7486]';
}

function priorityClass(priority: WorkPriority) {
  if (priority === 'high') return 'bg-[#fff0ef] text-[#bb504d]';
  if (priority === 'low') return 'bg-[#edf8f4] text-[#397961]';
  return 'bg-[#f1f3f6] text-[#687386]';
}

function projectDot(status: ProjectStatus) {
  if (status === 'active') return 'bg-[#76d6b1]';
  if (status === 'on_hold') return 'bg-[#e9b96e]';
  return 'bg-[#8ca8e5]';
}

function ChannelIcon({ channel, className = 'size-4' }: { channel: HistoryChannel; className?: string }) {
  if (channel === 'email') return <Mail className={className} />;
  if (channel === 'kakao') return <MessageCircleMore className={className} />;
  if (channel === 'phone') return <Phone className={className} />;
  if (channel === 'meeting') return <UsersRound className={className} />;
  if (channel === 'verbal') return <MessageSquareText className={className} />;
  return <FileText className={className} />;
}

function entriesForWork(entries: HistoryEntry[], workItemId: string) {
  return entries
    .filter((entry) => entry.workItemId === workItemId)
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
}

async function readResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
}

export function BusinessDashboard() {
  const [workspace, setWorkspace] = useState<BusinessWorkspace>(emptyWorkspace);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [projectForm, setProjectForm] = useState<ProjectInput>(emptyProjectForm);
  const [workForm, setWorkForm] = useState<WorkForm>(() => emptyWorkForm(''));
  const [historyForm, setHistoryForm] = useState<HistoryForm>(() => emptyHistoryForm('received'));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError('');
    try {
      const response = await fetch('/api/business', { cache: 'no-store' });
      const data = (await readResponse(response)) as unknown as BusinessWorkspace & { error?: string };
      if (!response.ok || !Array.isArray(data.projects)) {
        throw new Error(data.error || '사업 업무를 불러오지 못했습니다.');
      }
      setWorkspace(data);
      setSelectedProjectId((current) =>
        data.projects.some((project) => project.id === current)
          ? current
          : (data.projects.find((project) => project.status === 'active') ?? data.projects[0])?.id ?? '',
      );
      setSelectedWorkItemId((current) =>
        data.workItems.some((item) => item.id === current) ? current : '',
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '사업 업무를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const selectedProject = workspace.projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedWorkItem = workspace.workItems.find((item) => item.id === selectedWorkItemId) ?? null;

  const projectSummaries = useMemo(
    () =>
      workspace.projects.map((project) => {
        const items = workspace.workItems.filter((item) => item.projectId === project.id);
        const open = items.filter((item) => item.status !== 'completed').length;
        const overdue = items.filter(
          (item) => item.status !== 'completed' && item.dueDate < localDateString(),
        ).length;
        const lastActivity = items.reduce((latest, item) => Math.max(latest, item.lastActivityAt), 0);
        return { project, open, overdue, lastActivity };
      }),
    [workspace.projects, workspace.workItems],
  );

  const projectItems = useMemo(
    () => workspace.workItems.filter((item) => item.projectId === selectedProjectId),
    [selectedProjectId, workspace.workItems],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return projectItems
      .filter((item) => {
        const history = entriesForWork(workspace.historyEntries, item.id);
        const haystack = [
          item.title,
          item.owner,
          item.category,
          item.description,
          ...history.flatMap((entry) => [entry.receivedContent, entry.actionContent, entry.sourceSender]),
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        return (!query || haystack.includes(query)) &&
          (statusFilter === 'all' || item.status === statusFilter);
      })
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [projectItems, search, statusFilter, workspace.historyEntries]);

  const openCount = projectItems.filter((item) => item.status !== 'completed').length;
  const waitingCount = projectItems.filter((item) => item.status === 'waiting').length;
  const overdueCount = projectItems.filter(
    (item) => item.status !== 'completed' && item.dueDate < localDateString(),
  ).length;
  const latestProjectActivity = projectItems.reduce(
    (latest, item) => Math.max(latest, item.lastActivityAt),
    0,
  );

  const selectedHistory = selectedWorkItem
    ? entriesForWork(workspace.historyEntries, selectedWorkItem.id)
    : [];
  const selectedLatestReceived = selectedHistory.find((entry) => entry.receivedContent);
  const selectedLatestAction = selectedHistory.find((entry) => entry.actionContent);

  function chooseProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedWorkItemId('');
    setSearch('');
    setStatusFilter('all');
  }

  function openProjectDialog() {
    setProjectForm(emptyProjectForm());
    setFormError('');
    setDialog('project');
  }

  function openWorkDialog() {
    if (!selectedProject) return;
    setWorkForm(emptyWorkForm(selectedProject.id));
    setFormError('');
    setDialog('work');
  }

  function openHistoryDialog() {
    if (!selectedWorkItem) return;
    setHistoryForm(emptyHistoryForm(selectedWorkItem.status));
    setFormError('');
    setDialog('history');
  }

  async function submitProject(event: FormSubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'project', project: projectForm }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.project || typeof data.project !== 'object') {
        throw new Error(data.error || '사업을 등록하지 못했습니다.');
      }
      const projectId = (data.project as { id: string }).id;
      await loadWorkspace(true);
      setSelectedProjectId(projectId);
      setDialog(null);
      toast.add({ title: '새 사업을 등록했습니다', description: projectForm.name, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '사업을 등록하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWorkItem(event: FormSubmitEvent) {
    event.preventDefault();
    const occurredAt = new Date(workForm.occurredAt).getTime();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'work_item',
          workItem: {
            projectId: workForm.projectId,
            title: workForm.title,
            category: workForm.category,
            status: workForm.status,
            priority: workForm.priority,
            owner: workForm.owner,
            dueDate: workForm.dueDate,
            description: workForm.description,
          },
          history: {
            channel: workForm.channel,
            sourceSender: workForm.sourceSender,
            receivedContent: workForm.receivedContent,
            actionContent: workForm.actionContent,
            recorder: workForm.recorder,
            occurredAt,
            referenceUrl: workForm.referenceUrl,
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.workItem || typeof data.workItem !== 'object') {
        throw new Error(data.error || '업무를 등록하지 못했습니다.');
      }
      const workItemId = (data.workItem as { id: string }).id;
      await loadWorkspace(true);
      setSelectedWorkItemId(workItemId);
      setDialog(null);
      toast.add({ title: '업무와 첫 히스토리를 등록했습니다', description: workForm.title, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '업무를 등록하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitHistory(event: FormSubmitEvent) {
    event.preventDefault();
    if (!selectedWorkItem) return;
    const occurredAt = new Date(historyForm.occurredAt).getTime();
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'history',
          history: {
            workItemId: selectedWorkItem.id,
            ...historyForm,
            occurredAt,
          },
        }),
      });
      const data = await readResponse(response);
      if (!response.ok || !data.historyEntry) {
        throw new Error(data.error || '히스토리를 추가하지 못했습니다.');
      }
      await loadWorkspace(true);
      setDialog(null);
      toast.add({ title: '히스토리를 추가했습니다', description: selectedWorkItem.title, type: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '히스토리를 추가하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Toaster toastManager={toast} timeout={4500}>
      <main className="min-h-screen bg-[#f4f6f9] text-[#192235]">
        <div className="mx-auto flex min-h-screen max-w-[1680px]">
          <aside className="sticky top-0 hidden h-screen w-[278px] shrink-0 flex-col border-r border-[#dfe4ec] bg-[#17233d] px-4 py-6 text-white lg:flex">
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="grid size-10 place-items-center rounded-xl bg-[#4d79df] shadow-[0_8px_24px_rgba(77,121,223,0.26)]"><BriefcaseBusiness className="size-5" /></div>
              <div><p className="font-bold tracking-[-0.02em]">사업 워크로그</p><p className="text-[11px] text-white/45">Project communication hub</p></div>
            </div>

            <div className="mb-3 flex items-center justify-between px-2">
              <p className="text-xs font-semibold text-white/45">사업 목록</p>
              <Button onClick={openProjectDialog} size="icon-sm" variant="ghost" aria-label="사업 추가" className="text-white/55 hover:bg-white/10 hover:text-white"><Plus /></Button>
            </div>
            <nav aria-label="사업 선택" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {projectSummaries.map(({ project, open, overdue, lastActivity }) => (
                <button key={project.id} type="button" aria-label={`사업 선택: ${project.name}`} onClick={() => chooseProject(project.id)} className={`w-full rounded-xl p-3 text-left transition-colors ${project.id === selectedProjectId ? 'bg-white/12' : 'hover:bg-white/7'}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${projectDot(project.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${project.id === selectedProjectId ? 'font-semibold text-white' : 'text-white/68'}`}>{project.name}</p>
                      <p className="mt-1 truncate text-[11px] text-white/38">{project.client} · 미처리 {open}건{overdue ? ` · 지연 ${overdue}` : ''}</p>
                      {lastActivity > 0 && <p className="mt-1.5 text-[10px] text-white/28">최근 {formatTimestamp(lastActivity, true)}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </nav>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs font-semibold text-white/78">기록 원칙</p>
              <p className="mt-2 text-[11px] leading-5 text-white/42">메일·카톡·구두 내용을 받은 즉시 남기고, 처리 결과는 같은 업무의 히스토리로 이어서 기록합니다.</p>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e2e6ed] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
              <div className="flex min-w-0 items-center gap-3 lg:hidden">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#355db7] text-white"><BriefcaseBusiness className="size-5" /></div>
                <Select value={selectedProjectId} onValueChange={(value) => value && chooseProject(value)}>
                  <SelectTrigger aria-label="사업 선택" className="h-9 min-w-0 max-w-[230px] border-0 bg-transparent font-semibold shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    {workspace.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden lg:block"><p className="text-sm font-semibold">사업별 업무관리</p><p className="text-xs text-[#7b8498]">수신 내용과 처리 이력을 한 곳에서 관리합니다.</p></div>
              <div className="flex items-center gap-2">
                <Button onClick={() => void loadWorkspace(true)} variant="ghost" size="icon-lg" disabled={refreshing} aria-label="새로고침" className="rounded-xl text-[#69758a]">{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button>
                <Button onClick={openProjectDialog} variant="outline" className="hidden rounded-xl sm:flex"><Building2 />사업 추가</Button>
                <Button onClick={openWorkDialog} disabled={!selectedProject} className="rounded-xl bg-[#355db7] hover:bg-[#2d52a4]"><Plus />업무 기록</Button>
              </div>
            </header>

            <div className="px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
              {loading ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto size-7 animate-spin text-[#355db7]" /><p className="mt-3 text-sm text-[#7b8498]">사업 기록을 불러오는 중입니다.</p></div></div>
              ) : loadError ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="max-w-sm text-center"><AlertCircle className="mx-auto size-8 text-[#c6534f]" /><h1 className="mt-3 font-bold">기록을 불러오지 못했습니다</h1><p className="mt-2 text-sm text-[#7b8498]">{loadError}</p><Button onClick={() => void loadWorkspace()} className="mt-5"><RefreshCw />다시 시도</Button></div></div>
              ) : !selectedProject ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="max-w-md text-center"><BriefcaseBusiness className="mx-auto size-10 text-[#7c8fb6]" /><h1 className="mt-4 text-xl font-bold">첫 사업을 등록해 주세요</h1><p className="mt-2 text-sm leading-6 text-[#7b8498]">사업을 만든 뒤 메일·카톡·구두로 받은 내용을 업무별 히스토리로 쌓을 수 있습니다.</p><Button onClick={openProjectDialog} className="mt-5"><Plus />사업 등록</Button></div></div>
              ) : (
                <>
                  <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="bg-white text-[#5f6c82]">{PROJECT_STATUS_LABELS[selectedProject.status]}</Badge><span className="text-sm text-[#68758d]">{selectedProject.client} · 담당 {selectedProject.manager}</span></div>
                      <h1 className="truncate text-[26px] font-bold tracking-[-0.035em] sm:text-[31px]">{selectedProject.name}</h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7b8498]">{selectedProject.description || '이 사업에서 오간 내용과 처리 과정을 업무별로 관리합니다.'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:hidden"><Button onClick={openProjectDialog} variant="outline"><Building2 />사업 추가</Button></div>
                  </div>

                  <section aria-label="사업 업무 요약" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: '미처리 업무', value: `${openCount}건`, note: `전체 ${projectItems.length}건`, icon: Inbox, tone: 'bg-[#e8eefc] text-[#3157a4]' },
                      { label: '회신 대기', value: `${waitingCount}건`, note: '상대 답변을 기다리는 업무', icon: Clock3, tone: 'bg-[#fff2dd] text-[#a8691d]' },
                      { label: '기한 초과', value: `${overdueCount}건`, note: overdueCount ? '우선 확인이 필요합니다' : '지연 업무가 없습니다', icon: AlertCircle, tone: 'bg-[#fff0ef] text-[#bb504d]' },
                      { label: '최근 업데이트', value: latestProjectActivity ? formatTimestamp(latestProjectActivity, true) : '기록 없음', note: '실제 발생 일시 기준', icon: RefreshCw, tone: 'bg-[#e9f7f1] text-[#247a5b]' },
                    ].map((metric) => (
                      <Card key={metric.label} className="border-0 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-[#e2e7ef]">
                        <CardContent className="flex items-center justify-between px-5 py-1"><div><p className="text-xs font-medium text-[#7b8498]">{metric.label}</p><p className="mt-1 text-xl font-bold tracking-[-0.03em]">{metric.value}</p><p className="mt-1 text-[11px] text-[#9199a9]">{metric.note}</p></div><div className={`grid size-11 place-items-center rounded-2xl ${metric.tone}`}><metric.icon className="size-5" /></div></CardContent>
                      </Card>
                    ))}
                  </section>

                  <section className="mt-5 overflow-hidden rounded-2xl border border-[#e0e5ed] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
                    <div className="flex flex-col gap-3 border-b border-[#e6eaf0] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><h2 className="font-bold">업무 및 이슈</h2><p className="mt-0.5 text-xs text-[#858da0]">최신 수신 내용과 최근 처리 결과를 함께 보여줍니다.</p></div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa2b2]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="업무 검색" placeholder="업무, 담당자, 기록 검색" className="h-9 rounded-xl pl-9" /></div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                          <SelectTrigger aria-label="상태 필터" className="h-9 w-full rounded-xl sm:w-[132px]"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">모든 상태</SelectItem><SelectItem value="received">접수</SelectItem><SelectItem value="in_progress">진행 중</SelectItem><SelectItem value="waiting">회신 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>

                    {filteredItems.length ? (
                      <div className="divide-y divide-[#edf0f4]">
                        {filteredItems.map((item) => {
                          const history = entriesForWork(workspace.historyEntries, item.id);
                          const latestReceived = history.find((entry) => entry.receivedContent);
                          const latestAction = history.find((entry) => entry.actionContent);
                          const isOverdue = item.status !== 'completed' && item.dueDate < localDateString();
                          return (
                            <button key={item.id} type="button" onClick={() => setSelectedWorkItemId(item.id)} className="group block w-full p-5 text-left transition-colors hover:bg-[#fafbfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4d79df]">
                              <article className="flex flex-col gap-4 xl:flex-row xl:items-start">
                                <div className="min-w-0 xl:w-[27%]">
                                  <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusClass(item.status)}>{WORK_STATUS_LABELS[item.status]}</Badge><Badge className={priorityClass(item.priority)}>{WORK_PRIORITY_LABELS[item.priority]}</Badge></div>
                                  <h3 className="font-semibold leading-snug text-[#253047]">{item.title}</h3>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8790a2]"><span className="flex items-center gap-1"><UserRound className="size-3.5" />{item.owner}</span><span>{item.category}</span><span className={`flex items-center gap-1 ${isOverdue ? 'font-semibold text-[#bb504d]' : ''}`}><CalendarDays className="size-3.5" />{dueLabel(item)}</span></div>
                                </div>
                                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                                  <div className="min-h-[112px] rounded-xl bg-[#f5f7fa] p-4"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#6d778c]">{latestReceived ? <ChannelIcon channel={latestReceived.channel} className="size-3.5" /> : <Inbox className="size-3.5" />}최신 수신 내용{latestReceived ? ` · ${HISTORY_CHANNEL_LABELS[latestReceived.channel]}` : ''}</p>{latestReceived ? <><p className="line-clamp-2 text-sm leading-6 text-[#3d475b]">{latestReceived.receivedContent}</p><p className="mt-2 text-[11px] text-[#979eac]">{latestReceived.sourceSender} · {formatTimestamp(latestReceived.occurredAt, true)}</p></> : <p className="text-sm text-[#9aa2b2]">수신 기록이 없습니다.</p>}</div>
                                  <div className="min-h-[112px] rounded-xl border border-[#dfe9ff] bg-[#f5f8ff] p-4"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#4265ad]"><CheckCircle2 className="size-3.5" />최근 처리 내용</p>{latestAction ? <><p className="line-clamp-2 text-sm leading-6 text-[#3d475b]">{latestAction.actionContent}</p><p className="mt-2 text-[11px] text-[#8795b1]">{latestAction.recorder} · {formatTimestamp(latestAction.occurredAt, true)}</p></> : <p className="text-sm text-[#8795b1]">아직 처리 내용이 없습니다.</p>}</div>
                                </div>
                                <ArrowRight className="size-4 self-end text-[#8792a8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#355db7] xl:self-center" />
                              </article>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-5 py-16 text-center"><Inbox className="mx-auto size-8 text-[#a5adbc]" /><h3 className="mt-3 font-semibold">표시할 업무가 없습니다</h3><p className="mt-1 text-sm text-[#8992a3]">검색 조건을 바꾸거나 이 사업에 새 업무를 기록해 주세요.</p><Button onClick={openWorkDialog} className="mt-5"><Plus />업무 기록</Button></div>
                    )}
                  </section>
                </>
              )}
            </div>
          </section>
        </div>

        <Sheet open={Boolean(selectedWorkItem)} onOpenChange={(open) => !open && setSelectedWorkItemId('')}>
          <SheetContent className="w-full gap-0 p-0 sm:max-w-[720px]" side="right">
            {selectedWorkItem && (
              <>
                <SheetHeader className="border-b border-[#e5e9f0] px-6 py-5 pr-14">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusClass(selectedWorkItem.status)}>{WORK_STATUS_LABELS[selectedWorkItem.status]}</Badge><Badge className={priorityClass(selectedWorkItem.priority)}>{WORK_PRIORITY_LABELS[selectedWorkItem.priority]}</Badge><span className="text-xs text-[#8790a2]">{selectedWorkItem.category}</span></div>
                  <SheetTitle className="text-xl font-bold leading-snug">{selectedWorkItem.title}</SheetTitle>
                  <SheetDescription className="mt-2 leading-6">{selectedWorkItem.description || '업무 설명이 없습니다.'}</SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#768197]"><span className="flex items-center gap-1.5"><UserRound className="size-3.5" />담당 {selectedWorkItem.owner}</span><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />기한 {dueLabel(selectedWorkItem)}</span><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />최근 {formatTimestamp(selectedWorkItem.lastActivityAt, true)}</span></div>
                </SheetHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <section aria-label="업무 최신 요약" className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f5f7fa] p-4"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#6d778c]">{selectedLatestReceived ? <ChannelIcon channel={selectedLatestReceived.channel} /> : <Inbox className="size-4" />}최신 수신 내용</p>{selectedLatestReceived ? <><p className="text-sm leading-6 text-[#39445a]">{selectedLatestReceived.receivedContent}</p><p className="mt-3 text-[11px] text-[#8f98a8]">{selectedLatestReceived.sourceSender} · {formatTimestamp(selectedLatestReceived.occurredAt)}</p></> : <p className="text-sm text-[#9098a8]">수신 기록이 없습니다.</p>}</div>
                    <div className="rounded-2xl border border-[#dfe9ff] bg-[#f5f8ff] p-4"><p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#4265ad]"><CheckCircle2 className="size-4" />최근 처리 내용</p>{selectedLatestAction ? <><p className="text-sm leading-6 text-[#39445a]">{selectedLatestAction.actionContent}</p><p className="mt-3 text-[11px] text-[#8795b1]">{selectedLatestAction.recorder} · {formatTimestamp(selectedLatestAction.occurredAt)}</p></> : <p className="text-sm text-[#8795b1]">아직 처리 내용이 없습니다.</p>}</div>
                  </section>

                  <div className="mt-7 flex items-center justify-between"><div><h3 className="font-bold">전체 히스토리</h3><p className="mt-0.5 text-xs text-[#8a93a4]">실제 발생 일시가 최신인 기록부터 표시합니다.</p></div><Button onClick={openHistoryDialog} className="rounded-xl bg-[#355db7] hover:bg-[#2d52a4]"><Plus />기록 추가</Button></div>

                  <ol className="mt-5 space-y-0">
                    {selectedHistory.map((entry, index) => (
                      <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < selectedHistory.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-14px)] w-px bg-[#dfe4ec]" />}
                        <div className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border border-[#dfe4ec] bg-white text-[#61708b]"><ChannelIcon channel={entry.channel} /></div>
                        <article className="min-w-0 flex-1 rounded-2xl border border-[#e3e7ed] bg-white p-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><span>{HISTORY_CHANNEL_LABELS[entry.channel]}</span>{entry.sourceSender && <span className="font-normal text-[#7d8799]">· {entry.sourceSender}</span>}</p><time className="text-[11px] text-[#929aa9]">{formatTimestamp(entry.occurredAt)}</time></div>
                          {entry.receivedContent && <div className="mt-3 rounded-xl bg-[#f6f7f9] p-3"><p className="mb-1 text-[11px] font-semibold text-[#747f92]">받은 내용</p><p className="whitespace-pre-wrap text-sm leading-6 text-[#3c4659]">{entry.receivedContent}</p></div>}
                          {entry.actionContent && <div className="mt-3 rounded-xl bg-[#f2f6ff] p-3"><p className="mb-1 text-[11px] font-semibold text-[#4162a5]">처리 내용</p><p className="whitespace-pre-wrap text-sm leading-6 text-[#3c4659]">{entry.actionContent}</p></div>}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#8c95a5]"><span>기록자 {entry.recorder}</span>{entry.referenceUrl && <a href={entry.referenceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex items-center gap-1 font-medium text-[#4669b2] hover:underline"><ExternalLink className="size-3" />참고 링크</a>}{entry.createdAt - entry.occurredAt > 30 * 60 * 1000 && <span>입력 {formatTimestamp(entry.createdAt, true)}</span>}</div>
                        </article>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialog === 'project'} onOpenChange={(open) => !submitting && setDialog(open ? 'project' : null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[560px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">새 사업 등록</DialogTitle><DialogDescription>사업 단위로 업무와 커뮤니케이션 히스토리를 묶어 관리합니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitProject} className="mt-1 space-y-4">
              <Field><FieldLabel>사업명</FieldLabel><Input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="예: 2026 서초구 공간 리뉴얼" /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>거래처·기관</FieldLabel><Input value={projectForm.client} onChange={(event) => setProjectForm((current) => ({ ...current, client: event.target.value }))} placeholder="예: 서초구청" /></Field><Field><FieldLabel>사업 담당자</FieldLabel><Input value={projectForm.manager} onChange={(event) => setProjectForm((current) => ({ ...current, manager: event.target.value }))} placeholder="예: 김민지" /></Field></div>
              <Field><FieldLabel>사업 상태</FieldLabel><Select value={projectForm.status} onValueChange={(value) => setProjectForm((current) => ({ ...current, status: value as ProjectStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">진행 중</SelectItem><SelectItem value="on_hold">보류</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
              <Field><FieldLabel>설명</FieldLabel><Textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="사업 범위와 관리 목적을 간단히 적어 주세요." className="min-h-24" /></Field>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 rounded-xl px-0 pb-0 pt-4 sm:px-4 sm:pb-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#355db7] hover:bg-[#2d52a4]">{submitting && <Loader2 className="animate-spin" />}사업 등록</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'work'} onOpenChange={(open) => !submitting && setDialog(open ? 'work' : null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[760px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">새 업무와 첫 히스토리</DialogTitle><DialogDescription>받은 내용을 새 업무로 만들고, 최초 기록을 함께 남깁니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitWorkItem} className="mt-1 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2"><FieldLabel>업무명</FieldLabel><Input value={workForm.title} onChange={(event) => setWorkForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 착공 일정 및 출입 인원 확정" /></Field>
                <Field><FieldLabel>분류</FieldLabel><Input value={workForm.category} onChange={(event) => setWorkForm((current) => ({ ...current, category: event.target.value }))} placeholder="일정, 디자인, 계약 등" /></Field>
                <Field><FieldLabel>담당자</FieldLabel><Input value={workForm.owner} onChange={(event) => setWorkForm((current) => ({ ...current, owner: event.target.value }))} placeholder="예: 김민지" /></Field>
                <Field><FieldLabel>상태</FieldLabel><Select value={workForm.status} onValueChange={(value) => setWorkForm((current) => ({ ...current, status: value as WorkStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="received">접수</SelectItem><SelectItem value="in_progress">진행 중</SelectItem><SelectItem value="waiting">회신 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>우선순위</FieldLabel><Select value={workForm.priority} onValueChange={(value) => setWorkForm((current) => ({ ...current, priority: value as WorkPriority }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">높음</SelectItem><SelectItem value="medium">보통</SelectItem><SelectItem value="low">낮음</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>기한</FieldLabel><Input type="date" value={workForm.dueDate} onChange={(event) => setWorkForm((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
                <Field><FieldLabel>발생 일시</FieldLabel><Input type="datetime-local" value={workForm.occurredAt} onChange={(event) => setWorkForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <Field className="sm:col-span-2"><FieldLabel>업무 설명</FieldLabel><Textarea value={workForm.description} onChange={(event) => setWorkForm((current) => ({ ...current, description: event.target.value }))} placeholder="이 업무에서 확인하거나 끝내야 할 내용을 적어 주세요." /></Field>
              </div>
              <div className="border-t border-[#e7eaf0] pt-5"><h3 className="mb-4 text-sm font-bold">첫 수신·처리 기록</h3><div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>수신 경로</FieldLabel><Select value={workForm.channel} onValueChange={(value) => setWorkForm((current) => ({ ...current, channel: value as HistoryChannel }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">메일</SelectItem><SelectItem value="kakao">카톡</SelectItem><SelectItem value="verbal">구두</SelectItem><SelectItem value="phone">전화</SelectItem><SelectItem value="meeting">회의</SelectItem><SelectItem value="other">기타</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>전달자·기관</FieldLabel><Input value={workForm.sourceSender} onChange={(event) => setWorkForm((current) => ({ ...current, sourceSender: event.target.value }))} placeholder="받은 내용이 있다면 필수" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>받은 내용</FieldLabel><Textarea value={workForm.receivedContent} onChange={(event) => setWorkForm((current) => ({ ...current, receivedContent: event.target.value }))} placeholder="메일·카톡·구두 등으로 전달받은 핵심 내용을 적어 주세요." className="min-h-24" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>처리 내용</FieldLabel><Textarea value={workForm.actionContent} onChange={(event) => setWorkForm((current) => ({ ...current, actionContent: event.target.value }))} placeholder="이미 처리했거나 다음에 할 일을 적어 주세요. 아직 없다면 비워둘 수 있습니다." className="min-h-24" /></Field>
                <Field><FieldLabel>기록자</FieldLabel><Input value={workForm.recorder} onChange={(event) => setWorkForm((current) => ({ ...current, recorder: event.target.value }))} placeholder="예: 김민지" /></Field>
                <Field><FieldLabel>참고 링크</FieldLabel><div className="relative"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa2b2]" /><Input type="url" value={workForm.referenceUrl} onChange={(event) => setWorkForm((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className="pl-9" /></div></Field>
              </div></div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 rounded-xl px-0 pb-0 pt-4 sm:px-4 sm:pb-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#355db7] hover:bg-[#2d52a4]">{submitting && <Loader2 className="animate-spin" />}업무와 기록 저장</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'history'} onOpenChange={(open) => !submitting && setDialog(open ? 'history' : null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[680px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">히스토리 추가</DialogTitle><DialogDescription>{selectedWorkItem?.title} 업무에 새 수신 내용이나 처리 결과를 이어서 남깁니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitHistory} className="mt-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>수신 경로</FieldLabel><Select value={historyForm.channel} onValueChange={(value) => setHistoryForm((current) => ({ ...current, channel: value as HistoryChannel }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">메일</SelectItem><SelectItem value="kakao">카톡</SelectItem><SelectItem value="verbal">구두</SelectItem><SelectItem value="phone">전화</SelectItem><SelectItem value="meeting">회의</SelectItem><SelectItem value="other">기타</SelectItem></SelectContent></Select></Field>
                <Field><FieldLabel>발생 일시</FieldLabel><Input type="datetime-local" value={historyForm.occurredAt} onChange={(event) => setHistoryForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <Field><FieldLabel>전달자·기관</FieldLabel><Input value={historyForm.sourceSender} onChange={(event) => setHistoryForm((current) => ({ ...current, sourceSender: event.target.value }))} placeholder="받은 내용이 있다면 필수" /></Field>
                <Field><FieldLabel>업무 상태</FieldLabel><Select value={historyForm.newStatus} onValueChange={(value) => setHistoryForm((current) => ({ ...current, newStatus: value as WorkStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="received">접수</SelectItem><SelectItem value="in_progress">진행 중</SelectItem><SelectItem value="waiting">회신 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
                <Field className="sm:col-span-2"><FieldLabel>받은 내용</FieldLabel><Textarea value={historyForm.receivedContent} onChange={(event) => setHistoryForm((current) => ({ ...current, receivedContent: event.target.value }))} placeholder="새로 전달받은 내용이 있다면 적어 주세요." className="min-h-24" /></Field>
                <Field className="sm:col-span-2"><FieldLabel>처리 내용</FieldLabel><Textarea value={historyForm.actionContent} onChange={(event) => setHistoryForm((current) => ({ ...current, actionContent: event.target.value }))} placeholder="확인, 회신, 전달, 승인 등 실제 처리한 내용이나 다음 조치를 적어 주세요." className="min-h-24" /></Field>
                <Field><FieldLabel>기록자</FieldLabel><Input value={historyForm.recorder} onChange={(event) => setHistoryForm((current) => ({ ...current, recorder: event.target.value }))} placeholder="예: 김민지" /></Field>
                <Field><FieldLabel>참고 링크</FieldLabel><div className="relative"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa2b2]" /><Input type="url" value={historyForm.referenceUrl} onChange={(event) => setHistoryForm((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className="pl-9" /></div></Field>
              </div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 rounded-xl px-0 pb-0 pt-4 sm:px-4 sm:pb-4"><Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#355db7] hover:bg-[#2d52a4]">{submitting && <Loader2 className="animate-spin" />}히스토리 저장</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </Toaster>
  );
}
