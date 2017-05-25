import * as Storage from "@google-cloud/storage";

const gcs = Storage();

export function storeProfileImage(imgUri: string, userId: number) {
    const bucket = gcs.bucket("matchmyroute-backend.appspot.com");
    const file = bucket.file("testfile");
    file.save("blabla").then(() => {
        console.log("file created");
    });
    console.log("blub");
}
