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
    post: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/RouteData",
                },
            },
            {
                description: "The user's JWT token",
                in: "header",
                name: "Authorisation",
                required: true,
                type: "string",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "New route was created",
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
            "Route Creation",
        ],
    },
};

// DEFINITIONS

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
        required: true,
        type: "array",
    },
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "integer",
        },
        required: true,
        type: "array",
    },
    CreateResponse: {
        description: "The User's ID",
        properties: {
            result: {
                format: "int32",
                required: true,
                type: "number",
            },
        },
    },
    RouteData: {
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the owner arrives at their destination.",
                required: true,
                type: "integer",
            },
            departureTime: {
                description: "The time in seconds past midnight that the owner will start their route.",
                required: true,
                type: "integer",
            },
            owner: {
                description: "The userId of the user who owns this route.",
                required: true,
                type: "integer",
            },
            route: {
                schema: {
                    $ref: "#/definitions/CoordList",
                },
            },

        },
        required: true,
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return doIfUser(params.authorisation, payload.owner, () => {
        return Database.putRoute(payload);
    });
};

// end point definition
export const createRoute = new MicroserviceEndpoint("createRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
