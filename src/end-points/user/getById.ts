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
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                type: "string",
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
        },
        required: ["email", "id", "name"],
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
