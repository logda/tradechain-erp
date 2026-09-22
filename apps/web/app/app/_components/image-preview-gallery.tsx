'use client';

import { useEffect, useState } from 'react';

type ImagePreviewGalleryProps = {
  productName: string;
  imageUrls?: string[];
};

const galleryStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '8px',
  alignItems: 'center',
} satisfies React.CSSProperties;

const thumbnailButtonStyle = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'zoom-in',
  lineHeight: 0,
} satisfies React.CSSProperties;

const thumbnailStyle = {
  width: '72px',
  height: '72px',
  objectFit: 'cover' as const,
  borderRadius: '10px',
  border: '1px solid #d8e1ea',
  background: '#f8fafc',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 80,
  background: 'rgba(15, 23, 42, 0.72)',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
} satisfies React.CSSProperties;

const dialogStyle = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gap: '16px',
  padding: '20px',
  background: '#0f172a',
} satisfies React.CSSProperties;

const dialogHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const dialogTitleStyle = {
  margin: 0,
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const dialogMetaStyle = {
  margin: 0,
  color: '#cbd5e1',
  fontSize: '13px',
} satisfies React.CSSProperties;

const closeButtonStyle = {
  border: '1px solid rgba(255,255,255,0.24)',
  borderRadius: '999px',
  padding: '10px 16px',
  background: 'rgba(255,255,255,0.08)',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const previewControlsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const navButtonStyle = {
  ...closeButtonStyle,
  minWidth: '84px',
} satisfies React.CSSProperties;

const counterStyle = {
  margin: 0,
  color: '#e2e8f0',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const dialogBodyStyle = {
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
  overflow: 'auto',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.03)',
  padding: '16px',
} satisfies React.CSSProperties;

const previewImageStyle = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain' as const,
  borderRadius: '18px',
  background: '#ffffff',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.24)',
} satisfies React.CSSProperties;

export function ImagePreviewGallery({
  productName,
  imageUrls,
}: ImagePreviewGalleryProps) {
  const normalizedImageUrls =
    imageUrls?.filter((imageUrl) => imageUrl.trim()) ?? [];
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const hasMultipleImages = normalizedImageUrls.length > 1;

  function showPreviousImage() {
    setPreviewIndex((currentIndex) => {
      if (currentIndex === null) {
        return null;
      }

      return currentIndex === 0
        ? normalizedImageUrls.length - 1
        : currentIndex - 1;
    });
  }

  function showNextImage() {
    setPreviewIndex((currentIndex) => {
      if (currentIndex === null) {
        return null;
      }

      return currentIndex === normalizedImageUrls.length - 1
        ? 0
        : currentIndex + 1;
    });
  }

  useEffect(() => {
    if (previewIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewIndex(null);
      }

      if (event.key === 'ArrowLeft' && normalizedImageUrls.length > 1) {
        setPreviewIndex((currentIndex) => {
          if (currentIndex === null) {
            return null;
          }

          return currentIndex === 0
            ? normalizedImageUrls.length - 1
            : currentIndex - 1;
        });
      }

      if (event.key === 'ArrowRight' && normalizedImageUrls.length > 1) {
        setPreviewIndex((currentIndex) => {
          if (currentIndex === null) {
            return null;
          }

          return currentIndex === normalizedImageUrls.length - 1
            ? 0
            : currentIndex + 1;
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [normalizedImageUrls.length, previewIndex]);

  if (normalizedImageUrls.length === 0) {
    return <span>-</span>;
  }

  const previewSrc =
    previewIndex === null ? undefined : normalizedImageUrls[previewIndex];
  const activePreview =
    previewIndex === null || !previewSrc
      ? null
      : {
          index: previewIndex,
          src: previewSrc,
        };

  return (
    <>
      <div style={galleryStyle}>
        {normalizedImageUrls.map((imageUrl, index) => (
          <button
            key={`${productName}-${imageUrl}`}
            type="button"
            style={thumbnailButtonStyle}
            aria-label={`查看 ${productName} 图片 ${index + 1}`}
            onClick={() => setPreviewIndex(index)}
          >
            <img
              src={imageUrl}
              alt={`${productName} 图片 ${index + 1}`}
              style={thumbnailStyle}
            />
          </button>
        ))}
      </div>

      {activePreview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} 图片预览`}
          style={overlayStyle}
          onClick={() => setPreviewIndex(null)}
        >
          <div className="erp-dialog" style={dialogStyle} onClick={(event) => event.stopPropagation()}>
            <div style={dialogHeaderStyle}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <h3 style={dialogTitleStyle}>{productName}</h3>
                <p style={dialogMetaStyle}>
                  点击空白处或关闭按钮返回列表，支持 Esc 关闭
                  {hasMultipleImages ? '、左右方向键切换' : ''}
                </p>
              </div>
              <div style={previewControlsStyle}>
                {hasMultipleImages ? (
                  <>
                    <button
                      type="button"
                      style={navButtonStyle}
                      onClick={showPreviousImage}
                    >
                      上一张
                    </button>
                    <p style={counterStyle}>
                      {activePreview.index + 1} / {normalizedImageUrls.length}
                    </p>
                    <button
                      type="button"
                      style={navButtonStyle}
                      onClick={showNextImage}
                    >
                      下一张
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  style={closeButtonStyle}
                  onClick={() => setPreviewIndex(null)}
                >
                  关闭
                </button>
              </div>
            </div>

            <div style={dialogBodyStyle}>
              <img
                className="erp-media-contain"
                src={activePreview.src}
                alt={`${productName} 大图预览 ${activePreview.index + 1}`}
                style={previewImageStyle}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
