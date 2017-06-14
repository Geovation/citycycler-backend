import { generateJWTFor, minimumHashingRounds } from "../../common/auth";
import * as CloudStorage from "../../common/cloudstorage";
import * as Database from "../../common/database";
import User from "../../common/UserDataModels";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
import * as crypto from "crypto";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    put: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The new user",
                in: "body",
                name: "user",
                required: true,
                schema: {
                    $ref: "#/definitions/NewUser",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "New user was created",
                schema: {
                    $ref: "#/definitions/CreateResponse",
                },
            },
            409: {
                description: "A user already exists with this email address",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Create a new user",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CreateResponse: {
        description: "The new user's ID and an authorised JWT",
        properties: {
            result: {
                $ref: "#/definitions/NewUserResult",
            },
        },
        required: ["result"],
    },
    NewUser: {
        description: "A User object",
        // example: [[0, 0], [1, 1]],
        properties: {
            bio: {
                description: "The user's short biography",
                example: "Hi, I'm Joe Blogs and I've been cycling London since I was 12.",
                type: "string",
            },
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                type: "string",
            },
            name: {
                description: "The user's full name",
                example: "Joe Blogs",
                type: "string",
            },
            password: {
                description: "The user's password",
                type: "string",
            },
            photo: {
                description: "A profile photo for the user as data URI",
                type: "string",
            },
        },
        required: ["email", "name", "password"],
    },
    NewUserResult: {
        properties: {
            jwt: {
                properties: {
                    expires: {
                        example: 123456789,
                        type: "integer",
                    },
                    token: {
                        example: "eyJhbGciOiJI...28ZZEY",
                        type: "string",
                    },
                },
            },
            profileImage: {
                description: "The public URL of the profileImage (null if no image was provided)",
                type: "string",
            },
            user: {
                $ref: "#/definitions/User",
            },
        },
        required: ["id", "jwt"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    const { email, password, name, bio, photo } = payload;
    // Work out the user's password hash and salt.
    // We are using PBKDF2 with 50000 iterations and sha512.
    const rounds = minimumHashingRounds;
    const salt = crypto.randomBytes(128);
    const jwtSecret = crypto.randomBytes(20).toString("base64");
    let createdUser: User;
    let pwh;
    let client;
    let profileImgUrl;
    return new Promise((resolve, reject) => {
        if (typeof email === "undefined" || email.trim().length === 0) {
            reject("400:Email Required");
            return;
        } else if (typeof password === "undefined" || password.trim().length === 0) {
            reject("400:Password Required");
            return;
        } else if (typeof name === "undefined" || name.trim().length === 0) {
            reject("400:Name Required");
            return;
        }
        crypto.pbkdf2(password, salt, rounds, 512, "sha512", (err, key) => {
            if (err) {
                reject(err);
            } else {
                resolve(key);
            }
        });
    })
    .then(newPwh => {
        pwh = newPwh;
        return Database.createTransactionClient();
    })
    // create user
    .then(newClient => {
        client = newClient;
        let sqlParams = {name, email, pwh, salt, rounds, jwt_secret: jwtSecret, profile_bio: bio};
        return Database.putUser(sqlParams, client);
    })
    // store profile photo for user if it exists
    .then(user => {
        createdUser = user;
        if (typeof photo !== "undefined") {
            return CloudStorage.storeProfileImage(payload.photo, user.id)
            .then((newProfileImgName) => {
                profileImgUrl = process.env.STORAGE_BASE_URL + "/" +
                    process.env.STORAGE_BUCKET + "/" + newProfileImgName;
                return Database.updateUser(createdUser.id, {profile_photo: profileImgUrl}, client);
            }, err => {
                // If the image storage errs add a status code and re-throw
                const errMsg = typeof err === "string" ? err : err.message;
                if (errMsg.indexOf("URI does not contain") !== -1) {
                    throw new Error("400:" + errMsg);
                } else {
                    throw new Error("500:" + errMsg);
                }
            });
        } else {
            return true;
        }
    })
    .then(() => {
        return Database.commitAndReleaseTransaction(client);
    })
    // return information to client
    .then(() => {
        let returnValues = {
            jwt: generateJWTFor(createdUser),
            profileImage: profileImgUrl? profileImgUrl : null,
            status: 201,
            user: createdUser.asUserProfile(),
        };
        return returnValues;
    })
    // handle all errors and roll back if transaction already started
    .catch(err => {
        const originalError = typeof err === "string" ? err : err.message;
        if (typeof client !== "undefined") {
            return Database.rollbackAndReleaseTransaction(client)
            .then(() => {
                throw new Error(originalError);
            });
        } else {
            throw new Error(originalError);
        }
    });
};

// end point definition
export const createUser = new MicroserviceEndpoint("createUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
