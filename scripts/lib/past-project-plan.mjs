// Pure planner: original REST fields (including dates/amounts) remain untouched.
export function value(field) {
  return (
    field?.stringValue ??
    field?.booleanValue ??
    (field?.integerValue !== undefined ? Number(field.integerValue) : undefined)
  );
}
const str = (text) => ({ stringValue: text });
const int = (number) => ({ integerValue: String(number) });
export function buildPastProjectPlan(collections, now, runId) {
  const projects = collections.projects.filter(
    (doc) =>
      Number.isInteger(value(doc.fields.year)) &&
      value(doc.fields.year) > 0 &&
      value(doc.fields.year) < 2026,
  );
  const ids = new Set(projects.map((doc) => doc.name.split('/').at(-1)));
  const records = collections.farmRecords.filter((doc) =>
    ids.has(value(doc.fields.projectId)),
  );
  const documents = collections.projectDocuments.filter((doc) =>
    ids.has(value(doc.fields.projectId)),
  );
  const writes = [];
  const actor = 'operator-past-project-completion';
  function patch(doc, fields) {
    const changed = Object.fromEntries(
      Object.entries(fields).filter(
        ([key, entry]) =>
          JSON.stringify(doc.fields[key]) !== JSON.stringify(entry),
      ),
    );
    if (!Object.keys(changed).length) return;
    changed.updatedAt = int(
      Math.max(now, Number(value(doc.fields.updatedAt) || 0) + 1),
    );
    changed.updatedByUid = str(actor);
    writes.push({
      update: { name: doc.name, fields: changed },
      updateMask: { fieldPaths: Object.keys(changed) },
      currentDocument: { updateTime: doc.updateTime },
    });
  }
  for (const doc of projects)
    patch(doc, {
      status: str('completed'),
      currentStage: str('closed'),
      settlementStatus: str('closed'),
    });
  for (const doc of records) {
    const old = doc.fields.stageCompletionConfirmed?.mapValue?.fields || {};
    const missing = [
      'installationDate',
      'commissioningDate',
      'educationDate',
    ].filter((key) => !value(doc.fields[key]) && value(old[key]) !== true);
    if (missing.length)
      patch(doc, {
        stageCompletionConfirmed: {
          mapValue: {
            fields: {
              ...old,
              ...Object.fromEntries(
                missing.map((key) => [key, { booleanValue: true }]),
              ),
              confirmedAt: int(now),
              source: str(
                '사용자 확인: 2026년 이전 사업의 설치·시운전·교육 완료. 실제 완료일은 미기록이며 기존 날짜는 보존함.',
              ),
            },
          },
        },
      });
  }
  for (const doc of documents) patch(doc, { status: str('approved') });
  const changedProjectIds = new Set();
  for (const write of writes) {
    const collection = write.update.name.split('/').at(-2);
    const doc = collections[collection].find(
      (candidate) => candidate.name === write.update.name,
    );
    changedProjectIds.add(
      collection === 'projects'
        ? doc.name.split('/').at(-1)
        : value(doc.fields.projectId),
    );
  }
  for (const doc of projects.filter((entry) =>
    changedProjectIds.has(entry.name.split('/').at(-1)),
  )) {
    // Guard the year even when only subordinate documents need changes.
    if (!writes.some((write) => write.update.name === doc.name)) {
      writes.push({
        update: {
          name: doc.name,
          fields: {
            updatedAt: int(
              Math.max(now, Number(value(doc.fields.updatedAt) || 0) + 1),
            ),
            updatedByUid: str(actor),
          },
        },
        updateMask: { fieldPaths: ['updatedAt', 'updatedByUid'] },
        currentDocument: { updateTime: doc.updateTime },
      });
    }
    const projectId = doc.name.split('/').at(-1);
    const id = `${runId}-${projectId}`;
    if (id.length > 160) throw new Error('Audit ID too long');
    const root = doc.name.slice(0, doc.name.lastIndexOf('/projects/'));
    const audit = {
      id: str(id),
      projectId: str(projectId),
      kind: str('system'),
      channel: str('system'),
      title: str('과거 사업 완료 상태 정정'),
      sender: str(''),
      receivedContent: str(
        '2026년도 이전 프로젝트의 진행·설치·시운전·교육·서류·정산은 모두 완료 상태라는 사용자 확인',
      ),
      actionContent: str(
        '진행 상태·서류·정산을 완료로 정정했습니다. 날짜가 없는 설치·시운전·교육은 별도 완료 확인으로 기록했습니다. 실제 날짜·금액·구독·입금 내역·업무 상태는 변경하지 않았습니다.',
      ),
      recorder: str('사용자 확인 · 운영 정정'),
      occurredAt: int(now),
      referenceUrl: str(''),
      blockedReason: str(''),
      blockedBy: str(''),
      expectedUnblockDate: str(''),
      resolvedAt: int(0),
      resolution: str(''),
      resolvedBy: str(''),
      createdAt: int(now),
      updatedAt: int(now),
      createdByUid: str(actor),
      updatedByUid: str(actor),
    };
    writes.push({
      update: { name: `${root}/projectUpdates/${id}`, fields: audit },
      currentDocument: { exists: false },
    });
  }
  return {
    runId,
    now,
    cutoffYear: 2026,
    targets: projects.map((doc) => ({
      id: doc.name.split('/').at(-1),
      year: value(doc.fields.year),
      name: value(doc.fields.name),
    })),
    summary: {
      projects: projects.length,
      farmRecords: records.length,
      documents: documents.length,
      writes: writes.length,
    },
    writes,
  };
}
