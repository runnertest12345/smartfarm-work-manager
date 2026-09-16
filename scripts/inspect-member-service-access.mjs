// Read-only preflight. Do not print tokens, IAM members, or VM metadata values.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('firebase-tools/lib/logger').logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const options = { project: 'smartfarm-work-manager', nonInteractive: true };
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Firebase operator login required');
auth.setActiveAccount(options, account);
await requireAuth(options);
const hidden = () => ({
  skipLog: { body: true, resBody: true, queryParams: true },
});
const resource = new Client({
  urlPrefix: 'https://cloudresourcemanager.googleapis.com',
  auth: true,
});
const compute = new Client({
  urlPrefix: 'https://compute.googleapis.com',
  auth: true,
});
for (const project of ['runner-507408', 'smartfarm-work-manager']) {
  try {
    const { body } = await resource.post(
      `/v1/projects/${project}:testIamPermissions`,
      {
        permissions: [
          'resourcemanager.projects.getIamPolicy',
          'resourcemanager.projects.setIamPolicy',
          'iam.roles.create',
          'iam.roles.get',
          'iam.serviceAccounts.actAs',
          'iam.serviceAccounts.create',
          'iam.serviceAccounts.get',
          'iam.serviceAccounts.setIamPolicy',
          'compute.instances.get',
          'compute.instances.setMetadata',
          'compute.instances.stop',
          'compute.instances.start',
          'compute.instances.setServiceAccount',
          'compute.addresses.create',
        ],
      },
      hidden(),
    );
    console.log(JSON.stringify({ project, granted: body.permissions || [] }));
  } catch (error) {
    console.log(
      JSON.stringify({
        project,
        status:
          error.status || error.context?.response?.statusCode || 'unavailable',
      }),
    );
  }
}
// Restrict the summary to the one existing VM identity; never dump the policy.
for (const project of ['runner-507408', 'smartfarm-work-manager']) {
  try {
    const { body } = await resource.post(`/v1/projects/${project}:getIamPolicy`, {}, hidden());
    const identity = 'serviceAccount:68336225524-compute@developer.gserviceaccount.com';
    console.log(JSON.stringify({ project, vmIdentityRoles: (body.bindings || []).filter((binding) => binding.members?.includes(identity)).map((binding) => ({ role: binding.role, conditional: Boolean(binding.condition) })) }));
  } catch (error) {
    console.log(JSON.stringify({ project, vmIdentityRoleStatus: error.status || 'unavailable' }));
  }
}
try {
  const { body } = await compute.get('/compute/v1/projects/runner-507408/regions/asia-northeast3/addresses', hidden());
  console.log(JSON.stringify({ productionIp: '34.64.62.115', reservations: (body.items || []).filter((entry) => entry.address === '34.64.62.115').map((entry) => ({ name: entry.name, status: entry.status, addressType: entry.addressType })) }));
} catch (error) {
  console.log(JSON.stringify({ addressReservationStatus: error.status || 'unavailable' }));
}
try {
  const { body } = await compute.get(
    '/compute/v1/projects/runner-507408/zones/asia-northeast3-c/instances/instance-20260902-085248',
    hidden(),
  );
  console.log(
    JSON.stringify({
      instance: body.name,
      status: body.status,
      metadataKeys: (body.metadata?.items || []).map((item) => item.key),
      osLogin: body.metadata?.items?.find(
        (item) => item.key === 'enable-oslogin',
      )?.value,
      serviceAccounts: body.serviceAccounts?.map((item) => ({
        email: item.email,
        scopes: item.scopes,
      })),
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      instance: 'instance-20260902-085248',
      status:
        error.status || error.context?.response?.statusCode || 'unavailable',
    }),
  );
}
