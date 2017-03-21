import { doIfUser } from "../../common/auth";
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
        parameters: [
            {
                description: "The route ID",
                in: "query",
                name: "id",
                required: true,
                type: "integer",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The route was deleted",
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
        summary: "Delete a route",
        tags: [
            "Route Deletion",
        ],
    },
};

const securityDefinitions = {
    userAuth: {
        description: "JWT based user authetication system. Expects a value of 'Bearer JWT'",
        in: "header",
        name: "Authorisation",
        type: "apiKey",
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const id = parseInt(params.id, 10);
    return doIfUser(params.authorisation, id, () => {
        return Database.deleteRoute(id);
    });
};

// end point definition
export const deleteRoute = new MicroserviceEndpoint("delete")
    .addSwaggerOperation(operation)
    .addSwaggerSecurityDefinitions(securityDefinitions)
    .addService(service);
