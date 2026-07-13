import { NextResponse } from "next/server";
import { writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// Temporary storage for attachments before email sending
const UPLOAD_DIR = join("/tmp", ".tmp-attachments");


export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as File;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string || "0", 10);
    const totalChunks = parseInt(formData.get("totalChunks") as string || "1", 10);
    const fileName = formData.get("fileName") as string || "unknown";
    const mimeType = formData.get("mimeType") as string || "application/octet-stream";
    let fileId = formData.get("fileId") as string || "";

    if (!chunk || chunk.size === 0) {
      return NextResponse.json({ success: false, message: "No chunk provided" });
    }

    // Create upload directory if it doesn't exist
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate fileId on first chunk
    if (chunkIndex === 0) {
      const ext = fileName.split(".").pop() || "bin";
      fileId = `${randomUUID()}.${ext}`;
    }

    if (!fileId) {
      return NextResponse.json({ success: false, message: "Missing fileId for continuation chunk" });
    }

    const filePath = join(UPLOAD_DIR, fileId);
    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // First chunk: write new file. Subsequent chunks: append
    if (chunkIndex === 0) {
      await writeFile(filePath, buffer);
    } else {
      await appendFile(filePath, buffer);
    }

    // Check if upload is complete
    const isComplete = chunkIndex === totalChunks - 1;

    return NextResponse.json({
      success: true,
      fileId,
      originalName: fileName,
      mimeType,
      chunkIndex,
      totalChunks,
      isComplete,
    });
  } catch (error) {
    console.error("Error uploading attachment chunk:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message: "Upload failed: " + errorMessage });
  }
}
