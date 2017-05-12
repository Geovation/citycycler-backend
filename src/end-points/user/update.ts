import { getIdFromJWT, minimumHashingRounds } from "../../common/auth";
import * as Database from "../../common/database";
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
    post: {
        consumes: ["application/json"],
        description: "This endpoint accepts an object that contains fields that the user wishes to update. " +
        "Any fields not in the update object will not be modified.",
        parameters: [
            {
                description: "The updated user settings",
                in: "body",
                name: "user",
                required: true,
                schema: {
                    $ref: "#/definitions/UpdateUser",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "User was updated",
                schema: {
                    $ref: "#/definitions/UpdateUserResponse",
                },
            },
            400: {
                description: "An invalid parameter was supplied, see the error message for details",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
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
        security: [
            {
                userAuth: [],
            },
        ],
        summary: "Update a user's settings",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    UpdateUser: {
        description: "A User object",
        properties: {
            bio: {
                description: "The user's new biography",
                example: "Hi, I'm Joe Blogs and I've been cycling London since I was 12.",
                type: "string",
            },
            email: {
                description: "The user's new email address",
                example: "joe@blogs.com",
                type: "string",
            },
            name: {
                description: "The user's new full name",
                example: "Joe Blogs",
                type: "string",
            },
            password: {
                description: "The user's new password",
                type: "string",
            },
            photo: {
                description: "A url pointing to the user's profile picture",
                example: "http://lorempixel.com/400/400/people/",
                type: "string",
            },
        },
        required: ["id"],
    },
    UpdateUserResponse: {
        properties: {
            result: {
                description: "Whether the update succeded",
                type: "boolean",
            },
        },
        required: ["result"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorisation).then(userId => {
        let updates: any = {};
        let promises = [];
        if (payload.bio !== undefined && payload.bio.trim().length !== 0) {
            updates.profile_bio = payload.bio;
        }
        if (payload.email !== undefined && payload.email.trim().length !== 0) {
            updates.email = payload.email;
        }
        if (payload.name !== undefined && payload.name.trim().length !== 0) {
            updates.name = payload.name;
        }
        if (payload.photo !== undefined && payload.photo.trim().length !== 0) {
            updates.profile_photo = payload.photo;
        }
        if (payload.password !== undefined && payload.password.trim().length !== 0) {
            // Generate the new password hash
            promises.push(Database.runTransaction(Database.getUserById, userId, false).then(user => {
                let rounds = minimumHashingRounds;
                return new Promise((resolve, reject) => {
                    crypto.pbkdf2(payload.password.trim(), user.salt, rounds, 512, "sha512", (err, key) => {
                        if (err) {
                            reject("Error hashing: " + err);
                        } else {
                            let kvs: any = [["pwh", key]];
                            if (user.rounds !== minimumHashingRounds) {
                                kvs.push([
                                    "rounds", minimumHashingRounds,
                                ]);
                            }
                            resolve(kvs);
                        }
                    });
                });
            }));
        }
        return Promise.all(promises).then(kvss => {
            kvss.forEach((kvs) => {
                kvs.forEach((kv) => {
                    updates[kv[0]] = kv[1];
                });
            });
            if (!updates) {
                return true;
            } else {
                return Database.updateUser(userId, updates);
            }
        }, err => {
            throw "Error updating user: " + err;
        });
    });
};

// end point definition
export const updateUser = new MicroserviceEndpoint("updateUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
