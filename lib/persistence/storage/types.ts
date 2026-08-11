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

export interface ObjectStorageRepository {
  uploadPublic(
    input: PublicObjectUploadInput,
  ): Promise<PublicObjectUploadResult>;
  uploadPrivate(
    input: PrivateObjectUploadInput,
  ): Promise<PrivateObjectUploadResult>;
}
