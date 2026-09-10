'use client';
import { isActiveWork } from '@/lib/work-lifecycle';

import type { FarmLedgerWorkspace, FarmHistoryChannel } from '@/lib/farm-types';
import {
  farmLedgerFetch,
  waitForFarmLedgerSync,
} from '@/lib/firebase/farm-ledger-store';

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (input: unknown) => unknown;
};

type ModelContext = {
  registerTool: (
    tool: ToolDefinition,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const CAPTURE_CHANNELS = [
  'email',
  'kakao',
  'verbal',
  'phone',
  'meeting',
  'other',
] as const satisfies readonly FarmHistoryChannel[];

function inputObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('받은 내용 입력값을 확인해 주세요.');
  }
  return value as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, key: string) {
  return typeof input[key] === 'string' ? input[key].trim() : '';
}

export function registerFarmLedgerTools(
  getWorkspace: () => FarmLedgerWorkspace,
) {
  const context = (
    document as Document & { readonly modelContext?: ModelContext }
  ).modelContext;
  if (!context?.registerTool) return () => {};

  const lifecycle = new AbortController();
  const tools: ToolDefinition[] = [
    {
      name: 'get_farm_management_summary',
      title: '스마트팜 관리 현황 조회',
      description:
        '현재 화면과 같은 사업·농가·구독·열린 업무 요약 수치를 조회합니다.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const workspace = getWorkspace();
        const subscribedFarmIds = new Set(
          workspace.records
            .filter((record) => record.subscriptionStatus === 'active')
            .map((record) => record.farmId),
        );
        return {
          projects: workspace.projects.length,
          activeProjects: workspace.projects.filter(
            (project) => project.status === 'active',
          ).length,
          farms: workspace.farms.length,
          subscribedFarms: subscribedFarmIds.size,
          openWorkItems: workspace.workItems.filter(
            (item) => isActiveWork(item) && item.status !== 'completed',
          ).length,
          blockedWorkItems: workspace.workItems.filter(
            (item) => isActiveWork(item) && item.status === 'waiting',
          ).length,
          unprocessedInboxItems: workspace.inboxItems.filter(
            (item) => item.status === 'unprocessed',
          ).length,
        };
      },
    },
    {
      name: 'capture_inbox_item',
      title: '수신 내용 기록',
      description:
        '메일·카톡·전화·구두·회의로 받은 내용을 팜로그 수신함에 기록합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: CAPTURE_CHANNELS },
          sender: { type: 'string', maxLength: 100 },
          content: { type: 'string', minLength: 1, maxLength: 3000 },
          capturedBy: { type: 'string', minLength: 1, maxLength: 50 },
          receivedAt: {
            type: 'string',
            description: 'ISO 8601 형식의 수신 일시',
          },
          referenceUrl: { type: 'string', maxLength: 2000 },
        },
        required: ['channel', 'sender', 'content', 'capturedBy', 'receivedAt'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(value) {
        const input = inputObject(value);
        const channel = stringField(input, 'channel');
        const sender = stringField(input, 'sender');
        const content = stringField(input, 'content');
        const capturedBy = stringField(input, 'capturedBy');
        const referenceUrl = stringField(input, 'referenceUrl');
        const receivedAt = Date.parse(stringField(input, 'receivedAt'));
        if (
          !CAPTURE_CHANNELS.includes(
            channel as (typeof CAPTURE_CHANNELS)[number],
          ) ||
          !content ||
          !capturedBy ||
          !Number.isFinite(receivedAt)
        ) {
          throw new Error(
            '수신 경로, 받은 내용, 기록 담당자와 수신 일시를 확인해 주세요.',
          );
        }
        const response = await farmLedgerFetch('/api/farm-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'inbox',
            inboxItem: {
              channel,
              sender,
              content,
              capturedBy,
              receivedAt,
              referenceUrl,
            },
          }),
        });
        const result = (await response.json()) as {
          error?: string;
          inboxItem?: { id: string; status: string };
        };
        if (!response.ok || !result.inboxItem) {
          throw new Error(result.error || '수신 내용을 기록하지 못했습니다.');
        }
        await waitForFarmLedgerSync();
        return {
          id: result.inboxItem.id,
          status: result.inboxItem.status,
        };
      },
    },
  ];

  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch((error) =>
        console.error('WebMCP tool registration failed', error),
      );
    } catch (error) {
      console.error('WebMCP tool registration failed', error);
    }
  }

  return () => lifecycle.abort();
}
