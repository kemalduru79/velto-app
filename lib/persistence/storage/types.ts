export type PublicObjectUploadInput = {
  bucket: string;
  path: string;
  body: Uint8Array | ArrayBuffer | Blob;
  contentType: string;
  cacheControl?: string;
  upsert?: boolean;
};

export type PublicObjectUploadResult = {
  bucket: string;
  path: string;
  publicUrl: string;
};

export type PrivateObjectUploadInput = Omit<PublicObjectUploadInput, "contentType"> & {
  contentType: "audio/mpeg";
};

export type PrivateObjectUploadResult = {
  bucket: string;
  path: string;
};

export type ObjectStorageStat = {
  bucket: string;
  path: string;
  exists: boolean;
  sizeBytes: number | null;
  contentType: string | null;
};

export type ObjectStorageRemoveInput = { bucket: string; path: string };

export type SignedPublicUploadResult = {
  bucket: string;
  path: string;
  token: string;
};

export interface ObjectStorageRepository {
  createSignedPublicUpload(input: {
    bucket: string;
    path: string;
  }): Promise<SignedPublicUploadResult>;
  downloadPublic(input: { bucket: string; path: string }): Promise<Uint8Array>;
  getPublicUrl(input: { bucket: string; path: string }): string;
  uploadPublic(
    input: PublicObjectUploadInput,
  ): Promise<PublicObjectUploadResult>;
  uploadPrivate(
    input: PrivateObjectUploadInput,
  ): Promise<PrivateObjectUploadResult>;
  stat(input: { bucket: string; path: string }): Promise<ObjectStorageStat>;
  removeObject(input: ObjectStorageRemoveInput): Promise<void>;
}
