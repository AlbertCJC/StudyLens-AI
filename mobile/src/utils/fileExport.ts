import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export function downloadBlobOnWeb(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(name: string): string {
  return (name || 'studylens').replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'studylens';
}

export async function saveTextFile(filename: string, content: string, mimeType: string, dialogTitle?: string): Promise<void> {
  const name = safeName(filename);
  if (Platform.OS === 'web') {
    downloadBlobOnWeb(new Blob([content], { type: mimeType }), name);
    return;
  }
  const file = new File(Paths.cache, name);
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: dialogTitle || name });
  }
}

export async function saveBytesFile(filename: string, bytes: Uint8Array, mimeType: string, dialogTitle?: string): Promise<void> {
  const name = safeName(filename);
  if (Platform.OS === 'web') {
    downloadBlobOnWeb(new Blob([bytes as unknown as BlobPart], { type: mimeType }), name);
    return;
  }
  const file = new File(Paths.cache, name);
  file.write(bytes as Uint8Array);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: dialogTitle || name });
  }
}