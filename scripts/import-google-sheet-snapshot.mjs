import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  writeBatch,
} from 'firebase/firestore';

const EXPECTED_SPREADSHEET_ID = '1EHwCMPR6Nm7A1oCq2EjrSd6tkrH8EufK8liYfCR2KCk';
const SOURCE_SNAPSHOT_DATE = '20260903';
const SHARED_ACCESS_EMAIL =
  'team-access@smartfarm-work-manager.firebaseapp.com';
const OPERATOR_LABEL = '관리대장 이관';
const COLLECTIONS = [
  'projects',
  'projectDocuments',
  'projectUpdates',
  'farms',
  'farmRecords',
  'subscriptionEvents',
  'inboxItems',
  'workItems',
  'blockerEpisodes',
  'visits',
  'checklistItems',
  'historyEntries',
  'farmCodeReservations',
  'farmRecordReservations',
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {
    apply: false,
    source: '',
    workspace: '',
    expectedSha256: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--apply') result.apply = true;
    else if (item === '--source') result.source = argv[++index] ?? '';
    else if (item === '--workspace') result.workspace = argv[++index] ?? '';
    else if (item === '--expected-sha256')
      result.expectedSha256 = (argv[++index] ?? '').toLowerCase();
    else fail(`지원하지 않는 인수입니다: ${item}`);
  }
  if (!result.source) fail('--source가 필요합니다.');
  if (!result.workspace) fail('--workspace가 필요합니다.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(result.workspace)) {
    fail('workspace 형식이 올바르지 않습니다.');
  }
  if (result.expectedSha256 && !/^[0-9a-f]{64}$/.test(result.expectedSha256)) {
    fail('--expected-sha256 형식이 올바르지 않습니다.');
  }
  if (result.apply && !result.expectedSha256) {
    fail('--apply에는 --expected-sha256이 필요합니다.');
  }
  return result;
}

function text(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim();
}

