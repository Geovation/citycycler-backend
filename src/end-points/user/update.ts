import { getIdFromJWT, minimumHashingRounds } from "../../common/auth";
import * as CloudStorage from "../../common/cloudstorage";
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
                description: "An invalid authorization token was supplied",
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
            preferences: {
                $ref: "#/definitions/UserPreferences",
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
    return getIdFromJWT(params.authorization).then(userId => {
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
        if (payload.preferences !== undefined) {
            if (payload.preferences.rideDifficulty !== undefined &&
                payload.preferences.rideDifficulty.trim().length !== 0) {
                updates.preferences_difficulty = payload.preferences.rideDifficulty;
            }
            if (payload.preferences.units !== undefined && payload.preferences.units.trim().length !== 0) {
                updates.preferences_units = payload.preferences.units;
            }
        }
        // delete or replace profile photo
        if (payload.photo === null) {
            promises.push(CloudStorage.deleteProfileImage(userId));
            updates.profile_photo = null;
        } else if (typeof payload.photo !== "undefined" && payload.photo.trim().length !== 0) {
            promises.push(
                CloudStorage.storeProfileImage(payload.photo, userId)
                .then(profileImage => {
                        updates.profile_photo = profileImage;
                    }
                )
            );
        }
        if (payload.password !== undefined && payload.password.trim().length !== 0) {
            // Generate the new password hash
            promises.push(Database.getUserById(userId).then(user => {
                let rounds = minimumHashingRounds;
                return new Promise((resolve, reject) => {
                    crypto.pbkdf2(payload.password.trim(), user.salt, rounds, 512, "sha512", (err, key) => {
                        if (err) {
                            reject("Error hashing: " + err);
                        } else {
                            updates.pwh = key;
                            if (user.rounds !== minimumHashingRounds) {
                                updates.rounds = minimumHashingRounds;
                            }
                            resolve(true);
                        }
                    });
                });
            }));
        }
        return Promise.all(promises).then(values => {
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
