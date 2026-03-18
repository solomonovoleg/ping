/**
 * Чтение EXIF Orientation из JPEG (1–8).
 * Ориентации 6 и 8 означают поворот на 90°/270° — в файле ширина и высота переставлены,
 * поэтому для соотношения сторон нужно использовать (height, width).
 */

export function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 12) return 1;
  if (view.getUint16(0, false) !== 0xffd8) return 1;

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      // APP1 EXIF
      const segmentLength = view.getUint16(offset, false);
      offset += 2;
      if (view.byteLength < offset + 8) return 1;
      // "Exif\0\0"
      if (view.getUint32(offset, false) !== 0x45786966) return 1;
      offset += 6;
      const tiffOffset = offset;
      const little = view.getUint16(offset, false) === 0x4949;
      offset += 2;
      // 0x002a
      if (view.getUint16(offset, little) !== 0x002a) return 1;
      offset += 2;
      const ifd0 = tiffOffset + view.getUint32(offset, little);
      offset = ifd0;
      if (view.byteLength < offset + 2) return 1;
      const numTags = view.getUint16(offset, little);
      offset += 2;
      for (let i = 0; i < numTags && offset + 12 <= view.byteLength; i++) {
        const tag = view.getUint16(offset, little);
        if (tag === 0x0112) {
          const orient = view.getUint16(offset + 8, little);
          return orient >= 1 && orient <= 8 ? orient : 1;
        }
        offset += 12;
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) break;
    if (offset + 2 > view.byteLength) break;
    offset += view.getUint16(offset, false);
  }
  return 1;
}

/** Нужно ли менять местами ширину и высоту для «логического» соотношения (ориентация 6 или 8). */
export function shouldSwapDimensionsForOrientation(orientation: number): boolean {
  return orientation === 6 || orientation === 8;
}
