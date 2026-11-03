import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type SaveOutcome = 'saved' | 'shared' | 'web' | 'canceled';

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
  return (name || 'studylens').replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'studylens';
}

async function shareCachedFile(file: File, mimeType: string, dialogTitle: string): Promise<SaveOutcome> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  }
  return 'shared';
}

async function saveViaAndroidFilePicker(
  name: string,
  mimeType: string,
  write: (destinationUri: string) => Promise<void>,
): Promise<'saved' | 'canceled'> {
  const permission = await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return 'canceled';
  const destinationUri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    name,
    mimeType,
  );
  await write(destinationUri);
  return 'saved';
}

export async function saveTextFile(filename: string, content: string, mimeType: string, dialogTitle?: string): Promise<SaveOutcome> {
  const name = safeName(filename);
  if (Platform.OS === 'web') {
    downloadBlobOnWeb(new Blob([content], { type: mimeType }), name);
    return 'web';
  }
  if (Platform.OS === 'android') {
    try {
      return await saveViaAndroidFilePicker(name, mimeType, (uri) =>
        LegacyFileSystem.writeAsStringAsync(uri, content, { encoding: LegacyFileSystem.EncodingType.UTF8 }),
      );
    } catch {
      // Directory picker unavailable or write failed — fall back to the share sheet.
    }
  }
  const file = new File(Paths.cache, name);
  file.write(content);
  return shareCachedFile(file, mimeType, dialogTitle || name);
}

export async function saveBytesFile(filename: string, bytes: Uint8Array, mimeType: string, dialogTitle?: string): Promise<SaveOutcome> {
  const name = safeName(filename);
  if (Platform.OS === 'web') {
    downloadBlobOnWeb(new Blob([bytes as unknown as BlobPart], { type: mimeType }), name);
    return 'web';
  }
  const file = new File(Paths.cache, name);
  file.write(bytes as Uint8Array);
  if (Platform.OS === 'android') {
    try {
      const base64 = await LegacyFileSystem.readAsStringAsync(file.uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
      return await saveViaAndroidFilePicker(name, mimeType, (uri) =>
        LegacyFileSystem.writeAsStringAsync(uri, base64, { encoding: LegacyFileSystem.EncodingType.Base64 }),
      );
    } catch {
      // Directory picker unavailable or write failed — fall back to the share sheet.
    }
  }
  return shareCachedFile(file, mimeType, dialogTitle || name);
}
