import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createUser } from "./create";
import { deleteUser } from "./delete";
import { get } from "./get";
import { updateUser } from "./update";

export const user: EndpointCollection = new EndpointCollection("user");

// export Endpoints
user.addEndpoint(get);
user.addEndpoint(createUser);
user.addEndpoint(updateUser);
user.addEndpoint(deleteUser);
