import { doIfUser } from "../../common/auth";
import * as Database from "../../common/database";
import { RouteDataModel } from "../../common/RouteDataModel";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    put: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/NewRouteData",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "New route was created",
                schema: {
                    $ref: "#/definitions/CreateRouteResponse",
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
        summary: "Create a new route",
        tags: [
            "Routes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CoordList: {
        description: "A list of [lat,long] coordinates that make up the route",
        example: [[0, 0], [1, 1]],
        items: {
            items: {
                $ref: "#/definitions/Coordinate",
            },
            minItems: 2,
            type: "array",
        },
        type: "array",
    },
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "integer",
        },
        type: "array",
    },
    CreateRouteResponse: {
        description: "The Route's ID",
        properties: {
            result: {
                properties: {
                    id: {
                        format: "int32",
                        type: "number",
                    },
                },
                required: ["id"],
            },
        },
        required: ["result"],
    },
    NewRouteData: {
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the owner arrives at their destination",
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
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            route: {
                $ref: "#/definitions/CoordList",
            },
        },
        required: ["arrivalTime", "departureTime", "owner", "route", "days"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = new RouteDataModel(params.body);
    return doIfUser(params.authorisation, payload.owner, () => {
        return Database.putRoute(payload);
    }).then(routeId => {
        return { id: routeId, status: 201 };
    });
};

// end point definition
export const createRoute = new MicroserviceEndpoint("createRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
