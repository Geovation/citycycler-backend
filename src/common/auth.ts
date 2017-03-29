import * as Database from "./database";
import { UserFullDataModel } from "./UserFullDataModel";
import * as jwt from "jsonwebtoken";

/**
 * check if the header was authorsed by the given user
 * @param authHeader
 * @param uid
 */
export function isUser(authHeader: string, uid: number): Promise<boolean> {
    return getIdFromJWT(authHeader)
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
export function doIfUser(authHeader: string, uid: number, onAuth: Function): Promise<any> {
    return new Promise((resolve, reject) => {
        isUser(authHeader, uid).then(valid => {
            if (valid) {
                resolve(onAuth());
            } else {
                reject({ ok: false, result: { error: "Invalid authorisation", status: 403 } });
            }
        });
    });
}

/**
 * Return the user ID from a given token, after verifying that this is the correct user
 * @param authHeader
 */
export function getIdFromJWT(authHeader: string): Promise<number> {
    return new Promise((resolve, reject) => {
        if (authHeader === undefined) {
            reject({
                ok: false,
                result: { error: "Invalid authorisation", status: 403 },
            });
        }
        const [scheme, token] = authHeader.split(" ");
        if (scheme !== "Bearer") {
            reject({
                ok: false,
                result: { error: "Invalid Authorisation scheme. This API requires 'Bearer JWT'", status: 400 },
            });
        }
        const payload = jwt.decode(token, {
            json: true,
        });
        // Get the user, so we can use their secret to verify the JWT
        Database.getUserById(payload.id).then(user => {
            try {
                jwt.verify(token, user.jwtSecret, {
                    algorithms: ["HS256"],
                    issuer: "MatchMyRoute Backend",
                });
                resolve(user.id);
            } catch (err) {
                reject({
                    ok: false,
                    result: { error: "Invalid authorisation", status: 403 },
                });
            }
        }, err => {
            reject({
                ok: false,
                result: { error: "Invalid authorisation", status: 403 },
            });
        });
    });
}

/**
 * Generates a JWT for this user id, that expires in 2 weeks
 * @param user
 */
export const generateJWTFor = (user: UserFullDataModel): string => {
    return jwt.sign({ id: user.id }, user.jwtSecret, {
        algorithm: "HS256",
        expiresIn: 1209600,	// 2 weeks
        issuer: "MatchMyRoute Backend",
    });
};
