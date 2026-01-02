import { Camera, Upload } from "lucide-react";
import React from "react";

const FileUploader = ({
  onFileSelected,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState();
  const fileInputRef = React.useRef(null);

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
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      await onFileSelected(file);
      clearInterval(interval);
      setProgress(100);
    } catch (err) {
      setError("Failed to upload file");
      setProgress(0);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="ai-file-uploader">
      <h1 className="ai-fu-desc">
        *It is a long established fact that a reader will be distracted{" "}
      </h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`ai-fu-dropzone${isDragging ? " ai-fu-dropzone--drag" : ""}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="ai-fu-input-hidden"
          accept={accept}
          onChange={(e) => {
            e.preventDefault();
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
        />

        <div className="ai-fu-icon-circle">
          <Upload />
        </div>

        <h3 className="ai-fu-title">Upload Your Photo</h3>

        <p className="ai-fu-note">
          Upload a clear photo of yourself to get started
        </p>

        <button type="button" className="ai-fu-btn">
          <Camera size={18} />
          <span>Choose Photo</span>
        </button>
      </div>

      <div className="ai-fu-powered">
        Powered By <span className="ai-fu-strong">AI FRAME</span>
      </div>

      {/* Optional: show error/progress hooks you already have (no functional changes) */}
      {error && <div className="ai-fu-error">{error}</div>}
      {progress > 0 && progress < 100 && (
        <div className="ai-fu-progress" aria-valuenow={progress}>
          <div className="ai-fu-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

export default FileUploader;
