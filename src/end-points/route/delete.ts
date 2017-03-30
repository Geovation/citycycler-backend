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
            "Routes",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const id = parseInt(params.id, 10);
    return Database.getRouteById(id).then(route => {
        return doIfUser(params.authorisation, route.owner, () => {
            return Database.deleteRoute(id);
        });
    }, err => {
        throw "Invalid Authentication";
    });
};

// end point definition
export const deleteRoute = new MicroserviceEndpoint("delete")
    .addSwaggerOperation(operation)
    .addService(service);
