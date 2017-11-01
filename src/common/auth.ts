import * as Database from "./database";
import { IUserSettings } from "./UserDataModels";
import * as firebaseAdmin from "firebase-admin";
import * as jwt from "jsonwebtoken";

// The minimum number of hashing rounds required for passwords to be considered secure
// Updating this will cause any user who logs in or updates their password to have a new, more secure password generated
export const minimumHashingRounds = 30000;

initFirebase();

function initFirebase() {
    const firebaseServiceAccount = require("conf/matchmyroute-backend-firebase-adminsdk-jm5jb-e33eab9419.json");

    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(firebaseServiceAccount),
        databaseURL: "https://matchmyroute-backend.firebaseio.com/",
    });
}

/**
 * check if the header was authorsed by the given user
 * @param authHeader
 * @param uid
 */
export function isUser(authHeader: string, uid: string, providedClient = null): Promise<boolean> {
    return getIdFromJWT(authHeader, providedClient)
        .then(id => {
            return id === uid;
        }, err => {
            return false;
        });
}

/**
 * Does a given function if the user is authorised
 * @param authHeader
 * @param uid
 * @param onAuth
 */
export function doIfUser(authHeader: string, uid: string, onAuth: Function, providedClient = null): Promise<any> {
    return new Promise((resolve, reject) => {
        isUser(authHeader, uid, providedClient).then(valid => {
            if (valid) {
                resolve(onAuth());
            } else {
                reject("403:Invalid authorization");
            }
        });
    });
}

/**
 * Return the user ID from a given token, after verifying that this is the correct user
 * @param authHeader
 */
export function getIdFromJWT(authHeader: string, providedClient = null): Promise<string> {
    return new Promise((resolve, reject) => {
        if (authHeader === undefined) {
            reject("403:Invalid authorization");
        }
        const [scheme, token] = authHeader.split(" ");

        switch (scheme) {
            case "Firebase":
                // check if id token is valid
                firebaseAdmin.auth().verifyIdToken(token)
                    .then(decodedToken => {
                        resolve(decodedToken.uid);
                    })
                    .catch(err => {
                        reject("403:Invalid authorization");
                    });
                    break;
            case "Bearer":
                const payload = jwt.decode(token, {
                    json: true,
                });
                if (payload === null || payload.id === null) {
                    reject("403:Invalid authorization");
                }
                // Get the user, so we can use their secret to verify the JWT
                Database.getUserById(payload.id, providedClient).then(user => {
                    try {
                        jwt.verify(token, user.jwtSecret, {
                            algorithms: ["HS256"],
                            issuer: "MatchMyRoute Backend",
                        });
                        resolve(user.id);
                    } catch (err) {
                        reject("403:Invalid authorization");
                    }
                }, err => {
                    reject("403:Invalid authorization");
                });
                break;
            default:
                reject("400:Invalid authorization scheme. This API requires 'Bearer <JWT>'");
        }
    });
}

/**
 * Generates a JWT for this user id, that expires in 2 weeks, also creates a
 * firebase custom token for authenticating the client with firebase
 * @param user
 */
export const generateJWTFor = (user: IUserSettings):
Promise<{ token: string; expires: number; firebaseToken: string }> => {
    return firebaseAdmin.auth().createCustomToken(user.id + "")
    .then(firebaseToken => {
        return {
            expires: Math.trunc((new Date()).getTime() / 1000) + 1209600,
            firebaseToken,
            token: jwt.sign({ id: user.id }, user.jwtSecret, {
                algorithm: "HS256",
                expiresIn: 1209600,	// 2 weeks
                issuer: "MatchMyRoute Backend",
            }),
        };
    });
};
