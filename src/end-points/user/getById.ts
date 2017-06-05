import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// OPERATION
const operation = {
    get: {
        consumes: ["application/json"],
        description: "Returns a user matching the passed ID. If the user is not present, an empty object will be " +
        "returned.",
        parameters: [
            {
                description: "The ID of the user to be returned",
                in: "path",
                name: "id",
                required: true,
                type: "number",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The requested User or an empty object",
                schema: {
                    $ref: "#/definitions/GetUserResponse",
                },
            },
            403: {
                description: "An invalid authorization token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "No user exists with the given id",
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
        summary: "Get a user by ID",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    GetUserResponse: {
        description: "The requested User or an empty object",
        properties: {
            result: {
                $ref: "#/definitions/User",
            },
        },
        required: ["result"],
    },
    User: {
        description: "A User object",
        properties: {
            bio: {
                description: "A short description of the user",
                example: "I really love to cycle because...",
                type: "string",
            },
            distance: {
                description: "How far this user has cycled using this app, in meters",
                example: 12321,
                type: "integer",
            },
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                type: "string",
            },
            helpedCount: {
                description: "How many times this user has been helped by an expeienced cyclist",
                example: 3,
                type: "integer",
            },
            id: {
                description: "The user's database ID",
                type: "number",
            },
            joined: {
                description: "When the user joined MatchMyRoute, in UTC",
                example: "2017-05-25T05:58:18.763Z",
                type: "string",
            },
            name: {
                description: "The user's full name",
                example: "Joe Blogs",
                type: "string",
            },
            photo: {
                description: "The url to a profile photo os this user",
                example: "http://www.example.com/example.jpg",
                type: "string",
            },
            preferences: {
                $ref: "#/definitions/UserPreferences",
            },
            rating: {
                description: "This user's rating as a number from 0 (low) to 10 (high)",
                example: 7.5,
                type: "number",
            },
            usersHelped: {
                description: "How many inexperienced cyclists this user has helped",
                example: 3,
                type: "integer",
            },
        },
        required: ["email", "id", "name", "rating", "usersHelped", "preferences", "helpedCount", "distance"],
    },
    UserPreferences: {
        description: "A user's preferences",
        properties: {
            rideDifficulty: {
                description: "The intensity of rides shown to this user",
                enum: ["quiet", "balanced", "fast"],
                example: "balanced",
                type: "string",
            },
            units: {
                description: "What units the user prefers to see distances in",
                enum: ["miles", "kilometers"],
                example: "miles",
                type: "string",
            },
        },
    },
};

// ///////////////
// SWAGGER: end //
// ///////////////

const service = (broadcast: Function, params: any): Promise<any> => {
    const id = parseInt(params.id, 10);
    return getIdFromJWT(params.authorization).then(() => {
        return Database.getUserById(id).then(user => {
            return user.asUserProfile();
        });
    });
};

export const getById = new MicroserviceEndpoint("getUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
