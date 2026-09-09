'use client';

import {
  doc,
  getDocFromServer,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import {
  getFirebaseServices,
  firebaseWorkspaceId,
  requireSignedInUser,
} from './client';
import { parseReceivedImages, type ReceivedImage } from '../received-images';

export function writeReceivedImages(
  writer: { set: (ref: DocumentReference, data: DocumentData) => unknown },
  images: ReceivedImage[],
  parentCollection: 'inboxItems' | 'historyEntries' | 'farms',
  parentId: string,
) {
  const uid = requireSignedInUser().uid;
  const now = Date.now();
  for (const image of images) {
    writer.set(
      doc(
        getFirebaseServices().db,
        'workspaces',
        firebaseWorkspaceId,
        'imageAttachments',
        image.id,
      ),
      {
        ...image,
        parentCollection,
        parentId,
        createdAt: now,
        createdByUid: uid,
      },
    );
  }
}

export async function loadReceivedImage(id: string) {
  requireSignedInUser();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id))
    throw new Error('이미지 정보를 확인해 주세요.');
  const snapshot = await getDocFromServer(
    doc(
      getFirebaseServices().db,
      'workspaces',
      firebaseWorkspaceId,
      'imageAttachments',
      id,
    ),
  );
  if (!snapshot.exists()) throw new Error('첨부 이미지를 찾을 수 없습니다.');
  return parseReceivedImages([{ ...snapshot.data(), id }])[0];
}
