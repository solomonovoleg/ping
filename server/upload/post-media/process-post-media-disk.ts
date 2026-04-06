import path from "path";
import fs from "fs";
import {
  transcodeStoryVideoFileToPath,
  type VideoTranscodeProfile,
  type VideoTranscodeTrim,
} from "../story-video-transcode";
import {
  convertHeicFileToJpegFile,
  fixWrongHeicDeclaration,
  readFileHeadBytes,
  shouldConvertHeicToJpeg,
} from "../heic-convert";
import { UPLOADS_DIR } from "./post-media-constants";
import type { PostMediaDetectedKind, PostMediaUploadFile } from "./detect-post-media-kind";

export async function processPostMediaDiskUpload(params: {
  file: PostMediaUploadFile;
  mediaKind: PostMediaDetectedKind;
  videoTrim: VideoTranscodeTrim | undefined;
  videoProfile: VideoTranscodeProfile;
}): Promise<{ diskUrl: string; posterUrl?: string; heicConversionAttempted: boolean }> {
  const { file, mediaKind, videoTrim, videoProfile } = params;
  let heicConversionAttempted = false;
  let filename = file.filename ?? "";
  let posterUrl: string | undefined;
  if (mediaKind === "video" && file.path) {
    const sourcePath = file.path;
    const transcoded = await transcodeStoryVideoFileToPath(sourcePath, UPLOADS_DIR, videoTrim, videoProfile);
    fs.unlink(sourcePath, () => {});
    filename = path.basename(transcoded.videoPath);
    if (transcoded.posterPath) {
      posterUrl = `/uploads/posts/${path.basename(transcoded.posterPath)}`;
    }
  } else if (mediaKind === "image" && file.path) {
    const head = await readFileHeadBytes(file.path, 24).catch(() => Buffer.alloc(0));
    if (shouldConvertHeicToJpeg(file.mimetype ?? "", file.originalname, head)) {
      heicConversionAttempted = true;
      const stem = path.basename(file.path, path.extname(file.path));
      const outPath = path.join(UPLOADS_DIR, `${stem}.jpg`);
      await convertHeicFileToJpegFile(file.path, outPath);
      fs.unlink(file.path, () => {});
      filename = `${stem}.jpg`;
    } else {
      const mimeFix = fixWrongHeicDeclaration(head, file.mimetype || "");
      if (mimeFix) {
        const stem = path.basename(file.path, path.extname(file.path));
        const newPath = path.join(UPLOADS_DIR, `${stem}${mimeFix.ext}`);
        if (newPath !== file.path) {
          await fs.promises.rename(file.path, newPath);
          filename = `${stem}${mimeFix.ext}`;
        }
      }
    }
  }
  return { diskUrl: `/uploads/posts/${filename}`, posterUrl, heicConversionAttempted };
}
