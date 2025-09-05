import { createPortal } from "react-dom";
import { Check, ChevronUp, Loader2, X } from "lucide-react";

export function MinimizedTryOn({
  anySuccess,
  stageText,
  onClickOpen,
  onClose,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 cursor-pointer
                 w-[340px] h-14 rounded-full shadow-[-5px_6px_29px_0px_#dbdbdb]
                 border border-gray-300 bg-gray-50
                 flex items-center !z-40"
      // Use a huge z-index to beat theme elements
      style={{ zIndex: 2147483647 }} // max 32-bit int
      onClick={onClickOpen}
    >
      <div className="flex justify-between items-center w-full px-5">
        <div className="relative h-full flex items-center gap-2">
          {anySuccess ? (
            <div className="flex justify-center items-center p-1 rounded-full bg-green-600 text-white">
              <Check size={13} />
            </div>
          ) : (
            <Loader2 size={17} className="animate-spin" />
          )}
          <div className="relative">
            <p className="text-sm font-semibold">
              {anySuccess ? "Try on image is ready" : stageText}
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-red-100"
            aria-label="Close"
          >
            <X size={16} className="text-red-700" />
          </button>
          <div className="p-1.5 rounded-full hover:bg-gray-100">
            <ChevronUp size={16} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
