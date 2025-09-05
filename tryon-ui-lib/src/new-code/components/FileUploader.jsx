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
    <div>
      <h1 className=" max-w-[300px] text-sm text-[#4B4B4B]">
        *It is a long established fact that a reader will be distracted{" "}
      </h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className=" border-[3px] mt-4 flex flex-col justify-center items-center border-dashed border-[#B4B4B4] rounded-3xl py-12"
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={accept}
          onChange={(e) => {
            e.preventDefault();
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
        />
        <div className="bg-[#D9D9D9] flex justify-center items-center text-[#84888D] size-20 rounded-full">
          <Upload />
        </div>

        <h3 className=" text-base mt-3 font-normal ">Upload Your Photo</h3>
        <p className=" text-[#4B4B4B] text-sm mt-2">
          Upload a clear photo of yourself to get started
        </p>

        <button className=" border-2 py-2 mt-5 rounded-full text-sm px-5 border-[#CBCBCB]  flex items-center gap-2">
          <Camera size={18} />
          <span>Choose Photo</span>
        </button>
      </div>

      <div className="mt-5 text-sm ">
        Powered By <span className="font-semibold">AI FRAME</span>
      </div>
    </div>
  );
};

export default FileUploader;
