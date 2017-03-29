import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createUser } from "./create";
import { deleteUser } from "./delete";
import { getById } from "./getById";

export const user: EndpointCollection = new EndpointCollection("user");

// export Endpoints
user.addEndpoint(getById);
user.addEndpoint(createUser);
user.addEndpoint(deleteUser);
