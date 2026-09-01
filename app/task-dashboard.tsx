'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Edit3,
  Inbox,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Task,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/task-types';

type DueFilter = 'all' | 'today' | 'overdue';

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

function emptyTask(): TaskInput {
  return {
    title: '',
    description: '',
    status: 'planned',
    priority: 'medium',
    assignee: '',
    dueDate: dateWithOffset(2),
    category: '일반',
  };
}

function formatDueDate(dateValue: string, completed: boolean) {
  const today = localDateString();
  if (dateValue === today) return '오늘';

  const [year, month, day] = dateValue.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  if (dateValue < today && !completed) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((now.getTime() - due.getTime()) / 86400000));
    return `${days}일 지연`;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(due);
}

function statusClass(status: TaskStatus) {
  if (status === 'in_progress') return 'border-[#bee9d8] bg-[#eefaf5] text-[#16805b]';
  if (status === 'review') return 'border-[#ead9b8] bg-[#fff9ed] text-[#a86a18]';
  if (status === 'completed') return 'border-[#cddaf5] bg-[#eef3fc] text-[#355db7]';
  return 'border-[#d9dfea] bg-[#f7f8fa] text-[#6b7486]';
}

function priorityClass(priority: TaskPriority) {
  if (priority === 'high') return 'bg-[#fff0ef] text-[#c6534f]';
  if (priority === 'low') return 'bg-[#edf8f4] text-[#397961]';
  return 'bg-[#f1f3f6] text-[#687386]';
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    tasks?: Task[];
    task?: Task;
    error?: string;
  };
}

