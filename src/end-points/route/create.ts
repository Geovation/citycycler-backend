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
                    $ref: "#/definitions/NewRouteData",
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
            "Route Creation",
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
                maxLength: 2,
                minLength: 2,
                type: "integer",
            },
            minItems: 2,
            type: "array",
        },
        type: "array",
    },
    CreateRouteResponse: {
        description: "The Route's ID",
        properties: {
            result: {
                format: "int32",
                type: "number",
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
        required: ["arrivalTime", "departureTime", "owner", "route"],
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
