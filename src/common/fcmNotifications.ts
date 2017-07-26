import * as firebaseAdmin from "firebase-admin";

export function notify(
    userId: number,
    messagePayload: firebaseAdmin.messaging.MessagingPayload) {
    console.log("user " + userId + "is notified");
    getRegistrationTokensForUser(userId).then(
        registrationTokens => {
            // send notification
            console.log("sending notification");
            firebaseAdmin.messaging().sendToDevice(
                registrationTokens,
                messagePayload
            );
        }
    );
}

function getRegistrationTokensForUser(userId: number) {
    const database = firebaseAdmin.database();
    const deviceTokenRef = database.ref("deviceTokens");
    const userRef = deviceTokenRef.child(userId + "");

    return userRef.once("value").then(
        snapshot => {
            let registrationTokens = [];
            snapshot.forEach(child => {
                registrationTokens.push(child.val());
                console.log("Registration token found " + child.val());
            });
            return registrationTokens;
        }
    );
}
