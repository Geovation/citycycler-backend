import * as Datastore from "../../common/datastore";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    get: {
        consumes: ["application/json"],
        description: "Retreive a route by it's ID",
        parameters: [
            {
                description: "The route ID",
                in: "body",
                name: "id",
                required: true,
                type: "number",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Route was retreived",
                type: "string",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "routeretreival",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;

    logger.debug("Getting route by ID: " + payload.id);

    return Datastore.getRouteById(payload.id);
};

// end point definition
export const getRouteById = new MicroserviceEndpoint("getRouteById")
    .addSwaggerOperation(operation)
    .addService(service);
