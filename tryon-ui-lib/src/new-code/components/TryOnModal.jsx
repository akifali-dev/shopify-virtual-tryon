/* eslint-disable jsx-a11y/alt-text */
import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  Loader,
  Loader2,
  LoaderCircle,
  RefreshCcw,
  Share2,
  Upload,
  X,
} from "lucide-react";
import TextType from "./TypeText";
import { SparkleProgressAnimation } from "./LoadingEmoji";
import { MinimizedTryOn } from "./MinimizedTryOn";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

export function TryOnModal({
  onClose,
  garmentImage,
  // garmentName,
  garmentType: initialGarmentType,
  isNew,
}) {
  const swiperRef = React.useRef(null);
  // console.log("Element Trigred...");
  const fileInputRef = React.useRef(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // const [isOpen, setIsOpen] = React.useState(false);
  const [userPhoto, setUserPhoto] = React.useState();
  const [previewImage, setPreviewImage] = React.useState("");
  const [previewImageId, setPreviewImageId] = React.useState(null);
  const [generatedResults, setGeneratedResults] = React.useState([]);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCanceled, setIsCanceled] = React.useState(false);
  const [error, setError] = React.useState("");
  const [taskId, setTaskId] = React.useState(null);
  const [selectedGarmentType, setSelectedGarmentType] =
    React.useState(initialGarmentType);
  const [progress, setProgress] = React.useState(0);
  const progressStartRef = React.useRef(null);
  const TARGET_TO_90_MS = 50000; // 40 seconds to reach 90%
  const SEGMENTS = 5; // split into 5 chunks
  const SEGMENT_MS = TARGET_TO_90_MS / SEGMENTS; // 10000ms per chunk

  const [stage, setStage] = React.useState(0); // which sentence (0..4)
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [anySuccess, setAnySuccess] = React.useState(false);
  const [anyRunning, setAnyRunning] = React.useState(false);

  // index of the currently previewed SUCCESS image
  const [currentIdx, setCurrentIdx] = React.useState(0);

  const [selected, setSelected] = useState("top");

  const options = [
    { label: "Top", value: "top" },
    { label: "Bottom", value: "bottom" },
    // { label: "One Piece", value: "one-piece" },
  ];

  const TASKS_KEY = "tryonTaskIds";
  const MINIMIZED_KEY = "tryonMinimized";
  const [refetch, setRefetch] = useState(false);
  const [isMinimized, setIsMinimized] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(MINIMIZED_KEY) || "false");
    } catch {
      return false;
    }
  });

  const taskqueData = localStorage.getItem(TASKS_KEY) || "";

  const pollTimeout = React.useRef();
  let maxSize = 10 * 1024 * 1024;
  const proxyUrl = "/apps/virtual-tryon";

  const isGenerating = !anySuccess && (isLoading || anyRunning);

  // ========================================= All Constants ===============================================

  const requirements = [
    "Full body",
    "Good lighting",
    "Just you",
    "No hands in pockets",
    "Fitted clothes",
  ];

  const loadingSentences = [
    "Taking the piece of clothing…",
    "Putting clothing on person…",
    "Checking textures…",
    "Refining image…",
    "Creating final look…",
  ];

  const STATE_KEY = "tryonGenerating";

  // ============================================= Helper Functions =============================================

  // helper
  const setGlobalGenerating = React.useCallback((val) => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(!!val));
      window.dispatchEvent(
        new CustomEvent("tryon:state", { detail: { generating: !!val } }),
      );
    } catch {}
  }, []);

  const checkTask = async () => {
    try {
      // console.log("Called checkTask", taskId);
      if (!taskId) return;
      const res = await fetch(`${proxyUrl}?type=confirm&taskId=${taskId}`, {
        method: "POST",
        redirect: "manual",
      });
      const data = await res.json();
      const list = data.resultList || [];
      const allDone = list.every((r) =>
        ["SUCCESS", "FAILED"].includes(statusOf(r)),
      );
      if (!allDone) {
        setTimeout(() => checkTask(taskId), 6000);
      }
    } catch (e) {
      // console.error("Failed to check task", e);
    }
  };

  const pollStatus = async () => {
    try {
      // console.log("Called Pool Status", taskId);
      if (!taskId) return;
      if (!isCanceled) {
        const res = await fetch(`${proxyUrl}?type=confirm&taskId=${taskId}`, {
          method: "POST",
          redirect: "manual",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to check status");
        }
        const list = data.resultList || [];
        const isCurrectTask = setGeneratedResults(list);
        // const firstSuccess = list.find((r) => r.status === "SUCCESS");
        const firstSuccess = list.find(isSuccess);
        if (firstSuccess) {
          setAnySuccess(true);
          setPreviewImage((prev) => prev || firstSuccess.fileUrl);
          setProgress(100);
          setIsLoading(false);
        }
        const allDone = list.every(
          (r) => r.status === "SUCCESS" || r.status === "FAILED",
        );
        if (!allDone) {
          pollTimeout.current = setTimeout(() => pollStatus(taskId), 6000);
        } else {
          const allFailed =
            list.length > 0 && list.every((r) => statusOf(r) === "FAILED");

          if (allFailed) {
            setError("Failed to generate results please try again.");

            // reset back to the previous screen (photo preview + Try button)
            setAnySuccess(false);
            setAnyRunning(false);
            setIsLoading(false);
            setTaskId(null);
            localStorage.setItem(TASKS_KEY, "");
            setGeneratedResults([]);
            setPreviewImage(null);
            setPreviewImageId(null);
            setCurrentIdx(0);
          }

          // if (data.refunded) {
          //   setError("Failed to generate results");
          // }
          setProgress(100);
          // setIsLoading(false);
          setGlobalGenerating(false); // <— finished
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to check status";
      setError(msg);
      setProgress(100);
      setIsLoading(false);
    }
  };

  const statusOf = (r) => (r?.status || "").toUpperCase();

  const isRunning = (r) =>
    ["CREATED", "RUNNING", "PENDING"].includes(statusOf(r));
  const isSuccess = (r) => statusOf(r) === "SUCCESS" && !!r?.fileUrl;

  const handleFileUpload = async (file) => {
    try {
      setError(undefined);
      const url = URL.createObjectURL(file);
      setUserPhoto(url);
      setSelectedFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo";
      setError(msg);
    }
  };

  const handleDeleteUserPhoto = () => {
    setUserPhoto(null);
    setSelectedFile(null);
    setIsLoading(false);
    setSelectedGarmentType("");
    setGeneratedResults([]);
    localStorage.setItem(TASKS_KEY, "");
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
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

    setError(undefined);
    try {
      await handleFileUpload(file);
    } catch (err) {
      setError("Failed to upload file");
    }
  };

  const handleClose = () => {
    setIsMinimized(false);
    setIsOpen(false);
    setUserPhoto(null);
    setCurrentIdx(0);
    setStage(0);
    setSelected("top");
    setIsLoading(false);
    setError(null);
    setIsCanceled(true);
    // setTaskId(null);
    // localStorage.setItem(TASKS_KEY, "");
    if (fileInputRef.current) fileInputRef.current.value = null;
    if (pollTimeout.current) clearTimeout(pollTimeout.current);
    setGlobalGenerating(false); // <— ensure button re-enables on close
    onClose?.();
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setIsOpen(false);
  };

  const handleGeneratePreview = async () => {
    if (!userPhoto || !selectedFile) {
      return;
    }

    setGlobalGenerating(true); // <— immediately disable the button outside
    const formData = new FormData();
    formData.append("dressImage", garmentImage);
    formData.append("modelImage", selectedFile);
    formData.append("category", selectedGarmentType);

    try {
      progressStartRef.current = Date.now();
      setStage(0);
      setProgress(0);
      setIsLoading(true);
      setError(null);
      setPreviewImage(null);
      setGeneratedResults([]);

      const res = await fetch(`${proxyUrl}?type=create`, {
        method: "POST",
        redirect: "manual",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to generate preview",
        );
      }

      // console.log("Data", data);
      setIsCanceled(false);
      setTaskId(data.taskId);
      setGeneratedResults(data.resultList || []);
      const updated = data.taskId;
      localStorage.setItem(TASKS_KEY, updated);
      setRefetch((prev) => !prev);
      // setIsMinimized(true);
      // setIsOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate preview";
      setGlobalGenerating(false); // <— on failure
      setError(msg);
      setIsLoading(false);
      // toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  // Only SUCCESS images (with a fileUrl) are navigable
  const successList = React.useMemo(
    () =>
      Array.isArray(generatedResults) ? generatedResults.filter(isSuccess) : [],
    [generatedResults],
  );

  const handlePreviewImage = React.useCallback(
    (img) => {
      setPreviewImage(img?.fileUrl);
      setPreviewImageId(img?.id);

      const i = successList.findIndex((x) => x.id === img?.id);
      if (i >= 0) {
        setCurrentIdx(i);
        swiperRef.current?.slideTo(i);
      }
    },
    [successList],
  );

  const syncToIndex = React.useCallback(
    (i) => {
      setCurrentIdx(i);
      const active = successList[i];

      if (active) {
        setPreviewImageId(active.id);
        setPreviewImage(active.fileUrl);
      }
    },
    [successList],
  );

  const handlePrev = React.useCallback(() => {
    if (successList.length <= 1) return;
    // console.log("handlePrev clicked....");
    const nextIdx = (currentIdx - 1 + successList.length) % successList.length;
    const next = successList[nextIdx];
    setCurrentIdx(nextIdx);
    setPreviewImage(next.fileUrl);
    setPreviewImageId(next.id);
  }, [successList, currentIdx]);

  const handleNext = React.useCallback(() => {
    if (successList.length <= 1) return;
    // console.log("handleNext clicked....");
    const nextIdx = (currentIdx + 1) % successList.length;
    const next = successList[nextIdx];
    setCurrentIdx(nextIdx);
    setPreviewImage(next.fileUrl);
    setPreviewImageId(next.id);
  }, [successList, currentIdx]);

  const triggerUpload = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    fileInputRef.current?.click();
  };

  const getActiveImage = React.useCallback(() => {
    if (!Array.isArray(successList) || !successList.length) return null;
    if (previewImageId) {
      return (
        successList.find((x) => x.id === previewImageId) ??
        successList[currentIdx]
      );
    }
    return successList[currentIdx];
  }, [successList, previewImageId, currentIdx]);

  const handleCopyActiveUrl = React.useCallback(async () => {
    const active = getActiveImage();
    if (!active?.fileUrl) return;
    try {
      // await navigator.clipboard.writeText(active.fileUrl);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(active.fileUrl);
      } else {
        // Fallback: create a temporary input
        const el = document.createElement("input");
        el.value = active.fileUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    } catch (e) {
      // console.error("Copy failed:", e);
    }
  }, [getActiveImage]);

  const handleDownloadActive = React.useCallback(async () => {
    const active = getActiveImage();
    if (!active?.fileUrl) return;
    const url = active.fileUrl;
    try {
      // Try fetching to ensure 'download' works reliably with CORS; fallback to open.
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `tryon-${active.id ?? currentIdx}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      // console.warn("Fetch download failed, opening in new tab:", e);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [getActiveImage, currentIdx]);

  // small centered popup (desktop)
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
    const active = getActiveImage();
    if (!active?.fileUrl) return [];

    const url = active.fileUrl;
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
  }, [getActiveImage]);

  // remove handleNativeShare and add this:
  const handleShareClick = async (e) => {
    e?.stopPropagation?.();

    const active = getActiveImage();
    if (!active?.fileUrl) return;

    const shareData = {
      title: "Virtual Try-On",
      text: "Check out my virtual try-on!",
      url: active.fileUrl,
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
        // success or user completed share – stop here (no popup)
        return;
      } catch (err) {
        // If the user cancels, do nothing (don’t open fallback)
        if (err?.name === "AbortError") return;
        // Otherwise fall through to fallback
      }
    }

    // Fallback (no Web Share, insecure context, or non-abort error)
    setShareOpen(true);
  };

  const handleShareTo = React.useCallback((href) => {
    // mobile deep links (WhatsApp/Telegram) should open in the same tab
    if (/wa\.me|t\.me/.test(href)) {
      window.location.href = href;
    } else {
      openPopup(href);
    }
    setShareOpen(false);
  }, []);

  //  ======================================= ALL  useEffects ===============================================

  useEffect(() => {
    checkTask();
    pollStatus();
  }, [taskId]);

  React.useEffect(() => {
    localStorage.setItem(MINIMIZED_KEY, JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    // console.log("LocalStorage Task", taskqueData);
    if (taskqueData) {
      setTaskId(taskqueData);
      pollStatus();
      checkTask();
    }
  }, [refetch, taskqueData]);

  React.useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== currentIdx) {
      swiperRef.current.slideTo(currentIdx, 0);
    }
  }, [currentIdx]);

  // make sure initial preview indexes are set once results arrive
  React.useEffect(() => {
    if (!previewImageId && successList.length) {
      setPreviewImage(successList[0].fileUrl);
      setPreviewImageId(successList[0].id);
      setCurrentIdx(0);
    }
  }, [successList, previewImageId]);

  useEffect(() => {
    const hasList =
      Array.isArray(generatedResults) && generatedResults.length > 0;
    const anySuccess = hasList && generatedResults.some(isSuccess);
    const anyRunning = hasList && generatedResults.some(isRunning);
    setAnySuccess(anySuccess);
    setAnyRunning(anyRunning);
  }, [
    generatedResults?.[0]?.status,
    generatedResults?.[1]?.status,
    generatedResults?.[2]?.status,
    generatedResults?.[3]?.status,
  ]);

  React.useEffect(() => {
    if (!successList.length) return;

    // If current preview doesn't match a success item, snap to the first
    const byId = successList.findIndex((r) => r.id === previewImageId);
    if (byId >= 0) {
      setCurrentIdx(byId);
      return;
    }

    const byUrl = successList.findIndex((r) => r.fileUrl === previewImage);
    if (byUrl >= 0) {
      setCurrentIdx(byUrl);
      setPreviewImageId(successList[byUrl].id);
      return;
    }

    // default to first success
    setCurrentIdx(0);
    setPreviewImage(successList[0].fileUrl);
    setPreviewImageId(successList[0].id);
  }, [successList, previewImage, previewImageId]);

  // listen for the open event
  React.useEffect(() => {
    const handleOpen = (e) => {
      console.log("Open triggered.....");
      localStorage.setItem(TASKS_KEY, "");
      setTaskId(null);
      setIsOpen(true);
      setGeneratedResults([]);
      setError(undefined);
      setIsCanceled(true);
      const detail = e?.detail || {};
      setSelectedGarmentType(detail.garmentType || initialGarmentType);
    };

    document.addEventListener("openTryOnModal", handleOpen);
    return () => document.removeEventListener("openTryOnModal", handleOpen);
  }, [initialGarmentType, isNew]);

  // PROGRESS INTERVAL USEEFFECT
  React.useEffect(() => {
    const loading = !anySuccess && (isLoading || anyRunning);
    if (loading) {
      if (!progressStartRef.current) progressStartRef.current = Date.now();

      const tick = setInterval(() => {
        const elapsed = Date.now() - progressStartRef.current;

        // progress: 0→90 over 50s (your existing logic)
        const pct = Math.min(90, (elapsed / TARGET_TO_90_MS) * 90);
        setProgress(pct);

        // NEW: stage 0..4, updates every 10s (10000ms)
        const nextStage = Math.max(
          0,
          Math.min(SEGMENTS - 1, Math.floor(elapsed / SEGMENT_MS)),
        );
        setStage(nextStage);
      }, 100);

      return () => clearInterval(tick);
    } else {
      // done: snap to 100 and gently reset
      progressStartRef.current = null;
      setProgress(100);
      setStage(SEGMENTS - 1); // show the last sentence when finishing
      const t = setTimeout(() => setProgress(0), 800);
      return () => clearTimeout(t);
    }
  }, [isLoading, anyRunning, anySuccess, SEGMENT_MS]);

  React.useEffect(() => {
    setGlobalGenerating(isGenerating);
  }, [isGenerating, setGlobalGenerating]);

  // ======================================= NEW BODY CONTENT WITH MOBILE SCREENS =======================================

  let bodyContent;
  if (!userPhoto && !taskId) {
    // 1️⃣ INITIAL: show sample model + upload button
    bodyContent = (
      <section className="w-full flex flex-col items-center relative md:p-5">
        <button
          onClick={handleClose}
          className="absolute top-3 left-3 md:right-3 text-netral-600 bg-white rounded-full p-1.5 block md:hidden"
          aria-label="Close"
        >
          <ChevronDown size={18} />
        </button>

        <div className="mt-6 md:mt-0 text-center leading-[0.95]">
          <h1 className="text-[50px] md:text-[55px] space-x-2 !font-black !font-inter !tracking-tight !text-black">
            Try
            <span className="block md:inline md:ml-2">it on</span>
          </h1>
        </div>

        <div className="relative  w-full max-w-[520px] md:!h-72  ">
          <img
            src="https://aiframeimages.s3.eu-north-1.amazonaws.com/uploads/1755117845063-bg-removed.jpg"
            alt="Model in red dress"
            className=" !h-[calc(100vh-450px)] md:!h-72   !w-auto !mx-auto !object-contain mix-blend-multiply"
          />
        </div>
        {/* images  */}
        <div className="mt-1 w-full flex flex-col items-center">
          <p className="!text-black  text-xl font-bold">Photo requirements:</p>

          <ul className=" flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs sm:text-sm !text-black">
            {requirements.map((req) => (
              <li key={req} className="flex items-center gap-2">
                <CircleCheck className="size-4 text-neutral-700" />
                <span className="font-medium text-neutral-700">{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-3 w-full">
          <button
            onClick={triggerUpload}
            className="flex items-center justify-center gap-2 px-8 sm:px-12 py-2.5 rounded-full bg-black text-neutral-200 text-sm sm:text-base font-medium hover:opacity-90 w-9/12 mx-auto active:opacity-85 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
            >
              <g fill="none" fill-rule="evenodd">
                <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
                <path
                  fill="currentColor"
                  d="M9 2a2 2 0 0 0-2 2v2h2V4h11v11h-2v2h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
                />
              </g>
            </svg>
            Upload photo
          </button>
        </div>

        {/* Footer */}
        <div className="mt-2 flex flex-col items-center px-5 pb-5">
          <p className="text-xs text-neutral-500 text-center max-w-[520px]">
            Only upload a photo of yourself. Generative AI is experimental and
            can make mistakes. See our
            <a
              href="https://aiframe-v2.vercel.app/privacy-policy"
              className="underline font-medium"
            >
              usage policy
            </a>
            for details.
          </p>
        </div>
      </section>
    );
  } else if (!anySuccess && (isLoading || anyRunning || !!taskId)) {
    bodyContent = (
      <section className="relative w-full h-dvh md:!h-[600px]  mx-auto overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-transparent overflow-hidden z-50">
          <div className="absolute inset-0 bg-transparent" />
          <div
            className="h-full"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background:
                "linear-gradient(90deg,#FFD6A1 0%, #FFB668 50%, #FF8A1D 100%)",
              boxShadow: "0 0 10px rgba(255,138,29,0.35)",
            }}
          />
        </div>

        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#F7F8FA] via-white to-white" />
          <div
            className="absolute -top-14 left-1/2 -translate-x-1/2 w-[420px] h-[240px] rounded-full bg-soft-glow opacity-90"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, rgba(255,206,150,0.35) 0%, rgba(255,180,110,0.20) 40%, rgba(255,255,255,0) 70%)",
            }}
          />
          <button
            className="absolute top-5  md:!block  !hidden right-5 z-30 border font-semibold rounded-full border-gray-400 !text-gray-800 px-4 py-2 text-[13px] leading-none"
            onClick={handleMinimize}
          >
            Minimize
          </button>

          {/* <button
            className="absolute top-5 right-5 z-30 b text-sm leading-none"
             onClick={handleClose}
          >
            <X size={18} />
          </button> */}

          <button
            className="absolute top-5 w-fit !right-5 md:!left-5 z-30 border font-semibold rounded-full border-gray-400 !text-gray-800 px-4 py-2 text-[13px] leading-none"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>

        <button
          onClick={handleMinimize}
          className="absolute top-5 left-3 md:right-3 text-netral-600 bg-white rounded-full p-1.5 block md:hidden z-50"
          aria-label="Close"
        >
          <ChevronDown size={18} />
        </button>

        <div className="relative h-full flex flex-col items-center justify-center px-8 gap-4">
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
        </div>

        <div className="absolute bottom-2 left-0 right-0 px-5 w- mx-auto pb-5">
          <p className="text-[11px] text-center text-[#9aa0a6] leading-tight">
            Generative AI can make mistakes. <br /> Fit and appearance won’t be
            exact.
          </p>
        </div>
      </section>
    );
  } else if (anySuccess) {
    // 3️⃣ RESULTS: show generated preview + controls
    bodyContent = (
      <div className="flex flex-col gap-0 size-full">
        <div className="hidden md:!flex !items-center justify-between h-14 w-full z-20 px-5 mt-5 md:mt-0">
          {/* button to generate other images */}
          <button
            onClick={handleDeleteUserPhoto}
            className="self-start h-fit w-fit z-50 !text-black !hidden md:!flex !mt-4"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            aria-label="Close"
            onClick={handleClose}
            title="Try another Clothes"
            className="bg-[#D5D5D5]/40 backdrop-blur-md text-[#737373] rounded-full p-1.5 !hidden md:!flex"
          >
            <X size={16} className="!text-black" />
          </button>
        </div>
        <button
          aria-label="Close"
          onClick={handleClose}
          className="absolute top-3 left-3 !text-black bg-white rounded-full p-1.5 !block md:!hidden z-50"
        >
          <ChevronDown size={18} />
        </button>

        <div className="h-[calc(100dvh-180px)] md:!h-[300px] 2xl:!h-[400px] w-full bg-neutral-100/70 relative overflow-hidden">
          <Swiper
            slidesPerView={1}
            speed={300}
            resistanceRatio={0.65}
            initialSlide={currentIdx}
            onSwiper={(sw) => (swiperRef.current = sw)}
            onSlideChange={(sw) => syncToIndex(sw.activeIndex)}
            preventClicks={false}
            preventClicksPropagation={false}
            className="h-full"
          >
            {successList?.map((img, idx) => (
              <SwiperSlide key={img.id ?? idx} className="h-full">
                <div className="basis-full shrink-0 grow-0 h-full flex items-center justify-center">
                  <img
                    src={img.fileUrl}
                    className="w-full h-full object-contain"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Prev / Next buttons */}
          <button
            className="bg-[#D5D5D5]/40 backdrop-blur-md text-[#737373] !z-50 absolute p-1.5 top-[50%] left-4 rounded-full"
            onClick={() => swiperRef.current?.slidePrev()}
            disabled={successList?.length < 2}
            aria-label="Previous result"
          >
            <ChevronLeft size={17} />
          </button>

          <button
            className="bg-[#D5D5D5]/40 backdrop-blur-md text-[#737373] !z-50 absolute p-1.5 top-[50%] right-4 rounded-full"
            onClick={() => swiperRef.current?.slideNext()}
            disabled={successList?.length < 2}
            aria-label="Next result"
          >
            <ChevronRight size={17} />
          </button>

          {/* Counter */}
          <button className="absolute right-3 text-[#737373] px-3 text-xs py-1.5 top-3 h-fit w-fit bg-[#D5D5D5]/30 rounded-full p-0.5 z-50">
            {successList?.length
              ? `${currentIdx + 1} / ${successList?.length}`
              : `0 / 0`}
          </button>

          {/* Controls overlay (share / download) */}
          <div className="absolute bottom-3 right-3 z-[100] pointer-events-auto">
            <div
              className="relative rounded-full shadow-md border border-black/5 backdrop-blur-lg"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(246,246,246,0.78) 100%)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center gap-1.5 px-1.5 py-1.5">
                {/* Share */}
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  // onClick={
                  //   shareOpen ? () => setShareOpen(false) : handleNativeShare
                  // }

                  onClick={
                    shareOpen ? () => setShareOpen(false) : handleShareClick
                  }
                  className="p-1.5 rounded-full hover:bg-black/5 active:bg-black/10 transition"
                  title="Share"
                  aria-label="Share"
                >
                  <Share2 size={16} />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-black/10" />

                {/* Download */}
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleDownloadActive}
                  className="p-1.5 rounded-full hover:bg-black/5 active:bg-black/10 transition"
                  title="Download image"
                  aria-label="Download image"
                >
                  <Download size={16} />
                </button>
              </div>

              {/* Share menu (fallback for devices without Web Share API) */}
              {shareOpen && (
                <div
                  className="absolute right-0 bottom-12 z-[110] w-[240px] md:!w-[350px] rounded-xl border border-black/5 bg-white backdrop-blur-md shadow-lg p-2"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="!grid !grid-cols-3 md:!grid-cols-4 gap-2">
                    {getShareLinks().map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handleShareTo(p.href)}
                        className="  p-2 flex border border-gray-200 hover:bg-gray-100 rounded-md justify-center w-full items-center flex-col   hover:bg-black/5 active:bg-black/10 truncate"
                      >
                        <img
                          src={p.iconLink}
                          alt={p.label}
                          className="  !h-6 md:!h-8  w-auto "
                        />
                        <p className="  text-[10px]  md:text-[11px]  text-gray-500 font-semibold">
                          {p.label}
                        </p>{" "}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <h4 className="text-sm mt-4 font-semibold text-[#868686] px-4">
          <span className="!text-black">AI</span> Generated Results
        </h4>

        <div className="my-4 !grid !grid-cols-4 gap-1 sm:gap-2 w-full px-4 !h-20 sm:!h-fit">
          {generatedResults.map((img, idx) => {
            const running = isRunning(img);
            const success = isSuccess(img);
            const isActive = previewImageId === img?.id;

            return (
              <div
                key={img?.id ?? idx}
                className={`relative rounded-lg !overflow-hidden cursor-pointer !border-2 size-full sm:size-auto ${isActive ? " !border-black !p-0.5" : " !border-transparent !p-0.5"}`}
                onClick={() => success && handlePreviewImage(img)}
              >
                <img
                  src={success ? img.fileUrl : userPhoto}
                  className="max-h-32 !h-24 sm:!min-h-32  w-full object-cover rounded-lg"
                />
                {running && (
                  <div className="absolute inset-0 bg-white/40 rounded-md backdrop-blur-sm flex justify-center items-center">
                    <LoaderCircle className="animate-spin !text-black" />
                  </div>
                )}
                {!running && !success && (
                  <div className="absolute bottom-1 right-1 text-[10px] px-2 py-0.5 bg-red-600 text-white rounded">
                    Failed
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* <div
          className="block md:!hidden w-full mb-2"
          onClick={handleDeleteUserPhoto}
        >
          <button className="rounded-full bg-black hover:bg-opacity-90 text-neutral-200 w-11/12 mx-auto px-6 gap-2 flex justify-center items-center py-2.5 mt-3 !text-sm ">
            <RefreshCcw size={15} /> Generate New Results
          </button>
        </div> */}
      </div>
    );
  } else {
    bodyContent = (
      <div className="flex flex-col gap-5  bg-[#EDEFF2] md:bg-white">
        <div className=" flex justify-between items-center  mt-3 md:mt-5 px-4">
          <button
            onClick={handleDeleteUserPhoto}
            className="self-start h-fit w-fit z-50 !text-black"
          >
            <ArrowLeft />
          </button>

          <button
            className="w-fit px-4 gap-2 flex justify-center items-center py-2.5 mt-3 rounded-md text-sm bg-neutral-200/80 text-neutral-600 hover:bg-neutral-200"
            onClick={triggerUpload}
          >
            <Upload size={15} />
          </button>
        </div>
        <div className="relative flex justify-center items-center h-[calc(100dvh-250px)] md:!h-[330px]  2xl:h-[480px] w-screen md:w-full bg-neutral-100/70 backdrop-blur-sm">
          {error && (
            <div className="absolute flex flex-col gap-2 justify-center items-center h-full w-screen md:w-full object-contain bg-white/90">
              <CircleAlert size={30} className="text-red-700" />
              <p className="text-red-700">{error}</p>
            </div>
          )}
          <img
            src={userPhoto}
            className="h-full w-screen md:w-full object-contain"
          />
        </div>
        <div className="flex flex-col !items-center !justify-center md:items-start gap-3 mt-3 px-5 w-full">
          <p className="text-xs text-neutral-700 font-medium !text-center ">
            {selected === "top"
              ? "Use a photo with similar neckline & sleeve length."
              : "Choose a photo with legs visible & similar waist/length."}
          </p>
          <div className="flex justify-center gap-2 w-full mx-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelected(option.value)}
                className={`px-6 py-1 rounded-lg text-[13px] transition-colors duration-200 ${
                  selected === option.value
                    ? "bg-black text-neutral-200"
                    : "bg-neutral-200/80 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 w-full mb-5">
          <button
            disabled={isLoading}
            onClick={handleGeneratePreview}
            className={`flex items-center justify-center gap-2 px-8 sm:px-12 py-2.5 rounded-full bg-black text-neutral-200 text-sm sm:text-base font-medium hover:opacity-90 w-full active:opacity-85 transition ${isLoading && "opacity-80"}`}
          >
            {isLoading ? (
              <Loader className="animate-spin size-5" />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="#e5e5e5"
                  d="m19 1l-1.26 2.75L15 5l2.74 1.26L19 9l1.25-2.74L23 5l-2.75-1.25M9 4L6.5 9.5L1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5M19 15l-1.26 2.74L15 19l2.74 1.25L19 23l1.25-2.75L23 19l-2.75-1.26"
                />
              </svg>
            )}
            Try On Now
          </button>
        </div>
      </div>
    );
  }

  // console.log("TaskId", taskId);
  // console.log("isSuccess", anySuccess);
  // console.log("Generated Tasks", generatedResults);

  // ========================================= Component's Return ============================================

  return (
    <>
      {taskId && (
        <MinimizedTryOn
          anySuccess={anySuccess}
          stageText={loadingSentences[stage]}
          onClickOpen={() => {
            setIsMinimized(false);
            setIsOpen(true);
          }}
          onClose={() => {
            setIsMinimized(false);
            setTaskId(null);
            localStorage.setItem(TASKS_KEY, "");
            handleClose();
          }}
        />
      )}

      <Modal
        isOpen={isOpen}
        onClose={isGenerating ? handleMinimize : handleClose}
        onMinimize={handleMinimize}
        className={``}
      >
        <input
          id="user-photo-input"
          type="file"
          ref={fileInputRef}
          className="sr-only" // NOT 'hidden'
          accept="image/*"
          onClick={(e) => {
            // allow re-selecting the same file
            e.currentTarget.value = "";
          }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // fresh state for a new upload
              setGeneratedResults([]);
              setPreviewImage("");
              setPreviewImageId(null);
              setCurrentIdx(0);
              setIsLoading(false);
              handleFile(file);
            }
          }}
        />
        {bodyContent}
      </Modal>
    </>
  );
}
