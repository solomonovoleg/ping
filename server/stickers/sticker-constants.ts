import path from "path";

export const STICKER_UPLOAD_SUBDIR = "stickers";

export const STICKER_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const STICKER_MAX_TITLE_LEN = 64;
export const STICKER_MAX_FILES_PER_REQUEST = 40;

export const STICKERS_UPLOAD_DIR = path.join(process.cwd(), "uploads", STICKER_UPLOAD_SUBDIR);
