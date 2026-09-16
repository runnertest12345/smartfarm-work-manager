// Offline fixtures only. No Firebase rules deployment, network, or live data tests.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  'portable-setup', 'member-config', 'member-service',
  'dashboard-kpis', 'workspace-navigation', 'annual-overview', 'annual-metric-list',
  'work-title', 'work-title-editor', 'work-task-controls', 'work-board',
  'work-calendar', 'work-calendar-statuses', 'work-calendar-groups',
  'project-task-detail', 'detail-navigation', 'subscription-payment',
  'subscription-payment-report', 'subscription-renewal-report', 'subscription-report-ui',
  'project-management', 'project-settlement-workspace', 'project-receivables',
  'ui-deduplication', 'project-work-ui',
];
for (const suite of suites) {
  console.log(`\nRunning fixture suite: ${suite}`);
  const result = spawnSync(process.execPath, [resolve(root, `scripts/test-${suite}.mjs`)], {
    cwd: root, stdio: 'inherit', shell: false,
  });
  if (result.error || result.status !== 0) {
    console.error(`Fixture suite failed: ${suite}`);
    process.exit(result.status || 1);
  }
}
console.log(`All ${suites.length} offline fixture suites passed. No operational records were changed.`);
