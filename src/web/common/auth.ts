import * as firebaseAdmin from "firebase-admin";

import * as Datastore from "./datastore";

// Init firebase
firebaseAdmin.initializeApp(
    {
        credential: firebaseAdmin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        databaseURL: process.env.FIREBASE_URL,
    }
);

function getIdFromIdtoken(idtoken): Promise<string> {
    return firebaseAdmin.auth().verifyIdToken(idtoken)
        .then(decodedIdToken => decodedIdToken.uid) as Promise<any>;
}

/**
 * check if the token belongs to the given user
 * @param idtoken
 * @param uid
 */
export function isUser(idtoken, uid): Promise<any> {
    return getIdFromIdtoken(idtoken)
        .then(id => {
            if (id !== uid) {
                throw `${uid} is not ${id}`;
            }

            return id;
        }) as Promise<any>;
}

export function isOwner(idtoken): Promise<any> {
    return getIdFromIdtoken(idtoken)
        .then( id => Datastore.getUserById(id))
        .then( user => {
            if (!user || !user.groups || !user.groups.indexOf || (user.groups.indexOf("owner") === -1)) {
                throw "It is not an owner";
            }
        });
}
