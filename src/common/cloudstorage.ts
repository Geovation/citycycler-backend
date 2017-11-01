import * as Storage from "@google-cloud/storage";
import * as promisify from "es6-promisify";
import * as getUriFunction from "get-uri";

const gcs = Storage();
const getUri = promisify(getUriFunction);

export function storeProfileImage(imgUri: string, userId: string) {
    const bucket = gcs.bucket(process.env.STORAGE_BUCKET);
    const filename = createFilenameForUser(userId);
    const file = bucket.file(filename);
    return getUri(imgUri).then((readStream) => {
        const writeStream = file.createWriteStream({
            public: true,
        });
        readStream.pipe(writeStream)
        .on("error", (err) => {
            throw new Error("Could not write image; " + err);
        })
        .on("finish", () => {
            return true;
        });
    })
    .then(() => {
        return filename;
    });
}

export function createFilenameForUser(userId: string): string {
    return "profileimg-" + userId + ".jpg";
}

export function deleteProfileImage(userId: string): Promise<any> {
    const bucket = gcs.bucket(process.env.STORAGE_BUCKET);
    const filename = createFilenameForUser(userId);
    const file = bucket.file(filename);
    return file.exists().then(data => {
        if (data[0]) {
            return file.delete();
        } else {
            return true;
        }
    });
}
