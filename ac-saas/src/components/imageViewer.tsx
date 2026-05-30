"use client";

import { useState } from "react";
import { X, ImageIcon, ZoomIn } from "lucide-react";

export interface ViewImage {
  url: string;
  label?: string;
}

// Fullscreen lightbox showing one or more images
function Lightbox({ images, onClose }: { images: ViewImage[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <X className="w-7 h-7" />
      </button>
      <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`grid gap-4 ${images.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
          {images.map((img, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden">
              {img.label && (
                <div className="px-4 py-2 text-sm font-medium text-slate-700 border-b border-slate-100">{img.label}</div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.label || `Image ${i + 1}`} className="w-full object-contain max-h-[70vh]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A "View" button that opens uploaded photos in a lightbox.
 * Pass an array of images (filters out empties automatically).
 * `variant`: "button" (text link) or "thumb" (clickable thumbnail of the first image).
 */
export function ViewPhotosButton({
  images,
  variant = "button",
  label = "View",
}: {
  images: (ViewImage | undefined | null)[];
  variant?: "button" | "thumb";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const valid = images.filter((i): i is ViewImage => !!i && !!i.url);

  if (valid.length === 0) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  return (
    <>
      {open && <Lightbox images={valid} onClose={() => setOpen(false)} />}
      {variant === "thumb" ? (
        <button onClick={() => setOpen(true)} className="relative group" title="View photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valid[0].url} alt="proof" className="w-9 h-9 object-cover rounded-md border border-slate-200" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-md transition-opacity">
            <ZoomIn className="w-4 h-4 text-white" />
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {label}{valid.length > 1 ? ` (${valid.length})` : ""}
        </button>
      )}
    </>
  );
}