export function TaskDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>(emptyTask);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok || !data.tasks) {
        throw new Error(data.error || '업무 목록을 불러오지 못했습니다.');
      }
      setTasks(data.tasks);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '업무 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const today = localDateString();
  const incomplete = tasks.filter((task) => task.status !== 'completed');
  const completedCount = tasks.length - incomplete.length;
  const inProgressCount = tasks.filter((task) => task.status === 'in_progress').length;
  const dueTodayCount = incomplete.filter((task) => task.dueDate === today).length;
  const overdueCount = incomplete.filter((task) => task.dueDate < today).length;
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const metrics = [
    {
      label: '전체 업무',
      value: tasks.length,
      note: `미완료 ${incomplete.length}개`,
      icon: BriefcaseBusiness,
      tone: 'bg-[#e8eefc] text-[#3157a4]',
    },
    {
      label: '진행 중',
      value: inProgressCount,
      note: `검토 대기 ${tasks.filter((task) => task.status === 'review').length}개`,
      icon: CircleDot,
      tone: 'bg-[#e7f7f0] text-[#17805c]',
    },
    {
      label: '오늘 마감',
      value: dueTodayCount,
      note: overdueCount ? `지연 업무 ${overdueCount}개` : '지연 업무 없음',
      icon: Clock3,
      tone: 'bg-[#fff2dd] text-[#b56a14]',
    },
    {
      label: '완료율',
      value: `${completionRate}%`,
      note: `${completedCount}개 업무 완료`,
      icon: CheckCircle2,
      tone: 'bg-[#eeeafd] text-[#6a4fc4]',
    },
  ];

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return tasks.filter((task) => {
      const matchesQuery =
        !query ||
        [task.title, task.assignee, task.category, task.description].some((value) =>
          value.toLocaleLowerCase('ko-KR').includes(query),
        );
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesDue =
        dueFilter === 'all' ||
        (dueFilter === 'today' && task.dueDate === today && task.status !== 'completed') ||
        (dueFilter === 'overdue' && task.dueDate < today && task.status !== 'completed');
      return matchesQuery && matchesStatus && matchesPriority && matchesDue;
    });
  }, [dueFilter, priorityFilter, search, statusFilter, tasks, today]);

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);
  const greeting = now.getHours() < 12 ? '좋은 아침입니다' : now.getHours() < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDueFilter('all');
  }

  function showTaskList(filter: DueFilter = 'all') {
    resetFilters();
    setDueFilter(filter);
    window.setTimeout(() => document.getElementById('task-list')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  function openCreateDialog() {
    setEditingTask(null);
    setForm(emptyTask());
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      category: task.category,
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.assignee.trim() || !form.category.trim() || !form.dueDate) {
      setFormError('업무명, 담당자, 분류와 마감일을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch('/api/tasks', {
        method: editingTask ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTask ? { id: editingTask.id, ...form } : form),
      });
      const data = await readJson(response);
      if (!response.ok || !data.task) throw new Error(data.error || '업무를 저장하지 못했습니다.');

      setTasks((current) =>
        editingTask
          ? current.map((task) => (task.id === data.task?.id ? data.task : task))
          : [data.task as Task, ...current],
      );
      setDialogOpen(false);
      toast.add({
        title: editingTask ? '업무를 수정했습니다' : '새 업무를 등록했습니다',
        description: data.task.title,
        type: 'success',
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '업무를 저장하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function quickToggle(task: Task) {
    if (pendingId) return;
    setPendingId(task.id);
    const input: TaskInput = {
      title: task.title,
      description: task.description,
      status: task.status === 'completed' ? 'in_progress' : 'completed',
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      category: task.category,
    };

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, ...input }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.task) throw new Error(data.error || '상태를 변경하지 못했습니다.');
      setTasks((current) => current.map((item) => (item.id === task.id ? (data.task as Task) : item)));
      toast.add({
        title: input.status === 'completed' ? '업무를 완료했습니다' : '업무를 다시 진행합니다',
        description: task.title,
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: '상태를 변경하지 못했습니다',
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
        type: 'error',
      });
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(taskToDelete.id)}`, {
        method: 'DELETE',
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '업무를 삭제하지 못했습니다.');
      setTasks((current) => current.filter((task) => task.id !== taskToDelete.id));
      toast.add({
        title: '업무를 삭제했습니다',
        description: taskToDelete.title,
        type: 'success',
      });
      setTaskToDelete(null);
    } catch (error) {
      toast.add({
        title: '업무를 삭제하지 못했습니다',
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  const navItems = [
    { label: '대시보드', icon: LayoutDashboard, count: null, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: '전체 업무', icon: BriefcaseBusiness, count: tasks.length, action: () => showTaskList() },
    { label: '오늘 마감', icon: CalendarDays, count: dueTodayCount, action: () => showTaskList('today') },
    { label: '지연 업무', icon: AlertTriangle, count: overdueCount, action: () => showTaskList('overdue') },
  ];

  return (
    <Toaster toastManager={toast} timeout={4500}>
      <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
        <div className="mx-auto flex min-h-screen max-w-[1680px]">
          <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-[#e4e8f0] bg-[#17233d] px-4 py-6 text-white lg:flex lg:flex-col">
            <div className="mb-9 flex items-center gap-3 px-2">
              <div className="grid size-9 place-items-center rounded-xl bg-[#4d79df] shadow-[0_8px_24px_rgba(77,121,223,0.28)]"><CheckCircle2 className="size-5" /></div>
              <div><p className="text-[15px] font-bold tracking-[-0.02em]">워크플로우</p><p className="text-[11px] text-white/45">Team workspace</p></div>
            </div>

            <nav aria-label="주요 메뉴" className="space-y-1.5">
              {navItems.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors ${index === 0 && dueFilter === 'all' ? 'bg-white/12 font-semibold text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'}`}
                >
                  <item.icon className="size-[18px]" />
                  <span>{item.label}</span>
                  {item.count !== null && <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/55">{item.count}</span>}
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs font-semibold text-white/80">전체 업무 진행률</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#76d6b1] transition-[width]" style={{ width: `${completionRate}%` }} /></div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-white/45"><span>{tasks.length}개 중 {completedCount}개 완료</span><span>{completionRate}%</span></div>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e4e8f0] bg-white/95 px-5 backdrop-blur sm:px-8">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="grid size-9 place-items-center rounded-xl bg-[#355db7] text-white"><CheckCircle2 className="size-5" /></div>
                <span className="font-bold">워크플로우</span>
              </div>
              <div className="hidden lg:block"><p className="text-sm font-semibold">업무 대시보드</p><p className="text-xs text-[#7b8498]">{dateLabel}</p></div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon-lg" aria-label="알림" className="relative rounded-xl text-[#667085]"><Bell className="size-[18px]" />{overdueCount > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#ef6b6b] ring-2 ring-white" />}</Button>
                <div className="h-8 w-px bg-[#e8ebf2]" />
                <div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-full bg-[#dfe8fb] text-sm font-bold text-[#3157a4]">나</div><div className="hidden sm:block"><p className="text-xs font-semibold">관리자</p><p className="text-[11px] text-[#8b93a5]">운영팀</p></div></div>
              </div>
            </header>

            <div className="px-5 py-7 sm:px-8 sm:py-8">
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="mb-1 text-sm font-medium text-[#5f6b82]">{greeting} 👋</p><h1 className="text-[26px] font-bold tracking-[-0.035em] sm:text-[30px]">오늘의 업무를 확인해 보세요</h1></div>
                <Button onClick={openCreateDialog} className="h-10 rounded-xl bg-[#355db7] px-4 shadow-[0_8px_20px_rgba(53,93,183,0.22)] hover:bg-[#2d52a4]"><Plus className="size-4" />새 업무 추가</Button>
              </div>

              <section aria-label="업무 요약" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <Card key={metric.label} className="border-0 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)] ring-[#e7eaf1]">
                    <CardContent className="flex items-center justify-between px-5 py-1">
                      <div><p className="text-xs font-medium text-[#7b8498]">{metric.label}</p><p className="mt-1 text-[26px] font-bold tracking-[-0.03em]">{loading ? '—' : metric.value}</p><p className="mt-1 text-[11px] text-[#8c94a6]">{loading ? '불러오는 중' : metric.note}</p></div>
                      <div className={`grid size-11 place-items-center rounded-2xl ${metric.tone}`}><metric.icon className="size-5" /></div>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <section id="task-list" className="mt-5 overflow-hidden rounded-2xl border border-[#e4e8f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="flex flex-col gap-4 border-b border-[#edf0f5] px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
                  <div><div className="flex items-center gap-2"><h2 className="text-[17px] font-bold tracking-[-0.02em]">내 업무</h2><Badge variant="secondary" className="bg-[#edf2fc] text-[#355db7]">{filteredTasks.length}</Badge></div><p className="mt-1 text-xs text-[#8b93a5]">검색과 필터로 필요한 업무를 빠르게 찾으세요.</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-[240px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa2b2]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="업무 검색" placeholder="업무명 또는 담당자 검색" className="h-9 rounded-xl border-[#dfe3eb] bg-[#fafbfc] pl-9" /></div>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}><SelectTrigger aria-label="상태 필터" className="h-9 w-full rounded-xl border-[#dfe3eb] sm:w-[126px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 상태</SelectItem><SelectItem value="planned">예정</SelectItem><SelectItem value="in_progress">진행 중</SelectItem><SelectItem value="review">검토 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select>
                    <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}><SelectTrigger aria-label="우선순위 필터" className="h-9 w-full rounded-xl border-[#dfe3eb] sm:w-[136px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 우선순위</SelectItem><SelectItem value="high">높음</SelectItem><SelectItem value="medium">보통</SelectItem><SelectItem value="low">낮음</SelectItem></SelectContent></Select>
                  </div>
                </div>

                {dueFilter !== 'all' && (
                  <div className="flex items-center justify-between border-b border-[#edf0f5] bg-[#f8faff] px-5 py-2.5 text-xs text-[#52617a]"><span>{dueFilter === 'today' ? '오늘 마감 업무만 보고 있습니다.' : '마감일이 지난 미완료 업무만 보고 있습니다.'}</span><button type="button" onClick={resetFilters} className="font-semibold text-[#355db7] hover:underline">필터 해제</button></div>
                )}

                {loadError ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="grid size-12 place-items-center rounded-2xl bg-[#fff0ef] text-[#c6534f]"><AlertTriangle className="size-5" /></div><p className="mt-4 text-sm font-semibold">업무를 불러오지 못했습니다</p><p className="mt-1 max-w-sm text-xs text-[#7b8498]">{loadError}</p><Button onClick={() => void loadTasks()} variant="outline" className="mt-4"><RefreshCw className="size-4" />다시 시도</Button></div>
                ) : loading ? (
                  <div className="space-y-3 p-5">{[0, 1, 2, 3].map((row) => <div key={row} className="h-[58px] animate-pulse rounded-xl bg-[#f1f3f7]" />)}</div>
                ) : filteredTasks.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="grid size-12 place-items-center rounded-2xl bg-[#edf2fc] text-[#4268bc]"><Inbox className="size-5" /></div><p className="mt-4 text-sm font-semibold">조건에 맞는 업무가 없습니다</p><p className="mt-1 text-xs text-[#7b8498]">필터를 바꾸거나 새 업무를 등록해 보세요.</p><div className="mt-4 flex gap-2"><Button variant="outline" onClick={resetFilters}>필터 초기화</Button><Button onClick={openCreateDialog}><Plus className="size-4" />업무 추가</Button></div></div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[780px] text-left">
                        <thead className="bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8b93a5]"><tr><th className="px-5 py-3.5">업무</th><th className="px-4 py-3.5">담당자</th><th className="px-4 py-3.5">마감일</th><th className="px-4 py-3.5">우선순위</th><th className="px-4 py-3.5">상태</th><th className="w-12 px-4 py-3.5"><span className="sr-only">업무 메뉴</span></th></tr></thead>
                        <tbody className="divide-y divide-[#edf0f5]">
                          {filteredTasks.map((task) => {
                            const completed = task.status === 'completed';
                            const overdue = task.dueDate < today && !completed;
                            return (
                              <tr key={task.id} className="group hover:bg-[#fafcff]">
                                <td className="px-5 py-4"><div className="flex items-center gap-3"><button type="button" disabled={pendingId === task.id} onClick={() => void quickToggle(task)} aria-label={completed ? `${task.title} 다시 진행` : `${task.title} 완료 처리`} className={`grid size-[19px] shrink-0 place-items-center rounded-full border-2 transition-colors ${completed ? 'border-[#4e79dc] bg-[#4e79dc] text-white' : 'border-[#cbd2df] bg-white hover:border-[#4e79dc]'}`}>{pendingId === task.id ? <Loader2 className="size-3 animate-spin" /> : completed ? <Check className="size-3" /> : null}</button><div className="min-w-0"><p className={`truncate text-[13px] font-semibold ${completed ? 'text-[#8d95a6] line-through' : 'text-[#293349]'}`}>{task.title}</p><p className="mt-1 truncate text-[11px] text-[#929aab]">{task.category}{task.description ? ` · ${task.description}` : ''}</p></div></div></td>
                                <td className="px-4 py-4"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#eef2f8] text-[11px] font-semibold text-[#58657c]">{task.assignee.slice(0, 1)}</span><span className="text-xs font-medium text-[#5b6578]">{task.assignee}</span></div></td>
                                <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${overdue || task.dueDate === today ? 'text-[#c77718]' : 'text-[#697386]'}`}>{(overdue || task.dueDate === today) && <AlertTriangle className="size-3.5" />}{formatDueDate(task.dueDate, completed)}</span></td>
                                <td className="px-4 py-4"><Badge variant="secondary" className={priorityClass(task.priority)}>{PRIORITY_LABELS[task.priority]}</Badge></td>
                                <td className="px-4 py-4"><Badge variant="outline" className={statusClass(task.status)}>{STATUS_LABELS[task.status]}</Badge></td>
                                <td className="px-4 py-4"><TaskMenu task={task} onEdit={openEditDialog} onDelete={setTaskToDelete} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="divide-y divide-[#edf0f5] md:hidden">
                      {filteredTasks.map((task) => {
                        const completed = task.status === 'completed';
                        const overdue = task.dueDate < today && !completed;
                        return (
                          <article key={task.id} className="p-4">
                            <div className="flex items-start gap-3"><button type="button" disabled={pendingId === task.id} onClick={() => void quickToggle(task)} aria-label={completed ? `${task.title} 다시 진행` : `${task.title} 완료 처리`} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${completed ? 'border-[#4e79dc] bg-[#4e79dc] text-white' : 'border-[#cbd2df]'}`}>{pendingId === task.id ? <Loader2 className="size-3 animate-spin" /> : completed ? <Check className="size-3" /> : null}</button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className={`text-sm font-semibold ${completed ? 'text-[#8d95a6] line-through' : 'text-[#293349]'}`}>{task.title}</h3><TaskMenu task={task} onEdit={openEditDialog} onDelete={setTaskToDelete} /></div><p className="mt-1 text-xs text-[#929aab]">{task.category} · {task.assignee}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="secondary" className={priorityClass(task.priority)}>{PRIORITY_LABELS[task.priority]}</Badge><Badge variant="outline" className={statusClass(task.status)}>{STATUS_LABELS[task.status]}</Badge><span className={`text-xs ${overdue || task.dueDate === today ? 'font-semibold text-[#c77718]' : 'text-[#697386]'}`}>{formatDueDate(task.dueDate, completed)}</span></div></div></div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between border-t border-[#edf0f5] px-5 py-4"><p className="text-xs text-[#8b93a5]">전체 {tasks.length}개 중 {filteredTasks.length}개 표시</p>{(search || statusFilter !== 'all' || priorityFilter !== 'all' || dueFilter !== 'all') && <button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#355db7] hover:text-[#294b99]">모든 업무 보기</button>}</div>
              </section>
            </div>
          </section>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => !submitting && setDialogOpen(open)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-[620px] sm:p-6">
            <DialogHeader><DialogTitle className="text-lg">{editingTask ? '업무 수정' : '새 업무 추가'}</DialogTitle><DialogDescription>담당자와 마감일을 지정하면 대시보드에 바로 반영됩니다.</DialogDescription></DialogHeader>
            <form onSubmit={submitTask} className="space-y-5">
              <Field><FieldLabel htmlFor="task-title">업무명 <span className="text-destructive">*</span></FieldLabel><Input id="task-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} placeholder="예: 월간 운영 보고서 작성" className="h-10" autoFocus /></Field>
              <Field><FieldLabel htmlFor="task-description">상세 내용</FieldLabel><Textarea id="task-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1000} placeholder="업무 목표나 참고사항을 입력하세요." className="min-h-24 resize-y" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="task-assignee">담당자 <span className="text-destructive">*</span></FieldLabel><Input id="task-assignee" value={form.assignee} onChange={(event) => setForm((current) => ({ ...current, assignee: event.target.value }))} maxLength={40} placeholder="담당자 이름" className="h-10" /></Field>
                <Field><FieldLabel htmlFor="task-category">업무 분류 <span className="text-destructive">*</span></FieldLabel><Input id="task-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} maxLength={30} placeholder="예: 영업, 운영, 보고서" className="h-10" /></Field>
                <Field><FieldLabel htmlFor="task-due-date">마감일 <span className="text-destructive">*</span></FieldLabel><Input id="task-due-date" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="h-10" /></Field>
                <Field><FieldLabel>우선순위</FieldLabel><Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as TaskPriority }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">높음</SelectItem><SelectItem value="medium">보통</SelectItem><SelectItem value="low">낮음</SelectItem></SelectContent></Select></Field>
                <Field className="sm:col-span-2"><FieldLabel>진행 상태</FieldLabel><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as TaskStatus }))}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">예정</SelectItem><SelectItem value="in_progress">진행 중</SelectItem><SelectItem value="review">검토 대기</SelectItem><SelectItem value="completed">완료</SelectItem></SelectContent></Select></Field>
              </div>
              {formError && <FieldError>{formError}</FieldError>}
              <DialogFooter className="mx-0 mb-0 rounded-xl px-0 pb-0 pt-4 sm:px-4 sm:pb-4"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>취소</Button><Button type="submit" disabled={submitting} className="bg-[#355db7] hover:bg-[#2d52a4]">{submitting && <Loader2 className="size-4 animate-spin" />}{editingTask ? '변경사항 저장' : '업무 등록'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(taskToDelete)} onOpenChange={(open) => !open && !deleting && setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogMedia className="bg-[#fff0ef] text-[#c6534f]"><Trash2 className="size-5" /></AlertDialogMedia><AlertDialogTitle>업무를 삭제할까요?</AlertDialogTitle><AlertDialogDescription>“{taskToDelete?.title}” 업무가 목록에서 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>{deleting && <Loader2 className="size-4 animate-spin" />}삭제</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </Toaster>
  );
}

function TaskMenu({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${task.title} 메뉴`} className="text-[#929aab]" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => onEdit(task)}><Edit3 className="size-4" />수정</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}><Trash2 className="size-4" />삭제</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
