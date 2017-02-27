import * as gcloud from "@google-cloud/storage";

const getImagesBucket = gcloud(process.env.GOOGLE_APPLICATION_CREDENTIALS)
                        .bucket(process.env.DATASTORE_PROJECT_ID);

const getBucketFile = path => getImagesBucket.file(path);

/**
 *
 *  Path is relative to the bucket location.
 *
 */
export const getImageWritableStream: Function = (path: string, publicAccess: boolean) => {
  let writeOpts = {};
  if (publicAccess) {
      writeOpts = { predefinedAcl: "publicRead" };
  }
  return getBucketFile(path).createWriteStream(writeOpts);
};
