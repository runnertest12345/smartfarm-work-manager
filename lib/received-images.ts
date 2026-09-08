export const MAX_RECEIVED_IMAGES = 3;
export const MAX_IMAGE_BYTES = 384 * 1024;
export const MAX_IMAGE_DATA_LENGTH = 524400;
export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ReceivedImage {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  width: number;
  height: number;
}

/** Validate again at the command boundary, not just in the file picker. */
export function parseReceivedImages(value: unknown): ReceivedImage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_RECEIVED_IMAGES)
    throw new Error('이미지는 한 번에 최대 3장까지 첨부할 수 있습니다.');
  const ids = new Set<string>();
  return value.map((image: ReceivedImage) => {
    if (
      !image ||
      typeof image !== 'object' ||
      typeof image.id !== 'string' ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(image.id) ||
      ids.has(image.id)
    )
      throw new Error('이미지 정보를 다시 첨부해 주세요.');
    ids.add(image.id);
    if (
      typeof image.name !== 'string' ||
      !image.name.trim() ||
      image.name.length > 160 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)
    )
      throw new Error('PNG, JPG, WebP 이미지만 첨부할 수 있습니다.');
    if (
      typeof image.dataUrl !== 'string' ||
      image.dataUrl.length > MAX_IMAGE_DATA_LENGTH ||
      !image.dataUrl.startsWith(`data:${image.mimeType};base64,`)
    )
      throw new Error('이미지 크기나 형식을 확인해 주세요.');
    const encoded = image.dataUrl.split(',')[1];
    if (
      !encoded ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    )
      throw new Error('올바른 이미지 파일을 첨부해 주세요.');
    const size =
      (encoded.length * 3) / 4 -
      (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
    if (
      !Number.isSafeInteger(image.size) ||
      image.size !== size ||
      size <= 0 ||
      size > MAX_IMAGE_BYTES ||
      !Number.isSafeInteger(image.width) ||
      !Number.isSafeInteger(image.height) ||
      image.width < 1 ||
      image.height < 1 ||
      image.width > 12000 ||
      image.height > 12000
    )
      throw new Error('이미지 크기 정보를 확인해 주세요.');
    const bytes = atob(encoded.slice(0, 24));
    const valid =
      image.mimeType === 'image/png'
        ? bytes.startsWith('\x89PNG\r\n\x1a\n')
        : image.mimeType === 'image/jpeg'
          ? bytes.startsWith('\xff\xd8\xff')
          : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
    if (!valid) throw new Error('파일 내용과 이미지 형식이 일치하지 않습니다.');
    return {
      id: image.id,
      name: image.name.trim(),
      dataUrl: image.dataUrl,
      mimeType: image.mimeType,
      size,
      width: image.width,
      height: image.height,
    };
  });
}

export async function prepareReceivedImage(file: File): Promise<ReceivedImage> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('PNG, JPG, WebP 이미지만 첨부할 수 있습니다.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES)
    throw new Error('원본 이미지는 장당 10MB 이하로 선택해 주세요.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000)
      throw new Error(
        '너무 큰 이미지입니다. 필요한 부분을 다시 캡처해 주세요.',
      );
    let blob: Blob = file;
    let width = bitmap.width,
      height = bitmap.height;
    if (blob.size > MAX_IMAGE_BYTES) {
      const scale = Math.min(1, 2560 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = width = Math.max(1, Math.round(width * scale));
      canvas.height = height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context)
        throw new Error(
          '이미지를 처리하지 못했습니다. 파일을 다시 선택해 주세요.',
        );
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.92, 0.82, 0.72]) {
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error('이미지를 압축하지 못했습니다.')),
            'image/webp',
            quality,
          ),
        );
        if (blob.size <= MAX_IMAGE_BYTES) break;
      }
    }
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error(
        '압축 후에도 이미지가 큽니다. 필요한 부분만 나눠 캡처해 주세요.',
      );
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('이미지 파일을 읽지 못했습니다.'));
      reader.onerror = () =>
        reject(new Error('이미지 파일을 읽지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
    return parseReceivedImages([
      {
        id: crypto.randomUUID(),
        name:
          blob.type !== file.type
            ? `${(file.name || '캡처 이미지').replace(/\.[^.]+$/, '').slice(0, 150)}.${blob.type === 'image/webp' ? 'webp' : 'png'}`
            : (file.name || '캡처 이미지').slice(0, 160),
        dataUrl,
        mimeType: blob.type,
        size: blob.size,
        width,
        height,
      },
    ])[0];
  } finally {
    bitmap.close();
  }
}
