import * as Database from "../common/database";
import { EndpointCollection } from "../microservices-framework/web/services/endpoint-collection";
import { MicroserviceEndpoint } from "../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const operation = {
    get: {
        consumes: ["application/json"],
        parameters: [],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "All E2E test users have been deleted",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Delete any users made during E2E testing",
        tags: [
            "application",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    // All users made during e2e tests have emails with the domain: e2e-test.matchmyroute-backend.appspot.com
    // This means that no real users should ever be able to be deleted, because that domain is never going
    // to have email accounts associated with it
    const query = "DELETE FROM users WHERE email LIKE '%@e2e-test.matchmyroute-backend.appspot.com';";
    return Database.sqlTransaction(query).then(result => {
        return true;
    });
};

// end point definition
const clearE2EUsers = new MicroserviceEndpoint("clearE2EUsersEndpoint")
    .addSwaggerOperation(operation)
    .addService(service);

// Export a collection, with this endpoint in it
export const E2EUtils: EndpointCollection = new EndpointCollection("clearE2EUsers");
E2EUtils.addEndpoint(clearE2EUsers);
