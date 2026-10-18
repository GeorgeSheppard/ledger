import type { DownloadedFile } from '../../lib/store/remote';

/** Hands a built file to the browser as a download. */
export function saveToDevice(file: DownloadedFile): void {
  const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
