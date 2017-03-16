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
                description: "Route was retreived",
                schema: {
                    $ref: "#/definitions/RouteData",
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
            "Route Retreival",
        ],
    },
};

const definitions = {
    CoordList: {
        description: "A list of [lat,long] coordinates that make up the route.",
        example: [[0, 0], [1, 1]],
        items: {
            minItems: 2,
            schema: {
                $ref: "#/definitions/Coordinate",
            },
        },
        type: "array",
    },
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "number",
        },
        type: "array",
    },
    RouteData: {
        properties: {
            arrivalTime: {
                description: "The time in secodns past midnight that the owner will arrive at their destination.",
                example: 10,
                type: "number",
            },
            departureTime: {
                description: "The time in seconds past midnight that the owner will start their route.",
                type: "number",
            },
            owner: {
                description: "The userId of the user who owns this route.",
                type: "number",
            },
            route: {
                schema: {
                    $ref: "#/definitions/CoordList",
                },
            },

        },
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
