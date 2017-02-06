import * as firebaseAdmin from "firebase-admin";

export const authorizer = firebaseAdmin;

// Init firebase
try {
    firebaseAdmin.app("timepix");
} catch (e) {
    try {
       firebaseAdmin.initializeApp(
            {
                credential: firebaseAdmin.credential.cert("conf/key-file.json"),
                databaseURL: process.env.FIREBASE_URL,
            },
            "timepix"
        );
   } catch (err) {
       throw err;
   };
};
