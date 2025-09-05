import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

export function Modal({
  isOpen,
  onClose,
  onMinimize,
  title,
  children,
  className = "",
  header = true,
}) {
  const [mounted, setMounted] = useState(false);

  // mount when isOpen goes true
  useEffect(() => {
    if (isOpen) setMounted(true);
    else setMounted(false);
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`h-dvh md:h-full fixed inset-0 z-50 flex
        items-end justify-center
        md:items-center md:justify-center
        bg-black bg-opacity-0
        transition-colors duration-200
        ${isOpen ? "bg-opacity-30" : ""}
      `}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-[#EDEFF2] md:bg-white w-full md:rounded-2xl md:!max-w-2xl
          h-dvh md:!max-h-[90vh] md:!h-fit overflow-y-auto overflow-x-hidden scrollbar-custom
          ${isOpen ? "animate-fade-slide-up md:animate-fade-scale-up" : ""}
          ${className}
        `}
      >
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="absolute top-3 left-3 md:right-12 text-netral-600 bg-white rounded-full p-1.5 hidden md:block"
            aria-label="Minimize"
          >
            <ChevronDown size={18} />
          </button>
        )}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 md:right-3 text-netral-600 bg-white rounded-full p-1.5 hidden md:block"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {header ||
          (title && (
            <div className="px-6 py-4 border-b">
              <h2 className="text-2xl font-semibold">{title}</h2>
            </div>
          ))}

        <div className="size-full">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
