/* eslint-disable jsx-a11y/alt-text */
import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import {
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Download,
  Loader,
  Share2,
  Upload,
  X,
} from "lucide-react";
import TextType from "./TypeText";
import { SparkleProgressAnimation } from "./LoadingEmoji";
import { MinimizedTryOn } from "./MinimizedTryOn";

export function TryOnModal({
  onClose,
  garmentImage,
  garmentType: initialGarmentType,
  isNew,
}) {
  const fileInputRef = React.useRef(null);

  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [userPhoto, setUserPhoto] = React.useState();
  const [result, setResult] = React.useState(null); // { fileUrl, taskId, resultId }
  const [selectedFile, setSelectedFile] = React.useState(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [selectedGarmentType, setSelectedGarmentType] =
    React.useState(initialGarmentType);

  // progress typing UI
  const [progress, setProgress] = React.useState(0);
  const progressStartRef = React.useRef(null);
  const TARGET_TO_90_MS = 60000;
  const SEGMENTS = 5;
  const SEGMENT_MS = TARGET_TO_90_MS / SEGMENTS;
  const [stage, setStage] = React.useState(0);
  const pollTimerRef = React.useRef(null);
  const [selected, setSelected] = useState("top");
  const options = [
    { label: "Top", value: "top" },
    { label: "Bottom", value: "bottom" },
  ];

  const maxSize = 10 * 1024 * 1024;
  const proxyUrl = "/apps/virtual-tryon";

  const STATE_KEY = "tryonGenerating";
  const TASK_KEY = "tryon:lastTaskId";
  const MIN_FLAG = "tryon:minimized";
  const SESSION_KEY = "tryon:lastSessionId";
  const RESULT_KEY = "tryon:lastResult"; // persisted final result

  const requirements = ["Full body", "Good lighting", "Just you"];
  const loadingSentences = [
    "Taking the piece of clothing…",
    "Putting clothing on person…",
    "Checking textures…",
    "Refining image…",
    "Creating final look…",
  ];

  const pollConfirm = async (sessionId) => {
    try {
      const res = await fetch(
        `${proxyUrl}?type=confirm&sessionId=${sessionId}`,
        { method: "POST" },
      );
      const data = await res.json();

      if (data.status === "SUCCESS" && data.fileUrl) {
        const finalResult = {
          fileUrl: data.fileUrl,
          taskId: data.taskId,
          resultId: data.resultId,
          status: "SUCCESS",
        };

        setResult(finalResult);
        setIsLoading(false);
        setGlobalGenerating(false);

        // persist result so a fresh page can instantly render it
        try {
          localStorage.setItem(RESULT_KEY, JSON.stringify(finalResult));
          localStorage.removeItem(SESSION_KEY); // no longer pending
        } catch {}

        // don't auto-unminimize — let the user decide (you can remove this line)
        // setIsMinimized(false);
        return;
      }

      if (data.status === "FAILED") {
        setError("Failed to generate result. Please try again.");
        setIsLoading(false);
        setGlobalGenerating(false);
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {}
        return;
      }

      // PENDING -> poll again
      pollTimerRef.current = window.setTimeout(
        () => pollConfirm(sessionId),
        6000,
      );
    } catch {
      pollTimerRef.current = window.setTimeout(
        () => pollConfirm(sessionId),
        8000,
      );
    }
  };

  useEffect(() => {
    // Restore minimized pill state
    try {
      const flag = JSON.parse(localStorage.getItem(MIN_FLAG) || "false");
      setIsMinimized(!!flag);
    } catch {}

    // Try to instantly hydrate a finished result
    try {
      const saved = localStorage.getItem(RESULT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.fileUrl) {
          setResult(parsed);
          setIsLoading(false);
          setGlobalGenerating(false);
          return; // we're done, show the result screen
        }
      }
    } catch {}

    // If there is a pending session, go straight to LOADING and poll
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (sessionId) {
        setIsLoading(true); // <- forces loading screen, not initial
        setGlobalGenerating(true);
        pollConfirm(sessionId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  // keep minimized flag in LS
  useEffect(() => {
    try {
      localStorage.setItem(MIN_FLAG, JSON.stringify(!!isMinimized));
    } catch {}
  }, [isMinimized]);

  const setGlobalGenerating = React.useCallback((val) => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(!!val));
      window.dispatchEvent(
        new CustomEvent("tryon:state", { detail: { generating: !!val } }),
      );
    } catch {}
  }, []);

  // ------- file handlers -------
  const handleFileUpload = async (file) => {
    try {
      setError("");
      const url = URL.createObjectURL(file);
      setUserPhoto(url);
      setSelectedFile(file);
      setResult(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo";
      setError(msg);
    }
  };

  const handleFile = async (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }
    setError("");
    try {
      await handleFileUpload(file);
    } catch {
      setError("Failed to upload file");
    }
  };

  const handleDeleteUserPhoto = () => {
    setUserPhoto(null);
    setSelectedFile(null);
    setIsLoading(false);
    setSelectedGarmentType("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  // helper: minimize without resetting state
  const minimize = () => {
    setIsMinimized(true);
    setIsOpen(false);
    try {
      localStorage.setItem(MIN_FLAG, JSON.stringify(true));
    } catch {}
  };

  // When closing:
  // - if we have a result, minimize and keep TASK_KEY in LS
  // - if no result, fully reset/close
  const handleClose = () => {
    // If a generation is in-flight, minimize instead of resetting
    if (isLoading && !result?.fileUrl) {
      minimize();
      setGlobalGenerating(true); // keep global "generating" true
      onClose?.();
      return;
    }

    // If we already have a finished result, also keep the pill
    if (result?.taskId) {
      minimize();
      setGlobalGenerating(false);
      onClose?.();
      return;
    }

    // Otherwise, fully close & reset
    setIsOpen(false);
    setUserPhoto(null);
    setIsLoading(false);
    setIsSubmitting(false);
    setError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
    setGlobalGenerating(false);
    onClose?.();
  };

  const triggerUpload = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    fileInputRef.current?.click();
  };

  // ------- fetch previous result by taskId (DB) -------
  // expects server route: POST /apps/virtual-tryon?type=result&taskId=...
  // responds: { fileUrl, resultId } (and OK if found)
  const fetchPreviousResult = async (taskId) => {
    if (!taskId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${proxyUrl}?type=result&taskId=${taskId}`, {
        method: "POST",
        redirect: "manual",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch previous result");
      }
      if (!data?.fileUrl) {
        throw new Error("No image found for this task");
      }
      setResult({
        fileUrl: data.fileUrl,
        taskId: taskId,
        resultId: data.resultId || `${taskId}_1`,
        status: "SUCCESS",
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch result");
    } finally {
      setIsLoading(false);
    }
  };

  // when minimized pill is opened, restore last task and pull from DB
  const reopenFromMinimized = async () => {
    setIsMinimized(false);
    setIsOpen(true);

    // If we already have a saved result, render it immediately
    try {
      const saved = localStorage.getItem(RESULT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.fileUrl) {
          setResult(parsed);
          setIsLoading(false);
          setGlobalGenerating(false);
          return;
        }
      }
    } catch {}

    // Otherwise if still pending, show loading and poll
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId && !result?.fileUrl) {
      setIsLoading(true);
      setGlobalGenerating(true);

      try {
        const res = await fetch(
          `${proxyUrl}?type=result&sessionId=${sessionId}`,
          { method: "POST" },
        );
        if (res.ok) {
          const { fileUrl, resultId, taskId } = await res.json();
          const finalResult = { fileUrl, resultId, taskId, status: "SUCCESS" };
          setResult(finalResult);
          setIsLoading(false);
          setGlobalGenerating(false);
          localStorage.setItem(RESULT_KEY, JSON.stringify(finalResult));
          localStorage.removeItem(SESSION_KEY);
          return;
        }
      } catch {
        /* ignore */
      }

      // Keep polling if not ready
      pollConfirm(sessionId);
    }
  };

  // ------- API (single-shot) -------
  const handleGeneratePreview = async () => {
    if (!userPhoto || !selectedFile) return;

    // setGlobalGenerating(true);
    setGlobalGenerating(false); // not generating yet (only submitting)
    setStage(0);
    setProgress(0);
    // setIsLoading(true);
    setIsSubmitting(true); // <-- show button spinner
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("dressImage", garmentImage); // URL or File
    formData.append("modelImage", selectedFile); // File
    formData.append("category", selectedGarmentType);

    try {
      const res = await fetch(`${proxyUrl}?type=createSession`, {
        method: "POST",
        redirect: "manual",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");

      const { sessionId } = data;

      // Persist session so it survives navigation, but DON'T minimize.
      localStorage.setItem(SESSION_KEY, sessionId);
      setIsSubmitting(false); // stop button spinner
      setIsLoading(true); // <-- enter loading screen
      setGlobalGenerating(true);

      // Keep the modal open and show the loading UI.
      pollConfirm(sessionId);
    } catch (err) {
      console.log("Error while Generating:", err);

      setGlobalGenerating(false);
      setError(err instanceof Error ? err.message : "Failed to start session");
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  // ------- progress loop -------
  React.useEffect(() => {
    const loading = isLoading && !result?.fileUrl;
    if (loading) {
      if (!progressStartRef.current) progressStartRef.current = Date.now();
      const tick = setInterval(() => {
        const elapsed = Date.now() - progressStartRef.current;
        const pct = Math.min(90, (elapsed / TARGET_TO_90_MS) * 90);
        setProgress(pct);
        const nextStage = Math.max(
          0,
          Math.min(SEGMENTS - 1, Math.floor(elapsed / SEGMENT_MS)),
        );
        setStage(nextStage);
      }, 100);
      return () => clearInterval(tick);
    } else {
      progressStartRef.current = null;
      if (result?.fileUrl) {
        setProgress(100);
        setStage(SEGMENTS - 1);
        const t = setTimeout(() => setProgress(0), 800);
        return () => clearTimeout(t);
      }
    }
  }, [isLoading, result?.fileUrl]);

  // modal open from outside (always open fresh input modal, hide minimized pill)
  React.useEffect(() => {
    const handleOpen = (e) => {
      // ensure minimized pill disappears

      // stop any polling loop
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      setIsMinimized(false);
      setGlobalGenerating(false);
      try {
        localStorage.setItem(MIN_FLAG, JSON.stringify(false));
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(RESULT_KEY);
        localStorage.removeItem(TASK_KEY);
      } catch {}

      // open modal in a clean state
      setIsOpen(true); // we want to open fresh
      setIsMinimized(false);
      setIsLoading(false);
      setError("");
      setResult(null);
      setUserPhoto(null);
      setSelectedFile(null);
      setProgress(0);
      setStage(0);
      if (fileInputRef.current) fileInputRef.current.value = null;

      // set garment type (if provided)
      const detail = e?.detail || {};
      setSelectedGarmentType(detail.garmentType || initialGarmentType);
    };

    document.addEventListener("openTryOnModal", handleOpen);
    return () => document.removeEventListener("openTryOnModal", handleOpen);
  }, [initialGarmentType, isNew]);

  // ------- share / download -------
  const openPopup = (url, name = "share") => {
    const w = 640,
      h = 640;
    const y = window.top?.outerHeight
      ? Math.max(0, (window.top.outerHeight - h) / 2)
      : 0;
    const x = window.top?.outerWidth
      ? Math.max(0, (window.top.outerWidth - w) / 2)
      : 0;
    window.open(
      url,
      name,
      `width=${w},height=${h},left=${x},top=${y},noopener,noreferrer`,
    );
  };

  const getShareLinks = React.useCallback(() => {
    if (!result?.fileUrl) return [];
    const url = result.fileUrl;
    const encodedUrl = encodeURIComponent(url);
    const text = "Check out my virtual try-on!";
    const encodedText = encodeURIComponent(text);
    const subject = encodeURIComponent("Virtual Try-On");
    return [
      {
        key: "whatsapp",
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/4423/4423697.png",
      },
      {
        key: "telegram",
        label: "Telegram",
        href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/2111/2111646.png",
      },
      {
        key: "facebook",
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/5968/5968764.png",
      },
      {
        key: "x",
        label: "X / Twitter",
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/5968/5968958.png",
      },
      {
        key: "pinterest",
        label: "Pinterest",
        href: `https://www.pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedUrl}&description=${encodedText}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/145/145808.png",
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/3536/3536505.png",
      },
      {
        key: "reddit",
        label: "Reddit",
        href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/3670/3670226.png",
      },
      {
        key: "email",
        label: "Email",
        href: `mailto:?subject=${subject}&body=${encodedText}%0A%0A${encodedUrl}`,
        iconLink: "https://cdn-icons-png.flaticon.com/512/732/732200.png",
      },
    ];
  }, [result]);

  const handleShareClick = async (e) => {
    e?.stopPropagation?.();
    if (!result?.fileUrl) return;

    const shareData = {
      title: "Virtual Try-On",
      text: "Check out my virtual try-on!",
      url: result.fileUrl,
    };

    const supportsWebShare =
      typeof navigator !== "undefined" && "share" in navigator;
    const secure = typeof window !== "undefined" && window.isSecureContext;

    if (
      supportsWebShare &&
      secure &&
      (!navigator.canShare || navigator.canShare(shareData))
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    setShareOpen(true);
  };

  const handleShareTo = React.useCallback((href) => {
    if (/wa\.me|t\.me/.test(href)) {
      window.location.href = href;
    } else {
      openPopup(href);
    }
    setShareOpen(false);
  }, []);

  const handleDownloadActive = React.useCallback(async () => {
    if (!result?.fileUrl) return;
    const url = result.fileUrl;
    try {
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `tryon-${result.resultId ?? "1"}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [result]);

  // ------- render sections -------
  let bodyContent;
  if (!userPhoto && !result && !isLoading) {
    // initial
    bodyContent = (
      <section className="ai-initial">
        <button
          onClick={handleClose}
          className="ai-initial__mobileClose"
          aria-label="Close"
        >
          <div style={{ display: "flex", justifyContent: "center", width: 30 }}>
            <ChevronDown size={18} />
          </div>
        </button>

        <div className="ai-initial__titleWrap">
          <h1 className="ai-initial__title">
            Try <span>it on</span>
          </h1>
        </div>

        <div className="ai-initial__imgWrap">
          <img
            src="https://aiframeimages.s3.eu-north-1.amazonaws.com/uploads/1755117845063-bg-removed.jpg"
            alt="Model in red dress"
            className="ai-initial__img"
          />
        </div>

        <div className="ai-initial__reqWrap">
          <p className="ai-initial__reqTitle">Photo requirements:</p>
          <ul className="ai-initial__reqList">
            {requirements.map((req) => (
              <li key={req} className="ai-initial__reqItem">
                <CircleCheck className="ai-icon ai-icon--neutral" />
                <span className="ai-initial__reqText">{req}</span>
              </li>
            ))}
          </ul>
          <p className="ai-initial__reqPara">
            Similar outfit type: wear clothing with a similar sleeve length &
            fit to the item you want to try on for the most accurate result
          </p>
        </div>

        <div className="ai-initial__cta">
          <button onClick={triggerUpload} className="ai-initial__uploadBtn">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <g fill="none">
                <path d="m12.593 23.258-.011.002-.071.035-.02.004-.014-.004-.071-.035q-.016-.005-.024.005l-.004.01-.017.428.005.02.01.013.104.074.015.004.012-.004.104-.074.012-.016.004-.017-.017-.427q-.004-.016-.017-.018m.265-.113-.013.002-.185.093-.01.01-.003.011.018.43.005.012.008.007.201.093q.019.005.029-.008l.004-.014-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014-.034.614q.001.018.017.024l.015-.002.201-.093.01-.008.004-.011.017-.43-.003-.012-.01-.01z" />
                <path
                  fill="currentColor"
                  d="M9 2a2 2 0 0 0-2 2v2h2V4h11v11h-2v2h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
                />
              </g>
            </svg>
            Upload photo
          </button>
        </div>

        <div className="ai-initial__footer">
          <p className="ai-initial__smallNote">
            Only upload a photo of yourself. Generative AI is experimental and
            can make mistakes. See our{" "}
            <a href="https://www.aiframe.app/privacy-policy/virtual-fitting-room" id="ai-link">
              usage policy
            </a>{" "}
            for details.
          </p>
        </div>
      </section>
    );
  } else if (isLoading && !result?.fileUrl) {
    // generating (show server error inline if present)
    bodyContent = (
      <section className="ai-stage">
        <div className="ai-stage__topline">
          <div className="ai-stage__toplineInner" />
          <div
            className="ai-stage__topfill"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>

        <div className="ai-stage__bg">
          <div className="ai-stage__bgGradient" />
          <div className="ai-stage__bgGlow" />
          <button
            className="ai-stage__pillBtn ai-stage__pillBtn--cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>

        <button
          className="ai-stage__pillBtn ai-stage__pillBtn--cancel"
          onClick={minimize} // was handleClose
        >
          Minimize
        </button>

        <button
          // onClick={handleClose}
          onClick={minimize} // was handleClose
          className="ai-stage__mobileMin"
          aria-label="Close"
        >
          <ChevronDown size={18} />
        </button>

        <div className="ai-stage__center">
          <SparkleProgressAnimation
            loadingTime={50000}
            isLoading={isLoading}
            progressbar={progress}
          />
          <TextType
            key={stage}
            text={[loadingSentences[stage]]}
            typingSpeed={75}
            pauseDuration={999999}
            showCursor={true}
            cursorCharacter="_"
            loop={false}
            hideCursorWhileTyping={false}
          />
          {error ? (
            <div className="ai-prep__error" style={{ marginTop: 12 }}>
              <CircleAlert size={18} className="ai-prep__errorText" />
              <p className="ai-prep__errorText">{error}</p>
            </div>
          ) : (
            <p className="ai-stage__center_note">
              Your look is being created — this may take 1–3 minutes. Feel free
              to keep shopping while we get it ready.
            </p>
          )}
        </div>

        <div className="ai-stage__footer">
          <p className="ai-stage__footerText">
            Generative AI can make mistakes. <br /> Fit and appearance won’t be
            exact.
          </p>
        </div>
      </section>
    );
  } else if (result?.fileUrl) {
    // single result (NO slider, NO thumbs)
    bodyContent = (
      <div className="ai-results">
        <div className="ai-results__topbar">
          <button
            onClick={handleDeleteUserPhoto}
            className="ai-results__backBtnDesktop"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            aria-label="Close"
            onClick={handleClose}
            title="Try another Clothes"
            className="ai-results__closeBtnDesktop"
          >
            <X size={16} />
          </button>
        </div>

        <button
          onClick={handleClose}
          className="ai-initial__mobileClose"
          aria-label="Close"
        >
          <div style={{ display: "flex", justifyContent: "center", width: 30 }}>
            <ChevronDown size={18} />
          </div>
        </button>

        <div className="ai-results__viewer">
          <div className="ai-results__slide">
            <img
              src={result.fileUrl}
              className="ai-results__slideImg"
              alt="Virtual try-on result"
            />
          </div>

          <div className="ai-results__controls">
            <div className="ai-controls">
              <div className="ai-controls__row">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={
                    shareOpen ? () => setShareOpen(false) : handleShareClick
                  }
                  className="ai-iconBtn"
                  title="Share"
                  aria-label="Share"
                >
                  <Share2 size={16} />
                </button>

                <div className="ai-controls__divider" />

                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleDownloadActive}
                  className="ai-iconBtn"
                  title="Download image"
                  aria-label="Download image"
                >
                  <Download size={16} />
                </button>
              </div>

              {shareOpen && (
                <div
                  className="ai-shareMenu"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="ai-shareMenu__grid">
                    {getShareLinks().map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handleShareTo(p.href)}
                        className="ai-shareMenu__item"
                        title={p.label}
                        aria-label={p.label}
                      >
                        <img
                          src={p.iconLink}
                          alt={p.label}
                          className="ai-shareMenu__icon"
                        />
                        <p className="ai-shareMenu__label">{p.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <h4 className="ai-results__headline">
          <span className="ai-text-black">AI</span> Generated Result
        </h4>
      </div>
    );
  } else {
    // prep (user photo selected, not yet generating)
    bodyContent = (
      <div className="ai-prep">
        <div className="ai-prep__topbar">
          <button
            onClick={handleDeleteUserPhoto}
            className="ai-prep__backBtn"
            aria-label="Back"
          >
            <ArrowLeft />
          </button>

          <button
            className="ai-prep__uploadBtn"
            onClick={triggerUpload}
            aria-label="Upload another photo"
          >
            <Upload size={15} />
          </button>
        </div>

        <div className="ai-prep__viewer">
          {error && (
            <div className="ai-prep__error">
              <CircleAlert size={30} className="ai-prep__errorText" />
              <p className="ai-prep__errorText">{error}</p>
            </div>
          )}
          <img src={userPhoto} className="ai-prep__img" alt="Uploaded user" />
        </div>

        <div className="ai-prep__hintWrap">
          <p className="ai-prep__hintText">
            {selected === "top"
              ? "Use a photo with similar neckline & sleeve length."
              : "Choose a photo with legs visible & similar waist/length."}
          </p>

          <div className="ai-prep__options">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelected(option.value)}
                className={`ai-optionBtn ${selected === option.value ? "ai-optionBtn--active" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-prep__cta">
          <button
            // disabled={isLoading}
            disabled={isSubmitting}
            onClick={handleGeneratePreview}
            className="ai-prep__primaryBtn"
          >
            {isSubmitting ? (
              <Loader className="ai-spin ai-size-5" />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#e5e5e5"
                  d="m19 1-1.26 2.75L15 5l2.74 1.26L19 9l1.25-2.74L23 5l-2.75-1.25M9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5M19 15l-1.26 2.74L15 19l2.74 1.25L19 23l1.25-2.75L23 19l-2.75-1.26"
                />
              </svg>
            )}
            Try On Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Minimized pill */}
      {isMinimized && (
        <MinimizedTryOn
          anySuccess={!!result?.fileUrl}
          stageText={isLoading ? loadingSentences[stage] : "Tap to open"}
          onClickOpen={reopenFromMinimized}
          onClose={() => {
            // stop any polling loop
            if (pollTimerRef.current) {
              window.clearTimeout(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            // fully dismiss minimized state and forget last task
            setIsMinimized(false);
            setGlobalGenerating(false);
            try {
              localStorage.removeItem(TASK_KEY);
              localStorage.setItem(MIN_FLAG, JSON.stringify(false));
              localStorage.removeItem(SESSION_KEY);
              localStorage.removeItem(RESULT_KEY);
            } catch {}
            // also clear in-memory UI state
            setIsOpen(false);
            setResult(null);
            setUserPhoto(null);
            setSelectedFile(null);
            setIsLoading(false);
            setError("");
            setProgress(0);
            setStage(0);
            if (fileInputRef.current) fileInputRef.current.value = null;
          }}
        />
      )}

      <Modal
        isOpen={isOpen}
        // onClose={isLoading ? handleClose : handleClose}
        onClose={handleClose}
        className={``}
      >
        <input
          id="user-photo-input"
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onClick={(e) => {
            e.currentTarget.value = "";
          }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setIsLoading(false);
              setError("");
              handleFile(file);
            }
          }}
        />
        {bodyContent}
      </Modal>

      <style jsx>{`
        .ai-minimized {
          position: fixed;
          right: 16px;
          bottom: 16px;
          padding: 10px 14px;
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          background: white;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          z-index: 9999;
        }
        .ai-dot-success {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #10b981;
          display: inline-block;
        }
      `}</style>
    </>
  );
}
