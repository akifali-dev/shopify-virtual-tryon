import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import multer from "multer";
// import fetch from "node-fetch";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// export const upload = multer();

export  async function storeFile(buffer, contentType, fileName) {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
}

export function removeWhiteSpaces(name) {
  return name.replace(/\s+/g, "");
}

export async function uploadFile(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file" });
    const fileName = `uploads/${Date.now()}-${removeWhiteSpaces(
      file.originalname
    )}`;
    const fileUrl = await storeFile(file.buffer, file.mimetype, fileName);
    res.json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function uploadImageHelper(file) {
  if (!file) throw new Error("No file provided");

  const fileName = `uploads/${Date.now()}-${removeWhiteSpaces(
    file.originalname
  )}`;
  const fileUrl = await storeFile(file.buffer, file.mimetype, fileName);

  return fileUrl;
}

export async function uploadFileWithUrl(req, res) {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: "No url" });
    const response = await fetch(imageUrl);
    if (!response.ok)
      return res.status(400).json({ message: "Failed to fetch image" });
    const buffer = await response.arrayBuffer();
    const fileType = response.headers.get("content-type");
    const ext = fileType.split("/")[1];
    const fileName = `ai-images/${Date.now()}.${ext}`;
    const fileUrl = await storeFile(Buffer.from(buffer), fileType, fileName);
    res.json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function uploadImageFromUrl(imageUrl, folder = "ai-images") {
  if (!imageUrl) throw new Error("Image URL is required");

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Failed to fetch image from URL");

  const buffer = await response.arrayBuffer();
  const fileType = response.headers.get("content-type");

  if (!fileType?.startsWith("image/")) {
    throw new Error("URL does not point to a valid image");
  }

  const ext = fileType.split("/")[1];
  const fileName = `${folder}/${Date.now()}.${ext}`;
  const fileUrl = await storeFile(Buffer.from(buffer), fileType, fileName);

  return fileUrl;
}

export async function uploadFileBuffer(file) {
  const fileName = `uploads/${Date.now()}-${removeWhiteSpaces(
    file.originalname
  )}`;
  return storeFile(file.buffer, file.mimetype, fileName);
}

export async function uploadUrlToS3(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Failed to fetch image");
  const buffer = await response.arrayBuffer();
  const fileType = response.headers.get("content-type");
  const ext = fileType.split("/")[1];
  const fileName = `ai-images/${Date.now()}.${ext}`;
  return storeFile(Buffer.from(buffer), fileType, fileName);
}
