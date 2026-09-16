// This legacy shortcut deliberately cannot change a default Firebase project.
console.error('자동 Firebase 배포를 중단했습니다. clone/setup/build는 운영 규칙이나 계정을 변경하지 않습니다.');
console.error('docs/deployment/server-setup.md를 확인하고, 검토한 대상에만 --project와 --only를 명시해 pnpm exec firebase deploy를 직접 실행하세요.');
console.error('기존 .firebaserc의 default는 현재 운영 프로젝트입니다. 독립 복사본으로 착각해 실행하지 마세요.');
process.exitCode = 1;
