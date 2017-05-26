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
    delete: {
        consumes: ["application/json"],
        parameters: [ ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The user was deleted",
            },
            403: {
                description: "An invalid or non-existant authorization token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "The user who owns the given auth token doesn't exist",
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
        summary: "Delete a user",
        tags: [
            "Users",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    let userId;
    return getIdFromJWT(params.authorization).then(id => {
        userId = id;
        return Database.deleteUser(id);
    }).then(() => {
        return CloudStorage.deleteProfileImage(userId);
    });
};

// end point definition
export const deleteUser = new MicroserviceEndpoint("deleteUser")
    .addSwaggerOperation(operation)
    .addService(service);
