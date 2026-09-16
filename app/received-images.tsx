'use client';
/* oxlint-disable next/no-img-element -- Private data URL attachments are already bounded/compressed and have no optimizer URL. */

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ClipboardEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MAX_RECEIVED_IMAGES,
  prepareReceivedImage,
  type ReceivedImage,
} from '@/lib/received-images';
import { loadReceivedImage } from '@/lib/firebase/received-images-store';

export function ReceivedContentInput({
  images,
  onImagesChange,
  onBusyChange,
  imageOnly = false,
  existingCount = 0,
  ...props
}: ComponentProps<typeof Textarea> & {
  images: ReceivedImage[];
  onImagesChange: (images: ReceivedImage[]) => void;
  onBusyChange: (busy: boolean) => void;
  imageOnly?: boolean;
  existingCount?: number;
}) {
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function addFiles(files: File[]) {
    if (busy.current || props.disabled) return;
    setError('');
    if (existingCount + images.length + files.length > MAX_RECEIVED_IMAGES) {
      setError('이미지는 한 번에 최대 3장까지 첨부할 수 있습니다.');
      return;
    }
    busy.current = true;
    setProcessing(true);
    onBusyChange(true);
    try {
      const added = [];
      for (const file of files) added.push(await prepareReceivedImage(file));
      if (mounted.current) onImagesChange([...images, ...added]);
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : '이미지를 첨부하지 못했습니다.',
        );
    } finally {
      busy.current = false;
      if (mounted.current) setProcessing(false);
      onBusyChange(false);
    }
  }
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length) {
      if (!event.clipboardData.getData('text/plain')) event.preventDefault();
      void addFiles(files);
    }
  };
  return (
    <div className="space-y-2">
      {imageOnly ? (
        <fieldset
          tabIndex={props.disabled ? -1 : 0}
          aria-label="농장 위치도 사진 붙여넣기"
          aria-disabled={props.disabled || processing}
          onPaste={onPaste}
          className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          이 영역을 선택한 뒤 Ctrl+V로 위치도 캡처를 붙여넣거나 아래에서 사진을
          선택하세요.
        </fieldset>
      ) : (
        <Textarea {...props} onPaste={onPaste} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border bg-white px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-emerald-600">
          {imageOnly ? '위치도 사진 선택' : '이미지 파일 첨부'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            disabled={props.disabled || processing}
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = '';
              void addFiles(files);
            }}
          />
        </label>
        <span className="text-xs text-slate-600">
          {imageOnly
            ? 'PNG·JPG·WebP · 기존 사진 포함 최대 3장 · 원본 장당 10MB 이하 · 큰 사진은 자동 압축'
            : '받은 내용에 Ctrl+V로 캡처 붙여넣기 · 최대 3장 · 큰 이미지는 자동 압축'}
        </span>
      </div>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((image) => (
            <li key={image.id} className="w-36 rounded-md border bg-white p-2">
              <img
                src={image.dataUrl}
                alt={image.name}
                className="h-24 w-full object-contain"
              />
              <p className="mt-1 truncate text-xs">{image.name}</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={props.disabled || processing}
                onClick={() =>
                  onImagesChange(images.filter((item) => item.id !== image.id))
                }
                aria-label={`${image.name} 첨부 제거`}
              >
                제거
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {processing && (
        <output className="text-sm text-slate-600">
          이미지를 처리하고 있습니다. 완료 후 저장해 주세요.
        </output>
      )}
    </div>
  );
}

/** Payloads are fetched on demand, never by the workspace-wide realtime listener. */
export function ReceivedImages({ imageIds = [] }: { imageIds?: string[] }) {
  return imageIds.length ? (
    <ReceivedImageGallery key={imageIds.join(',')} imageIds={imageIds} />
  ) : null;
}

function ReceivedImageGallery({ imageIds }: { imageIds: string[] }) {
  const [images, setImages] = useState<ReceivedImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  async function show() {
    if (loading) return;
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (images) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setImages(
        await Promise.all(
          imageIds.slice(0, MAX_RECEIVED_IMAGES).map(loadReceivedImage),
        ),
      );
      setExpanded(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '이미지를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        aria-expanded={expanded}
        onClick={() => void show()}
      >
        {loading
          ? '이미지 불러오는 중…'
          : expanded
            ? '첨부 이미지 접기'
            : `첨부 이미지 ${imageIds.length}장 보기`}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error} 다시 눌러 재시도할 수 있습니다.
        </p>
      )}
      {expanded && images && (
        <ul className="space-y-4">
          {images.map((image) => (
            <li key={image.id} className="rounded-md border bg-white p-3">
              <p className="mb-2 text-sm">{image.name}</p>
              <img
                src={image.dataUrl}
                alt={image.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
              <a
                href={image.dataUrl}
                download={image.name}
                className="mt-2 inline-block text-sm font-medium text-emerald-800 underline"
              >
                이미지 내려받기
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