function keyText(value) {
  return text(value).toLocaleLowerCase('ko-KR');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function entityId(prefix, key) {
  return `${prefix}_${sha256(key).slice(0, 32)}`;
}

function fingerprint(value) {
  return sha256(JSON.stringify(value));
}

function parseInteger(value, fallback = 0) {
  const source = text(value).replace(/[^0-9-]/g, '');
  if (!source || source === '-') return fallback;
  const parsed = Number.parseInt(source, 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function parseDate(value) {
  const source = text(value);
  if (!source) return '';

  const compact = source.match(
    /^(20\d{2})[-./년\s]+(\d{1,2})(?:[-./월\s]+(\d{1,2}))?/,
  );
  if (compact) {
    const year = Number(compact[1]);
    const month = Number(compact[2]);
    const day = Number(compact[3] ?? 1);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const timestamp = Date.parse(source);
  if (Number.isFinite(timestamp)) {
    const parsed = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(parsed);
  }
  return '';
}

function dateTimestamp(value, fallback) {
  if (!value) return fallback;
  const timestamp = Date.parse(`${value}T12:00:00+09:00`);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function addYears(value, years) {
  const match = value.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const targetYear = Number(match[1]) + years;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(
    Math.min(day, lastDay),
  ).padStart(2, '0')}`;
}

function daysAfter(value, basis) {
  const valueTime = Date.parse(`${value}T00:00:00Z`);
  const basisTime = Date.parse(`${basis}T00:00:00Z`);
  return Math.floor((valueTime - basisTime) / 86_400_000);
}

function maxDate(values) {
  return values.filter(Boolean).sort().at(-1) ?? '';
}

function minDate(values) {
  return values.filter(Boolean).sort().at(0) ?? '';
}

function mostCommon(values, fallback = '') {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]?.[0] ?? fallback
  );
}

function parseEnvFile(source) {
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    result[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return result;
}

function audited(document, uid, runId, sourceFingerprint) {
  const createdAt = document.createdAt;
  const updatedAt = document.updatedAt ?? createdAt;
  return {
    ...document,
    updatedAt,
    createdByUid: uid,
    updatedByUid: uid,
    migrationRunId: runId,
    sourceFingerprint,
  };
}

function farmCodeKey(value) {
  return encodeURIComponent(keyText(value));
}

function recordReservationId(farmId, projectId) {
  return `${farmId}__${projectId}`;
}

function subscriptionStatus(value) {
  const source = text(value);
  if (source === '사용중') return 'active';
  if (source === '만료') return 'expired';
  return 'unregistered';
}

function projectYear(name, rows) {
  const normalizedName = text(name);
  const namedYear = normalizedName.match(/20\d{2}/)?.[0];
  if (namedYear) return Number(namedYear);
  const shortYear = normalizedName.match(/(?:^|\D)(\d{2})년/)?.[1];
  if (shortYear) return 2000 + Number(shortYear);
  const dates = rows.flatMap((row) =>
    [11, 12, 13, 14]
      .map((index) => parseDate(row.values[index]))
      .filter(Boolean),
  );
  const inferred = minDate(dates).slice(0, 4);
  if (!/^20\d{2}$/.test(inferred)) fail('사업 연도를 추론할 수 없습니다.');
  return Number(inferred);
}

function mostCompleteValue(rows, index) {
  return [...rows]
    .map((row) => ({
      rowNumber: row.rowNumber,
      value: text(row.values[index]),
    }))
    .filter(({ value }) => value)
    .sort(
      (left, right) =>
        right.value.replace(/\s/g, '').length -
          left.value.replace(/\s/g, '').length ||
        left.rowNumber - right.rowNumber,
    )[0]?.value;
}

function chooseRecord(records, projectById) {
  return [...records].sort((left, right) => {
    const expiry = right.currentSubscriptionExpiresAt.localeCompare(
      left.currentSubscriptionExpiresAt,
    );
    if (expiry) return expiry;
    const year =
      (projectById.get(right.projectId)?.year ?? 0) -
      (projectById.get(left.projectId)?.year ?? 0);
    if (year) return year;
    return right.installationDate.localeCompare(left.installationDate);
  })[0];
}

function buildDataset(source, uid, workspace, sourceHash) {
  if (source.spreadsheetId !== EXPECTED_SPREADSHEET_ID) {
    fail('예상한 Google 관리대장이 아닙니다.');
  }
  const values = source.sheets?.ledger?.values;
  if (!Array.isArray(values) || !Array.isArray(values[0])) {
    fail('관리대장 원본 범위를 찾을 수 없습니다.');
  }
  const expectedHeaders = [
    '사업명',
    '사업타입',
    '농장번호',
    '농장명',
    '연락처',
    '농장주소',
    '지역',
    '작물',
    '장비종류',
    '제품종류',
    '장비업체',
    '장비제작일/ 세팅완료일',
    '제품설치일',
    '시운전완료일',
    '교육완료일',
    '인터넷유형',
    '장비보증기간(년)',
    '장비보증만료일(자동)',
    '구독기간(년)',
    '구독만료일(최초 등록)',
    '구독만료일(자동)',
    '마지막입금일(자동)',
    '갱신횟수(자동)',
    '구독상태(자동)',
    '비고',
  ];
  for (let index = 0; index < expectedHeaders.length; index += 1) {
    if (text(values[0][index]) !== expectedHeaders[index]) {
      fail(`관리대장 ${index + 1}번째 열 헤더가 변경되었습니다.`);
    }
  }

  const ledgerRows = values
    .slice(1)
    .map((row, index) => ({ rowNumber: index + 2, values: row }))
    .filter(({ values: row }) => text(row[0]) && text(row[1]) && text(row[3]));
  const numberedRows = ledgerRows.filter(({ values: row }) => text(row[2]));
  const heldRows = ledgerRows.filter(({ values: row }) => !text(row[2]));
  if (ledgerRows.length !== 324 || numberedRows.length !== 297) {
    fail(
      '관리대장 행 수가 검증 기준과 달라졌습니다. 원본을 다시 점검해 주세요.',
    );
  }

  const runId = `sheet-${SOURCE_SNAPSHOT_DATE}-${sourceHash.slice(0, 12)}`;
  const importedAt = Date.now();
  const projectRows = new Map();
  for (const row of ledgerRows) {
    const name = text(row.values[0]);
    if (!projectRows.has(name)) projectRows.set(name, []);
    projectRows.get(name).push(row);
  }
  if (projectRows.size !== 37) fail('사업 수가 검증 기준과 다릅니다.');

  const projects = [];
  const projectIdByName = new Map();
  for (const [name, rows] of projectRows) {
    const id = entityId('project', keyText(name));
    projectIdByName.set(name, id);
    const year = projectYear(name, rows);
    const businessDates = rows.flatMap((row) =>
      [11, 12, 13, 14]
        .map((index) => parseDate(row.values[index]))
        .filter(Boolean),
    );
    const missingCodes = rows.filter((row) => !text(row.values[2])).length;
    const linkedRows = rows.filter((row) => text(row.values[2]));
    let currentStage = 'operation';
    if (!linkedRows.length) currentStage = 'farm_selection';
    else if (linkedRows.some((row) => !parseDate(row.values[12])))
      currentStage = 'installation';
    else if (
      linkedRows.some(
        (row) => !parseDate(row.values[13]) || !parseDate(row.values[14]),
      )
    )
      currentStage = 'verification';
    const description = [
      'Google 관리대장 기준 자동 이관.',
      '사업 진행 단계·정산·제출 서류는 담당자 확인이 필요합니다.',
      missingCodes
        ? `농장번호가 없는 ${missingCodes}행은 목표 수에만 반영하고 농가 등록은 보류했습니다.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    projects.push(
      audited(
        {
          id,
          name,
          projectType: mostCommon(
            rows.map((row) => text(row.values[1])),
            'general',
          ),
          year,
          institution: '기관 미입력(이관)',
          status: 'active',
          description,
          targetFarmCount: rows.length,
          manager: '담당자 미지정(이관)',
          startDate: minDate(businessDates),
          endDate: maxDate(businessDates),
          currentStage,
          settlementStatus: 'not_started',
          settlementDueDate: '',
          contractAmount: 0,
          settlementClaimAmount: 0,
          settlementApprovedAmount: 0,
          settlementPaidAmount: 0,
          settledAt: '',
          settlementOwner: '',
          settlementEvidenceUrl: '',
          settlementNote: '원본 시트에 정산 정보가 없어 확인이 필요합니다.',
          createdAt: importedAt,
          updatedAt: importedAt,
        },
        uid,
        runId,
        fingerprint(rows.map((row) => row.values)),
      ),
    );
  }

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectDocuments = [];
  const projectUpdates = [];
  const templates = [
    ['협약서·계약서', 'agreement'],
    ['참여농가 확정 명단', 'farm'],
    ['설치·시운전 확인서', 'installation'],
    ['검수·교육 확인서', 'inspection'],
    ['정산보고서·증빙', 'settlement'],
  ];
  for (const project of projects) {
    for (const [title, category] of templates) {
      const id = entityId('project_doc', `${project.id}|${category}`);
      projectDocuments.push(
        audited(
          {
            id,
            projectId: project.id,
            title,
            category,
            isRequired: true,
            status: 'not_started',
            owner: project.manager,
            currentHandler: project.manager,
            dueDate: '',
            submittedAt: '',
            approvedAt: '',
            referenceUrl: '',
            revision: 1,
            note: '원본 시트에 제출 현황이 없어 확인이 필요합니다.',
            createdAt: importedAt,
            updatedAt: importedAt,
          },
          uid,
          runId,
          fingerprint([project.id, category]),
        ),
      );
    }
    const id = entityId('project_update', `${project.id}|${runId}`);
    const rows = projectRows.get(project.name) ?? [];
    const held = rows.filter((row) => !text(row.values[2])).length;
    projectUpdates.push(
      audited(
        {
          id,
          projectId: project.id,
          kind: 'system',
          title: 'Google 관리대장 이관',
          channel: 'system',
          sender: '',
          receivedContent: '',
          actionContent: `원본 ${rows.length}행 중 농장번호가 있는 ${rows.length - held}행을 연결했습니다.${held ? ` 번호 미입력 ${held}행은 보류했습니다.` : ''}`,
          recorder: OPERATOR_LABEL,
          occurredAt: importedAt,
          referenceUrl: '',
          blockedReason: '',
          blockedBy: '',
          expectedUnblockDate: '',
          resolvedAt: 0,
          resolution: '',
          resolvedBy: '',
          createdAt: importedAt,
          updatedAt: importedAt,
        },
        uid,
        runId,
        fingerprint([project.id, rows.length, held]),
      ),
    );
  }

  const rowsByFarmCode = new Map();
  for (const row of numberedRows) {
    const code = keyText(row.values[2]);
    if (!rowsByFarmCode.has(code)) rowsByFarmCode.set(code, []);
    rowsByFarmCode.get(code).push(row);
  }
  if (rowsByFarmCode.size !== 295)
    fail('고유 농장번호 수가 검증 기준과 다릅니다.');

  const farms = [];
  const farmIdByCode = new Map();
  const farmIdByName = new Map();
  const farmCodeReservations = [];
  for (const [normalizedCode, rows] of rowsByFarmCode) {
    const farmCode = mostCompleteValue(rows, 2);
    const name = mostCompleteValue(rows, 3);
    const phone = mostCompleteValue(rows, 4) ?? '';
    const address = mostCompleteValue(rows, 5) ?? '';
    const region = mostCompleteValue(rows, 6);
    if (!farmCode || !name || !region) {
      fail('농가 기본정보의 필수값이 비어 있습니다.');
    }
    const id = entityId('farm', `code:${normalizedCode}`);
    const notes = [
      ...new Set(rows.map((item) => text(item.values[24])).filter(Boolean)),
    ];
    const contactConflict =
      new Set(rows.map((item) => text(item.values[4]))).size > 1 ||
      new Set(rows.map((item) => text(item.values[5]))).size > 1;
    if (farmIdByName.has(name) && farmIdByName.get(name) !== id) {
      fail('서로 다른 농장번호에 같은 농장명이 있어 자동 연결할 수 없습니다.');
    }
    farmIdByCode.set(normalizedCode, id);
    farmIdByName.set(name, id);
    farms.push(
      audited(
        {
          id,
          farmCode,
          name,
          phone,
          address,
          region,
          businessNumber: '',
          folderUrl: '',
          locationUrl: '',
          specialNotes: [
            ...notes,
            contactConflict
              ? '원본 사업행별 연락처·주소가 달라 더 완전한 표기를 기준으로 이관했습니다.'
              : '',
          ]
            .filter(Boolean)
            .join(' / '),
          createdAt: importedAt,
          updatedAt: importedAt,
        },
        uid,
        runId,
        fingerprint(rows.map((item) => item.values)),
      ),
    );
    const reservationId = farmCodeKey(farmCode);
    farmCodeReservations.push(
      audited(
        {
          id: reservationId,
          entityId: id,
          active: true,
          createdAt: importedAt,
          updatedAt: importedAt,
        },
        uid,
        runId,
        fingerprint([normalizedCode, id]),
      ),
    );
  }

  const farmRecords = [];
  const farmRecordReservations = [];
  const recordPairIds = new Set();
  for (const sourceRow of numberedRows) {
    const row = sourceRow.values;
    const projectId = projectIdByName.get(text(row[0]));
    const farmId = farmIdByCode.get(keyText(row[2]));
    if (!projectId || !farmId) fail('농가 또는 사업 연결을 만들 수 없습니다.');
    const pairId = recordReservationId(farmId, projectId);
    if (recordPairIds.has(pairId)) {
      fail('같은 농가와 사업의 중복 행이 있어 자동 이관을 중단합니다.');
    }
    recordPairIds.add(pairId);
    const id = entityId('farm_record', pairId);
    const dates = [11, 12, 13, 14, 17, 19, 20]
      .map((index) => parseDate(row[index]))
      .filter(Boolean);
    const record = audited(
      {
        id,
        farmId,
        projectId,
        crop: text(row[7]),
        deviceType: text(row[8]),
        productType: text(row[9]),
        vendor: text(row[10]),
        productionSetupDate: parseDate(row[11]),
        installationDate: parseDate(row[12]),
        commissioningDate: parseDate(row[13]),
        educationDate: parseDate(row[14]),
        internetType: text(row[15]) || text(row[27]),
        warrantyYears: parseInteger(row[16]),
        warrantyExpiresAt: parseDate(row[17]),
        subscriptionYears: parseInteger(row[18]),
        initialSubscriptionExpiresAt: parseDate(row[19]),
        currentSubscriptionExpiresAt: parseDate(row[20]),
        lastPaymentDate: '',
        renewalCount: parseInteger(row[22]),
        subscriptionStatus: subscriptionStatus(row[23]),
        notes: text(row[24]),
        lastActivityAt: dateTimestamp(maxDate(dates), importedAt),
        createdAt: importedAt,
        updatedAt: importedAt,
      },
      uid,
      runId,
      fingerprint(row),
    );
    farmRecords.push(record);
    farmRecordReservations.push(
      audited(
        {
          id: pairId,
          entityId: id,
          active: true,
          createdAt: importedAt,
          updatedAt: importedAt,
        },
        uid,
        runId,
        fingerprint([farmId, projectId, id]),
      ),
    );
  }
  if (farmRecords.length !== 297)
    fail('사업 참여 레코드 수가 검증 기준과 다릅니다.');

  const recordsByFarm = new Map();
  for (const record of farmRecords) {
    if (!recordsByFarm.has(record.farmId)) recordsByFarm.set(record.farmId, []);
    recordsByFarm.get(record.farmId).push(record);
  }

  const workItems = [];
  const historyEntries = [];
  const paymentDatesByRecord = new Map();
  const paymentEntriesByRecord = new Map();
  const paymentRows = (source.sheets?.payments?.values ?? [])
    .slice(3)
    .map((row, index) => ({ rowNumber: index + 4, values: row }))
    .filter(({ values: row }) => text(row[1]) && text(row[3]) && text(row[4]));
  if (paymentRows.length !== 36)
    fail('개인 입금 행 수가 검증 기준과 다릅니다.');
  for (const sourceRow of paymentRows) {
    const row = sourceRow.values;
    const farmId = farmIdByName.get(text(row[1]));
    const candidates = recordsByFarm.get(farmId) ?? [];
    if (!farmId || !candidates.length)
      fail('입금 내역을 농가에 연결할 수 없습니다.');
    const record = chooseRecord(candidates, projectById);
    const occurredDate = parseDate(row[3]);
    if (!occurredDate) fail('입금일을 해석할 수 없습니다.');
    const existing = paymentDatesByRecord.get(record.id) ?? [];
    existing.push(occurredDate);
    paymentDatesByRecord.set(record.id, existing);
    const entries = paymentEntriesByRecord.get(record.id) ?? [];
    entries.push({
      occurredDate,
      rowNumber: sourceRow.rowNumber,
      sourceFingerprint: fingerprint(row),
    });
    paymentEntriesByRecord.set(record.id, entries);
    const occurredAt = dateTimestamp(occurredDate, importedAt);
    const seed = `${record.id}|payment|${sourceRow.rowNumber}|${fingerprint(row)}`;
    const workItemId = entityId('work_payment', seed);
    const historyId = entityId('history_payment', seed);
    workItems.push(
      audited(
        {
          id: workItemId,
          farmRecordId: record.id,
          farmId: record.farmId,
          workType: 'payment',
          title: '구독료 입금 기록',
          status: 'completed',
          owner: OPERATOR_LABEL,
          dueDate: occurredDate,
          description: text(row[5]) || '원본 입금내역에서 이관했습니다.',
          expectedOutcome: '입금 확인 및 구독 정보 반영',
          nextAction: '',
          priority: 'medium',
          reviewDate: '',
          responseDueAt: 0,
          respondedAt: 0,
          blockedAt: 0,
          blockedReason: '',
          blockedBy: '',
          expectedUnblockDate: '',
          completedAt: occurredAt,
          lastActivityAt: occurredAt,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
        uid,
        runId,
        fingerprint(row),
      ),
    );
    historyEntries.push(
      audited(
        {
          id: historyId,
          workItemId,
          channel: 'system',
          sender: '',
          receivedContent: `${text(row[2]) || '개인'} 구독료 입금`,
          actionContent: text(row[5]) || '입금 내역 확인',
          amount: parseInteger(row[4]),
          recorder: OPERATOR_LABEL,
          occurredAt,
          referenceUrl: '',
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
        uid,
        runId,
        fingerprint(row),
      ),
    );
  }

  for (const record of farmRecords) {
    const paymentDate = maxDate(paymentDatesByRecord.get(record.id) ?? []);
    if (paymentDate) {
      record.lastPaymentDate = paymentDate;
      record.lastActivityAt = Math.max(
        record.lastActivityAt,
        dateTimestamp(paymentDate, importedAt),
      );
    }
  }

  const serviceRows = (source.sheets?.service?.values ?? [])
    .slice(2)
    .map((row, index) => ({ rowNumber: index + 3, values: row }))
    .filter(({ values: row }) => text(row[0]) && text(row[1]));
  if (serviceRows.length !== 5) fail('A/S 행 수가 검증 기준과 다릅니다.');
  for (const sourceRow of serviceRows) {
    const row = sourceRow.values;
    const farmId = farmIdByName.get(text(row[1]));
    const candidates = recordsByFarm.get(farmId) ?? [];
    if (!farmId || !candidates.length)
      fail('A/S 내역을 농가에 연결할 수 없습니다.');
    const record = chooseRecord(candidates, projectById);
    const occurredDate = parseDate(row[0]);
    if (!occurredDate) fail('A/S 접수일을 해석할 수 없습니다.');
    const occurredAt = dateTimestamp(occurredDate, importedAt);
    const completed = Boolean(text(row[4]));
    const seed = `${record.id}|service|${sourceRow.rowNumber}|${fingerprint(row)}`;
    const workItemId = entityId('work_service', seed);
    const historyId = entityId('history_service', seed);
    workItems.push(
      audited(
        {
          id: workItemId,
          farmRecordId: record.id,
          farmId: record.farmId,
          workType: 'service',
          title: 'A/S 기록 이관',
          status: completed ? 'completed' : 'open',
          owner: OPERATOR_LABEL,
          dueDate: completed ? occurredDate : '',
          description: [text(row[2]), text(row[5])].filter(Boolean).join(' / '),
          expectedOutcome: completed ? text(row[4]) : 'A/S 처리 결과 기록',
          nextAction: completed ? '' : '처리 내용 확인 및 결과 입력',
          priority: 'medium',
          reviewDate: completed ? '' : occurredDate,
          responseDueAt: 0,
          respondedAt: 0,
          blockedAt: 0,
          blockedReason: '',
          blockedBy: '',
          expectedUnblockDate: '',
          completedAt: completed ? occurredAt : 0,
          lastActivityAt: occurredAt,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
        uid,
        runId,
        fingerprint(row),
      ),
    );
    historyEntries.push(
      audited(
        {
          id: historyId,
          workItemId,
          channel: 'system',
          sender: '',
          receivedContent: text(row[2])
            ? `A/S 접수 (${text(row[2])})`
            : 'A/S 접수',
          actionContent: text(row[4]) || '처리 내용 미입력',
          amount: parseInteger(row[3]),
          recorder: OPERATOR_LABEL,
          occurredAt,
          referenceUrl: '',
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
        uid,
        runId,
        fingerprint(row),
      ),
    );
    record.lastActivityAt = Math.max(record.lastActivityAt, occurredAt);
  }

  const subscriptionEvents = [];
  const recordById = new Map(farmRecords.map((record) => [record.id, record]));
  for (const [recordId, rawEntries] of paymentEntriesByRecord) {
    const record = recordById.get(recordId);
    if (!record) fail('입금 내역의 농가 참여 레코드가 없습니다.');
    const entries = [...rawEntries].sort((left, right) =>
      left.occurredDate.localeCompare(right.occurredDate),
    );
    if (record.renewalCount !== entries.length) {
      fail('입금 건수와 관리대장 갱신횟수가 일치하지 않습니다.');
    }
    const initialExpiry = record.initialSubscriptionExpiresAt;
    const currentExpiry = record.currentSubscriptionExpiresAt;
    if (!initialExpiry || !currentExpiry) {
      fail('구독 이벤트의 만료 기준일이 없습니다.');
    }
    let expiryPairs = [];
    if (entries.length === 1) {
      expiryPairs =
        currentExpiry > initialExpiry
          ? [[initialExpiry, currentExpiry]]
          : [[addYears(initialExpiry, -1), initialExpiry]];
    } else if (entries.length === 2 && currentExpiry > initialExpiry) {
      expiryPairs = [
        [addYears(initialExpiry, -1), initialExpiry],
        [initialExpiry, currentExpiry],
      ];
    } else {
      fail('지원하지 않는 구독 갱신 이력 형태입니다.');
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const [basisExpiryDate, newExpiryDate] = expiryPairs[index];
      if (
        !basisExpiryDate ||
        !newExpiryDate ||
        newExpiryDate <= basisExpiryDate
      ) {
        fail('구독 이벤트 만료일 관계가 유효하지 않습니다.');
      }
      const eventType =
        daysAfter(entry.occurredDate, basisExpiryDate) > 60
          ? 'rejoined'
          : 'renewed';
      const id = entityId(
        'subscription_event',
        `${record.id}|${entry.rowNumber}|${basisExpiryDate}|${newExpiryDate}`,
      );
      const createdAt = dateTimestamp(entry.occurredDate, importedAt);
      subscriptionEvents.push(
        audited(
          {
            id,
            farmRecordId: record.id,
            projectId: record.projectId,
            eventType,
            basisExpiryDate,
            processedAt: entry.occurredDate,
            newExpiryDate,
            recorder: OPERATOR_LABEL,
            note:
              eventType === 'rejoined'
                ? '원본 입금내역 기준 재가입 이관'
                : '원본 입금내역 기준 갱신 이관',
            createdAt,
            updatedAt: createdAt,
          },
          uid,
          runId,
          entry.sourceFingerprint,
        ),
      );
    }
  }
  const eventTypes = subscriptionEvents.reduce((counts, event) => {
    counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    return counts;
  }, {});
  if (
    subscriptionEvents.length !== 36 ||
    eventTypes.renewed !== 35 ||
    eventTypes.rejoined !== 1
  ) {
    fail('구독 갱신·재가입 재구성 결과가 검증 기준과 다릅니다.');
  }

  const documents = {
    projects,
    projectDocuments,
    projectUpdates,
    farms,
    farmRecords,
    subscriptionEvents,
    inboxItems: [],
    workItems,
    blockerEpisodes: [],
    visits: [],
    checklistItems: [],
    historyEntries,
    farmCodeReservations,
    farmRecordReservations,
  };

  const allIds = new Set();
  for (const [collectionName, collectionDocuments] of Object.entries(
    documents,
  )) {
    const collectionIds = new Set();
    for (const document of collectionDocuments) {
      if (!document.id || document.id.length > 160)
        fail('문서 ID가 유효하지 않습니다.');
      if (collectionIds.has(document.id))
        fail(`${collectionName} 문서 ID가 중복됩니다.`);
      collectionIds.add(document.id);
      if (Object.keys(document).length > 64)
        fail('문서 필드 수 제한을 초과했습니다.');
      if (document.createdAt <= 0 || document.updatedAt < document.createdAt) {
        fail('감사 타임스탬프가 유효하지 않습니다.');
      }
      allIds.add(`${collectionName}/${document.id}`);
    }
  }
  if (allIds.size !== Object.values(documents).flat().length) {
    fail('문서 키가 중복됩니다.');
  }

  const projectIds = new Set(projects.map((item) => item.id));
  const farmIds = new Set(farms.map((item) => item.id));
  const recordIds = new Set(farmRecords.map((item) => item.id));
  const workItemIds = new Set(workItems.map((item) => item.id));
  for (const record of farmRecords) {
    if (!projectIds.has(record.projectId) || !farmIds.has(record.farmId))
      fail('농가 참여 관계가 유효하지 않습니다.');
  }
  for (const item of [...projectDocuments, ...projectUpdates]) {
    if (!projectIds.has(item.projectId)) fail('사업 관계가 유효하지 않습니다.');
  }
  for (const item of [...subscriptionEvents, ...workItems]) {
    if (!recordIds.has(item.farmRecordId))
      fail('업무 관계가 유효하지 않습니다.');
  }
  for (const item of historyEntries) {
    if (!workItemIds.has(item.workItemId))
      fail('이력 관계가 유효하지 않습니다.');
  }

  return {
    runId,
    workspace,
    sourceHash,
    importedAt,
    heldRows: heldRows.length,
    documents,
    counts: Object.fromEntries(
      Object.entries(documents).map(([name, items]) => [name, items.length]),
    ),
    summary: {
      sourceRows: ledgerRows.length,
      numberedRows: numberedRows.length,
      heldRows: heldRows.length,
      projects: projects.length,
      farms: farms.length,
      farmRecords: farmRecords.length,
      paymentEntries: paymentRows.length,
      serviceEntries: serviceRows.length,
      subscriptionEvents: subscriptionEvents.length,
      totalDocuments: Object.values(documents).flat().length,
    },
  };
}

async function commitDocuments(
  db,
  workspace,
  collectionName,
  documents,
  batchSize,
) {
  for (let start = 0; start < documents.length; start += batchSize) {
    const batch = writeBatch(db);
    for (const documentValue of documents.slice(start, start + batchSize)) {
      batch.set(
        doc(db, 'workspaces', workspace, collectionName, documentValue.id),
        documentValue,
      );
    }
    await batch.commit();
  }
}

async function assertWorkspaceEmpty(db, workspace) {
  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDocs(
      query(collection(db, 'workspaces', workspace, collectionName), limit(1)),
    );
    if (!snapshot.empty) {
      fail(`대상 workspace의 ${collectionName} 컬렉션이 비어 있지 않습니다.`);
    }
  }
}

async function applyDataset(db, dataset) {
  const { documents, workspace } = dataset;
  await commitDocuments(db, workspace, 'projects', documents.projects, 300);
  await commitDocuments(db, workspace, 'farms', documents.farms, 300);
  await commitDocuments(
    db,
    workspace,
    'farmCodeReservations',
    documents.farmCodeReservations,
    300,
  );

  for (let start = 0; start < documents.farmRecords.length; start += 8) {
    const records = documents.farmRecords.slice(start, start + 8);
    const reservationByEntity = new Map(
      documents.farmRecordReservations.map((item) => [item.entityId, item]),
    );
    const batch = writeBatch(db);
    for (const record of records) {
      batch.set(
        doc(db, 'workspaces', workspace, 'farmRecords', record.id),
        record,
      );
      const reservation = reservationByEntity.get(record.id);
      if (!reservation) fail('농가 참여 예약 문서가 없습니다.');
      batch.set(
        doc(
          db,
          'workspaces',
          workspace,
          'farmRecordReservations',
          reservation.id,
        ),
        reservation,
      );
    }
    await batch.commit();
  }

  await commitDocuments(
    db,
    workspace,
    'projectDocuments',
    documents.projectDocuments,
    15,
  );
  await commitDocuments(
    db,
    workspace,
    'projectUpdates',
    documents.projectUpdates,
    15,
  );
  await commitDocuments(db, workspace, 'workItems', documents.workItems, 15);
  await commitDocuments(
    db,
    workspace,
    'historyEntries',
    documents.historyEntries,
    15,
  );
  await commitDocuments(
    db,
    workspace,
    'subscriptionEvents',
    documents.subscriptionEvents,
    15,
  );
}

async function verifyDataset(db, dataset) {
  const verified = {};
  for (const [collectionName, expectedDocuments] of Object.entries(
    dataset.documents,
  )) {
    const snapshot = await getDocs(
      query(
        collection(db, 'workspaces', dataset.workspace, collectionName),
        limit(5000),
      ),
    );
    const actualIds = new Set(snapshot.docs.map((item) => item.id));
    const expectedIds = new Set(expectedDocuments.map((item) => item.id));
    if (actualIds.size !== expectedIds.size) {
      fail(`${collectionName} 문서 수 검증에 실패했습니다.`);
    }
    for (const expected of expectedDocuments) {
      if (!actualIds.has(expected.id))
        fail(`${collectionName} ID 검증에 실패했습니다.`);
    }
    for (const item of snapshot.docs) {
      const value = item.data();
      if (
        value.id !== item.id ||
        value.migrationRunId !== dataset.runId ||
        !value.sourceFingerprint
      ) {
        fail(`${collectionName} 이관 메타데이터 검증에 실패했습니다.`);
      }
    }
    verified[collectionName] = actualIds.size;
  }
  return verified;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceBuffer = await readFile(options.source);
  const sourceHash = sha256(sourceBuffer);
  if (options.expectedSha256 && options.expectedSha256 !== sourceHash) {
    fail('원본 스냅샷 SHA-256이 예상값과 다릅니다.');
  }
  const expectedWorkspace = `sheet-${SOURCE_SNAPSHOT_DATE}-${sourceHash.slice(0, 8)}`;
  if (options.apply && options.workspace !== expectedWorkspace) {
    fail('workspace가 검증된 원본 스냅샷과 정확히 일치하지 않습니다.');
  }
  const source = JSON.parse(sourceBuffer.toString('utf8'));
  const placeholderUid = 'dry-run-user';
  let dataset = buildDataset(
    source,
    placeholderUid,
    options.workspace,
    sourceHash,
  );
  process.stdout.write(
    `${JSON.stringify({ phase: 'validated', runId: dataset.runId, workspace: dataset.workspace, sourceHash, summary: dataset.summary })}\n`,
  );
  if (!options.apply) return;

  const env = parseEnvFile(await readFile('.env.local', 'utf8'));
  const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId
  ) {
    fail('Firebase 웹 설정이 없습니다.');
  }
  if (firebaseConfig.projectId !== 'smartfarm-work-manager') {
    fail('예상한 Firebase 프로젝트가 아닙니다.');
  }
  const password = process.env.SMARTFARM_SHARED_PASSWORD;
  if (!password) fail('SMARTFARM_SHARED_PASSWORD 환경 변수가 필요합니다.');

  const app = initializeApp(firebaseConfig, `migration-${Date.now()}`);
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(
    auth,
    SHARED_ACCESS_EMAIL,
    password,
  );
  const uid = credential.user.uid;
  const db = getFirestore(app);
  const member = await getDoc(doc(db, 'appMembers', uid));
  if (!member.exists() || member.data().active !== true) {
    fail('이관 계정이 활성 구성원이 아닙니다.');
  }

  dataset = buildDataset(source, uid, options.workspace, sourceHash);
  await assertWorkspaceEmpty(db, options.workspace);
  process.stdout.write(
    `${JSON.stringify({ phase: 'writing', workspace: options.workspace, totalDocuments: dataset.summary.totalDocuments })}\n`,
  );
  await applyDataset(db, dataset);
  const verified = await verifyDataset(db, dataset);
  process.stdout.write(
    `${JSON.stringify({ phase: 'verified', runId: dataset.runId, workspace: dataset.workspace, counts: verified, summary: dataset.summary })}\n`,
  );
  await signOut(auth);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : '알 수 없는 오류';
  process.stderr.write(`${JSON.stringify({ phase: 'failed', message })}\n`);
  process.exitCode = 1;
});
