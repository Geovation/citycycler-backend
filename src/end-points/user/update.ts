import { getIdFromJWT } from "../../common/auth";
import * as CloudStorage from "../../common/cloudstorage";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
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
            firstname: {
                description: "The user's first name",
                example: "Joe",
                type: "string",
            },
            id: {
                description: "The user's internal id",
                type: "integer",
            },
            photo: {
                description: "A url pointing to the user's profile picture",
                example: "http://lorempixel.com/400/400/people/",
                type: "string",
            },
            preferences: {
                $ref: "#/definitions/UserPreferences",
            },
            surname: {
                description: "The user's surname",
                example: "Bloggs",
                type: "string",
            },
        },
        required: ["id"],
    },
    UpdateUserResponse: {
        properties: {
            result: {
                description: "Whether the update succeeded",
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
    let uid = "";
    return getIdFromJWT(params.authorization).then(userId => {
            Database.getUserById(userId).then(user => {
                if (user.photo) {
                    uid = user.photo.substring(user.photo.lastIndexOf("-") + 1).slice(0, -4);
                }
            });
            return userId;
        }).then(userId => {
        let updates: any = {};
        let promises = [];
        if (payload.bio !== undefined && payload.bio.trim().length !== 0) {
            updates.profile_bio = payload.bio;
        }
        if (payload.email !== undefined && payload.email.trim().length !== 0) {
            updates.email = payload.email;
        }
        if (payload.firstname !== undefined && payload.firstname.trim().length !== 0) {
            updates.firstname = payload.firstname;
        }
        if (payload.surname !== undefined && payload.surname.trim().length !== 0) {
            updates.surname = payload.surname;
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
            promises.push(CloudStorage.deleteProfileImage(uid));
            updates.profile_photo = null;
        } else if (typeof payload.photo !== "undefined" && payload.photo.trim().length !== 0) {
            const uidNew = Math.random().toString(35).substr(2, 7);
            promises.push(
                CloudStorage.deleteProfileImage(uid).then(() => {
                    return CloudStorage.storeProfileImage(payload.photo, uidNew)
                        .then(profileImage => {
                            updates.profile_photo = process.env.STORAGE_BASE_URL + "/" +
                                    process.env.STORAGE_BUCKET + "/" + profileImage;
                            return true;
                        });
                })
            );
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
