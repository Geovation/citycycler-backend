import * as gcloud from "@google-cloud/storage";

let getImagesBucket;
let getBucketFile;

export function init() {
    getImagesBucket = gcloud(process.env.GOOGLE_APPLICATION_CREDENTIALS)
        .bucket(process.env.DATASTORE_PROJECT_ID);

    getBucketFile = path => getImagesBucket.file(path);
}

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

/**
 * Given a path, it returns a temp public URL that will last just few seconds.
 *
 * @param path path to the file from /bucketname
 * @returns {Promise<string>}
 */
export function genTempPubUrl(path): Promise <string> {
    const expires = new Date().getTime() + 10 * 1000;
    const imageFile = getBucketFile(path);
    return imageFile.getSignedUrl({ action: "read", expires})
        .then(urls => urls[0]);
}
