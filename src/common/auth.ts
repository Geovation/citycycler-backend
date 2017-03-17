import * as Database from "./database";
import { UserDataModel } from "./UserDataModel";
import * as jwt from "jsonwebtoken";

/**
 * check if the token belongs to the given user
 * @param token
 * @param uid
 */
export function isUser(token: string, uid: number): Promise<boolean> {
    return getIdFromJWT(token)
        .then(id => {
            return id === uid;
        }) as Promise<any>;
}

/**
 * Return the user ID from a given token, after verifying that this is the correct user
 * @param token
 */
export function getIdFromJWT(token: string): Promise<number> {
    const payload = jwt.decode(token, {
        json: true,
    });
    // Get the user, so we can use their secret to verify the JWT
    return Database.getUserById(payload.id).then((user) => {
        try {
            jwt.verify(token, user.jwtSecret, {
                algorithms: ["HS256"],
                issuer: "MatchMyRoute Backend",
            });
            return user.id;
        } catch (err) {
            throw "Invalid token for this user" + err;
        }
    });
}

/**
 * Generates a JWT for this user id, that expires in 2 weeks
 * @param user
 */
export const generateJWTFor = (user: UserDataModel): string => {
    return jwt.sign({ id: user.id }, user.jwtSecret, {
        algorithm: "HS256",
        expiresIn: 1209600,	// 2 weeks
        issuer: "MatchMyRoute Backend",
    });
};
