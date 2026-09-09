import {
  MAX_RECEIVED_IMAGES,
  parseReceivedImages,
  type ReceivedImage,
} from './received-images';

export interface FarmLocationChange {
  keptIds: string[];
  expectedIds: string[];
  images: ReceivedImage[];
}

function imageIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_RECEIVED_IMAGES ||
    value.some(
      (id) => typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(id),
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error('위치도 사진 정보를 다시 확인해 주세요.');
  }
  return [...value];
}

export function parseFarmLocationChange(
  body: Record<string, unknown>,
): FarmLocationChange | undefined {
  if (
    body.locationImageIds === undefined &&
    body.expectedLocationImageIds === undefined &&
    body.locationImages === undefined
  )
    return undefined;
  const keptIds = imageIds(body.locationImageIds);
  const expectedIds = imageIds(body.expectedLocationImageIds);
  const images = parseReceivedImages(body.locationImages);
  imageIds([...keptIds, ...images.map((image) => image.id)]);
  if (
    keptIds.some((id) => !expectedIds.includes(id)) ||
    images.some((image) => expectedIds.includes(image.id))
  )
    throw new Error('기존 위치도 사진과 새 사진을 확인해 주세요.');
  return { keptIds, expectedIds, images };
}

export function resolveFarmLocationImages(
  existing: string[] = [],
  change?: FarmLocationChange,
): string[] {
  if (!change) return [...existing];
  if (JSON.stringify(existing) !== JSON.stringify(change.expectedIds))
    throw new Error(
      '다른 사용자가 위치도 사진을 변경했습니다. 입력 내용은 유지됩니다. 창을 다시 열어 최신 사진을 확인해 주세요.',
    );
  return [...change.keptIds, ...change.images.map((image) => image.id)];
}
