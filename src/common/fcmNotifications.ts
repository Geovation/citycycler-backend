import * as firebaseAdmin from "firebase-admin";

/**
 * notify - notify the provided user with the provided data and message payload
 *
 * @param {integer} userId: number The id of the user to notify
 * @param {firebaseAdmin.messaging.MessagingPayload} messagePayload: data payload
 * and native message payload as per Firebase Cloud Messaging syntax
 */
export function notify(
    userId: number,
    messagePayload: firebaseAdmin.messaging.MessagingPayload) {
    console.log("user " + userId + "is notified");
    getRegistrationTokensForUser(userId).then(
        registrationTokens => {
            // send notification
            if ( registrationTokens.length > 0 ) {
                console.log("sending notification");
                firebaseAdmin.messaging().sendToDevice(
                    registrationTokens,
                    messagePayload
                );
            } else {
                console.log("no registration token found for user");
            }
        }
    );
}

/**
 * getRegistrationTokensForUser - gets all current registration tokens for the
 * user from firebase
 *
 * @param  {integer} userId: number The userId of the user that should receive
 * the notification
 * @return {string[]} Array of registration tokens for the user
 */
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
