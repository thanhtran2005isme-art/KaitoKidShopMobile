export type UploadImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: Blob | null;
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function isSupportedUploadImage(asset: UploadImageAsset) {
  if (!asset.mimeType) return true;
  return SUPPORTED_IMAGE_MIME_TYPES.has(asset.mimeType.toLowerCase());
}

function extensionFromMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

export function appendImageToFormData(
  formData: FormData,
  field: string,
  asset: UploadImageAsset,
  fallbackPrefix = 'kaitokid',
) {
  const mimeType = asset.mimeType || 'image/jpeg';
  const fileName =
    asset.fileName ||
    fallbackPrefix + '-' + Date.now() + '.' + extensionFromMime(mimeType);

  if (asset.file) {
    formData.append(field, asset.file, fileName);
    return;
  }

  formData.append(
    field,
    {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as any,
  );
}
