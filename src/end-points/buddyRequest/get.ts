import { getIdFromJWT } from "../../common/auth";
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
                description: "The route ID (if empty, all routes of the user will be returned)",
                in: "query",
                name: "id",
                required: false,
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
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
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
        security: [
            {
                userAuth: [],
            },
        ],
        summary: "Retrieve a route by it's ID. If no ID is provided, all routes " +
        "of the user are returned",
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
                description: "The time in ISO 8601 extended format that the owner will arrive at their destination",
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
                description: "The time in ISO 8601 extended format that the owner will start their route",
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
    RouteGetResult: {
        description: "An array of routes belonging to this user",
        items: {
            $ref: "#/definitions/RouteData",
        },
        type: "array",
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    let id = parseInt(params.id, 10);
    if (!id) {
        id = null;
    }
    return getIdFromJWT(params.authorization).then((userId) => {
        return Database.getRoutes({userId, id});
    });
};

// end point definition
export const getRoutes = new MicroserviceEndpoint("getRouteById")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
