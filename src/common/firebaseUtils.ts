import * as firebase from "firebase";
import * as firebaseAdmin from "firebase-admin";

export function createFirebaseUser (email: string): Promise<any> {
    let newUser;
    return firebaseAdmin.auth().createUser({
        email,
        emailVerified: true,
        password: "O$5t96L1PP0YKXsDo7",
    }).then(user => {
        newUser = user;
        return firebaseAdmin.auth().createCustomToken(newUser.uid);
    }).then(customToken => {
        return {
            customToken,
            user: newUser,
        };
    });
};

export function getJwtForUser (customToken: string): Promise<any> {
    return firebase.auth().signOut().then(() => {
        return firebase.auth().signInWithCustomToken(customToken);
    }).then(user => {
        return user.getIdToken();
    });
}

export function deleteFirebaseUsers (uids: string[]): Promise<any> {
    let deletePromises = [];
    uids.forEach(uid => {
        deletePromises.push(
            firebaseAdmin.auth().deleteUser(uid)
        );
    });

    return Promise.all(deletePromises);
};
