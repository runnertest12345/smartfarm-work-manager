import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = (path) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, aliases) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source(path), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      TextEncoder,
      TextDecoder,
      require: (name) => aliases[name] || require(name),
    },
  );
  return module.exports;
}
const organization = load('lib/organization.ts', {});
const identity = load('lib/login-identity.ts', {});
function harness(options = {}) {
  let slots = [],
    cursor = 0,
    tokenChanged,
    memberChanged,
    subscriptionCount = 0,
    offMemberCount = 0;
  let offEffect;
  const calls = [];
  const hooks = {
    ...React,
    useState(initial) {
      const id = cursor++;
      if (!(id in slots))
        slots[id] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[id],
        (next) => {
          slots[id] = typeof next === 'function' ? next(slots[id]) : next;
        },
      ];
    },
    useEffect(effect) {
      if (!offEffect) offEffect = effect();
    },
  };
  hooks.useRef = (initial) => hooks.useState(() => ({ current: initial }))[0];
  const button = (props) => React.createElement('button', props);
  const services = { auth: {}, db: {} };
  function Dashboard() {}
  const auth = {
    onIdTokenChanged: (_auth, callback) => {
      tokenChanged = callback;
      return () => {};
    },
    createUserWithEmailAndPassword: async (_auth, email, password) => {
      calls.push(['signup', email, password]);
      return { user: { uid: 'new', email } };
    },
    updateProfile: async (user, patch) => calls.push(['profile', patch]),
    sendEmailVerification: async (user) => calls.push(['verify', user.uid]),
    signInWithEmailAndPassword: async (_auth, email, password) =>
      calls.push(['login', email, password]),
    sendPasswordResetEmail: async (_auth, email) =>
      calls.push(['reset', email]),
    updatePassword: async (user, password) => {
      calls.push(['password', user.uid, password]);
      if (options.passwordFailure) throw new Error('암호 변경 실패');
    },
    signOut: async () => tokenChanged(null),
  };
  const { FirebaseAuthGate } = load('app/firebase-auth-gate.tsx', {
    react: hooks,
    'firebase/auth': auth,
    'firebase/firestore': {
      doc: (_db, ...parts) => parts.join('/'),
      onSnapshot: (_ref, callback) => {
        memberChanged = callback;
        subscriptionCount++;
        return () => offMemberCount++;
      },
    },
    '@/components/ui/button': { Button: button },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/label': { Label: 'label' },
    '@/lib/firebase/client': {
      firebaseConfigurationReady: true,
      firebaseWorkspaceId: 'test',
      getFirebaseServices: () => services,
    },
    '@/lib/firebase/organization-store': {
      acknowledgePasswordChange: async () => {
        calls.push(['ack']);
        if (options.ackFailure) throw new Error('안내 상태 저장 실패');
      },
    },
    '@/lib/login-identity': identity,
    '@/lib/organization': organization,
    './farm-ledger-dashboard': { FarmLedgerDashboard: Dashboard },
  });
  return {
    render() {
      cursor = 0;
      return FirebaseAuthGate();
    },
    login(user) {
      return tokenChanged(user);
    },
    membership(data) {
      memberChanged({ exists: () => Boolean(data), data: () => data });
    },
    get subscriptions() {
      return subscriptionCount;
    },
    get unsubscribed() {
      return offMemberCount;
    },
    calls,
    Dashboard,
    stop() {
      offEffect();
    },
  };
}
function nodes(tree) {
  return tree && typeof tree === 'object'
    ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]
    : [];
}
function find(tree, predicate) {
  const node = nodes(tree).find(predicate);
  assert.ok(node, 'UI control exists');
  return node;
}
const approved = {
  active: true,
  admin: false,
  workspaceId: 'test',
  email: 'employee@example.test',
  displayName: '직원',
  departmentId: 'sales',
};
const user = {
  uid: 'employee',
  email: approved.email,
  emailVerified: true,
  displayName: approved.displayName,
};
test('미인증·승인 대기·다른 작업공간은 업무 화면을 열지 않는다', () => {
  const h = harness();
  h.render();
  h.login({ ...user, emailVerified: false });
  assert.notEqual(h.render().type, h.Dashboard);
  assert.equal(h.subscriptions, 0);
  h.login(user);
  h.membership(null);
  assert.notEqual(h.render().type, h.Dashboard);
  h.membership({ ...approved, workspaceId: 'other' });
  assert.notEqual(h.render().type, h.Dashboard);
  h.membership(approved);
  assert.equal(h.render().type, h.Dashboard);
  assert.equal(h.render().props.member.admin, false);
});
test('같은 사용자 토큰 갱신은 화면과 회원 구독을 유지하며 승인 취소는 즉시 차단한다', () => {
  const h = harness();
  h.render();
  h.login(user);
  h.membership(approved);
  assert.equal(h.render().type, h.Dashboard);
  h.login({ ...user });
  assert.equal(h.render().type, h.Dashboard);
  assert.equal(h.subscriptions, 1);
  assert.equal(h.unsubscribed, 0);
  h.membership({ ...approved, active: false });
  assert.notEqual(h.render().type, h.Dashboard);
  h.login(null);
  assert.equal(h.unsubscribed, 1);
});
test('다른 계정으로 변경되면 이전 회원 권한과 늦은 콜백을 재사용하지 않는다', () => {
  const h = harness();
  h.render();
  h.login(user);
  h.membership({ ...approved, admin: true });
  h.login({ ...user, uid: 'other', displayName: '다른 직원' });
  assert.notEqual(h.render().type, h.Dashboard);
  h.membership(null);
  assert.notEqual(h.render().type, h.Dashboard);
  assert.equal(h.subscriptions, 2);
});
test('공개 가입 양식 없이 한글 아이디로 로그인한다', async () => {
  const h = harness();
  h.render();
  h.login(null);
  let tree = h.render();
  assert.equal(
    nodes(tree).some((n) => n.props?.children === '직접 회원가입'),
    false,
  );
  const inputs = nodes(tree).filter((node) => node.type === 'input');
  const values = {
    name: '평화',
    password: 'sample-test-password-only',
  };
  for (const input of inputs) {
    const type = input.props.type;
    input.props.onChange({
      target: {
        value: type === 'password' ? values.password : values.name,
      },
    });
  }
  tree = h.render();
  await find(tree, (node) => node.type === 'form').props.onSubmit({
    preventDefault() {},
  });
  await new Promise(setImmediate);
  assert.equal(h.calls[0][0], 'login');
  assert.equal(h.calls[0][1], identity.loginEmail(values.name));
  assert.equal(h.calls.length, 1);
  assert.equal(
    h.calls.some((call) => call[0] === 'request'),
    false,
  );
});
test('한글·NFC·영문 정규화와 아이디 왕복을 지키고 잘못된 주소를 거부한다', () => {
  for (const id of ['평화', '러너', '담호', '직원_01', 'abcdefghij']) {
    const email = identity.loginEmail(id);
    assert.equal(identity.loginIdFromEmail(email), id);
    assert.ok(email.split('@')[0].length <= 64);
  }
  assert.equal(
    identity.loginEmail(' 평화 '.normalize('NFD')),
    identity.loginEmail('평화'),
  );
  assert.equal(identity.loginEmail(' Runner '), identity.loginEmail('runner'));
  for (const id of ['a', 'with space', 'user@test', '💚직원', 'abcdefghijk'])
    assert.throws(() => identity.loginEmail(id));
  for (const email of [
    'user@example.test',
    'u0000@staff.smartfarm-work-manager.invalid',
    'u6161@staff.smartfarm-work-manager.invalid.evil',
    'u616@staff.smartfarm-work-manager.invalid',
  ])
    assert.equal(identity.loginIdFromEmail(email), '');
});
test('아이디 계정은 비밀번호 제공자만 허용하고 토큰 갱신 시 초안을 유지한다', async () => {
  const h = harness();
  h.render();
  const aliasUser = {
    ...user,
    email: identity.loginEmail('러너'),
    emailVerified: false,
    getIdTokenResult: async () => ({ signInProvider: 'password' }),
  };
  await h.login(aliasUser);
  h.membership({ ...approved, email: aliasUser.email });
  assert.equal(h.render().type, h.Dashboard);
  await h.login(aliasUser);
  assert.equal(h.render().type, h.Dashboard);
  assert.equal(h.subscriptions, 1);
  await h.login({
    ...aliasUser,
    getIdTokenResult: async () => ({ signInProvider: 'custom' }),
  });
  assert.notEqual(h.render().type, h.Dashboard);
});
test('늦게 끝난 아이디 토큰 확인이 로그아웃을 되돌리지 않는다', async () => {
  const h = harness();
  h.render();
  let resolve;
  const pending = h.login({
    ...user,
    email: identity.loginEmail('평화'),
    emailVerified: false,
    getIdTokenResult: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  await h.login(null);
  resolve({ signInProvider: 'password' });
  await pending;
  assert.equal(h.subscriptions, 0);
  assert.notEqual(h.render().type, h.Dashboard);
});
for (const outcome of ['success', 'passwordFailure', 'ackFailure']) {
  test(`첫 로그인 비밀번호 변경 ${outcome}: 성공 후에만 안내 확인`, async () => {
    const h = harness({ [outcome]: true });
    h.render();
    await h.login(user);
    h.membership({ ...approved, passwordChangeRequired: true });
    let tree = h.render();
    assert.notEqual(tree.type, h.Dashboard);
    for (const id of ['new-password', 'confirm-password'])
      find(tree, (n) => n.props?.id === id).props.onChange({
        target: { value: 'test-only-new-password' },
      });
    tree = h.render();
    find(tree, (n) => n.type === 'form').props.onSubmit({
      preventDefault() {},
    });
    await new Promise(setImmediate);
    assert.equal(h.calls[0][0], 'password');
    assert.equal(
      h.calls.some((c) => c[0] === 'ack'),
      outcome !== 'passwordFailure',
    );
    if (outcome === 'ackFailure') {
      tree = h.render();
      assert.equal(
        nodes(tree).some((n) => n.props?.id === 'new-password'),
        false,
      );
      assert.ok(
        nodes(tree).some(
          (n) => n.props?.children === '변경 완료 확인 다시 시도',
        ),
      );
    }
  });
}
test('부서장 판정은 같은 부서 승인 계정끼리만 성립하고 공용 계정은 관리자일 수 없다', () => {
  const actor = organization.readMember('head', {
    ...approved,
    departmentId: 'sales',
  });
  const target = organization.readMember('staff', approved);
  assert.equal(
    organization.isDepartmentHeadAssignment(actor, target, {
      id: 'sales',
      headUid: actor.id,
    }),
    true,
  );
  assert.equal(
    organization.isDepartmentHeadAssignment(
      actor,
      { ...target, departmentId: 'other' },
      { id: 'sales', headUid: actor.id },
    ),
    false,
  );
  assert.equal(
    organization.isDepartmentHeadAssignment(
      actor,
      { ...target, active: false },
      { id: 'sales', headUid: actor.id },
    ),
    false,
  );
  assert.equal(
    organization.isOrganizationAdmin({
      ...actor,
      admin: true,
      email: organization.SHARED_ACCESS_EMAIL,
    }),
    false,
  );
  assert.equal(
    organization.readMember('legacy', { active: true }).admin,
    false,
  );
});
