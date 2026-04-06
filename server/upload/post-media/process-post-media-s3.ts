import path from "path";
import { randomUUID } from "crypto";
import { uploadToS3, uploadToS3WithKey } from "../s3";
import {
  transcodeStoryVideoBuffer,
  type VideoTranscodeProfile,
  type VideoTranscodeTrim,
} from "../story-video-transcode";
import {
  convertHeicBufferToJpeg,
  fixWrongHeicDeclaration,
  shouldConvertHeicToJpeg,
} from "../heic-convert";
import type { PostMediaDetectedKind, PostMediaUploadFile } from "./detect-post-media-kind";

export async function processPostMediaS3Upload(params: {
  file: PostMediaUploadFile;
  mediaKind: PostMediaDetectedKind;
  videoTrim: VideoTranscodeTrim | undefined;
  videoProfile: VideoTranscodeProfile;
}): Promise<{ url: string; posterUrl?: string }> {
  const { file, mediaKind, videoTrim, videoProfile } = params;
  let buffer: Buffer = file.buffer!;
  let ext = path.extname(file.originalname) || ".jpg";
  let contentType = file.mimetype ?? "";
  let posterBuffer: Buffer | undefined;
  let posterExt = ".jpg";
  let posterContentType = "image/jpeg";
  if (mediaKind === "video") {
    const transcoded = await transcodeStoryVideoBuffer(buffer, ext, videoTrim, videoProfile);
    buffer = transcoded.buffer;
    ext = transcoded.ext;
    contentType = transcoded.contentType;
    posterBuffer = transcoded.posterBuffer;
    posterExt = transcoded.posterExt ?? posterExt;
    posterContentType = transcoded.posterContentType ?? posterContentType;
  } else if (mediaKind === "image" && shouldConvertHeicToJpeg(contentType, file.originalname, buffer)) {
    buffer = await convertHeicBufferToJpeg(buffer);
    ext = ".jpg";
    contentType = "image/jpeg";
  }
  if (mediaKind === "image") {
    const mimeFix = fixWrongHeicDeclaration(buffer, contentType);
    if (mimeFix) {
      contentType = mimeFix.contentType;
      ext = mimeFix.ext;
    }
  }
  if (mediaKind === "video") {
    const objectBase = `posts/${randomUUID()}`;
    const videoUrl = await uploadToS3WithKey(`${objectBase}${ext}`, buffer, contentType);
    if (posterBuffer) {
      await uploadToS3WithKey(`${objectBase}${posterExt}`, posterBuffer, posterContentType);
      const posterUrl = videoUrl.replace(/\.mp4(?=\?|#|$)/i, posterExt);
      return { url: videoUrl, posterUrl };
    }
    return { url: videoUrl };
  }
  const url = await uploadToS3("posts", buffer, contentType, ext);
  return { url };
}
