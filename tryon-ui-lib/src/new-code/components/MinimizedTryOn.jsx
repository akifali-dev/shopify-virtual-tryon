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
      className="ai-mini"
      style={{ zIndex: 2147483647 }}
      onClick={onClickOpen}
      role="button"
      aria-label={anySuccess ? "Open try-on result" : "Open try-on progress"}
    >
      <div className="ai-mini__inner">
        <div className="ai-mini__left">
          {anySuccess ? (
            <div className="ai-mini__status" aria-hidden="true">
              <Check size={13} />
            </div>
          ) : (
            <Loader2 size={17} className="ai-mini__loader" aria-hidden="true" />
          )}

          <p className="ai-mini__text">
            {anySuccess ? "Try on image is ready" : stageText}
          </p>
        </div>

        <div className="ai-mini__right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ai-mini__btn ai-mini__btn--close"
            aria-label="Close"
            type="button"
          >
            <X size={16} className="ai-mini__btnIcon--close" />
          </button>

          <button className="ai-mini__btn ai-mini__btn--chev" aria-hidden="true">
            <ChevronUp size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
