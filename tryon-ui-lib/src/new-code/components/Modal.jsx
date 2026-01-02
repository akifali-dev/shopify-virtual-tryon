// import React, { useEffect, useState } from "react";
// import { createPortal } from "react-dom";
// import { ChevronDown, X } from "lucide-react";

// export function Modal({
//   isOpen,
//   onClose,
//   onMinimize,
//   title,
//   children,
//   className = "",
//   header = true,
// }) {
//   const [mounted, setMounted] = useState(false);

//   // mount when isOpen goes true
//   useEffect(() => {
//     if (isOpen) setMounted(true);
//     else setMounted(false);
//   }, [isOpen]);

//   if (!mounted) return null;

//   return createPortal(
//     <div
//       className={`ai-modal-overlay ${isOpen ? "ai-modal-overlay--open" : ""}`}
//       onClick={onClose}
//     >
//       <div
//         onClick={(e) => e.stopPropagation()}
//         className={`ai-modal-dialog ${isOpen ? "ai-modal-animate-in" : ""} ${className}`}
//       >
//         {onMinimize && (
//           <button
//             onClick={onMinimize}
//             className="ai-modal-iconBtn ai-modal-iconBtn--min"
//             aria-label="Minimize"
//           >
//             <ChevronDown size={18} />
//           </button>
//         )}

//         <button
//           onClick={onClose}
//           className="ai-modal-iconBtn ai-modal-iconBtn--close"
//           aria-label="Close"
//         >
//           <X size={18} />
//         </button>

//         {header ||
//           (title && (
//             <div className="ai-modal-header">
//               <h2 className="ai-modal-title">{title}</h2>
//             </div>
//           ))}

//         <div className="ai-modal-content">{children}</div>
//       </div>
//     </div>,
//     document.body,
//   );
// }

// =========================================================================

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
      className={`ai-modal-wrapper ${isOpen ? "ai-is-open" : ""}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "ai-modal-title" : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`ai-modal ai-animate-in ai-scrollbar ${className}`}
      >
        {/* {onMinimize && (
          <button
            onClick={onMinimize}
            className="ai-modal-btn ai-modal-btn--minimize"
            aria-label="Minimize"
          >
            <ChevronDown size={18} />
          </button>
        )}

        <button
          onClick={onClose}
          className="ai-modal-btn ai-modal-btn--close"
          aria-label="Close"
        >
          <X size={18} />
        </button> */}
{/* 
        {(header || title) && (
          <div className="ai-modal-header">
            {title && (
              <h2 id="ai-modal-title" className="ai-modal-title">
                {title}
              </h2>
            )}
          </div>
        )} */}

        <div className="ai-modal-content">{children}</div>
      </div>
    </div>,
    document.body
  );
}
