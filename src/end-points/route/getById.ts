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
    get: {
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
                description: "Route was retrieved",
                schema: {
                    $ref: "#/definitions/GetResponse",
                },
            },
            404: {
                description: "Route doesn't exist",
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
        summary: "Retreive a route by it's ID",
        tags: [
            "Routes",
        ],
    },
};

const definitions = {
    GetResponse: {
        properties: {
            result: {
                $ref: "#/definitions/RouteData",
            },
        },
        required: ["result"],
    },
    RouteData: {
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the owner will arrive at their destination",
                type: "integer",
            },
            days: {
                description: "Which days of the week the owner cycles this route",
                example: ["monday", "wednesday", "friday"],
                items: {
                    description: "A day of the week",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
            departureTime: {
                description: "The time in seconds past midnight that the owner will start their route",
                type: "integer",
            },
            id: {
                description: "This route's internal id",
                type: "integer",
            },
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            route: {
                $ref: "#/definitions/CoordList",
            },
        },
        required: ["arrivalTime", "departureTime", "owner", "route", "id"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const id = parseInt(params.id, 10);
    return Database.getRouteById(id);
};

// end point definition
export const getRouteById = new MicroserviceEndpoint("getRouteById")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
