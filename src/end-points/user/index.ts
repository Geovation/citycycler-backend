import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { auth } from "./auth";
import { createUser } from "./create";
import { deleteUser } from "./delete";
import { getById } from "./getById";
import { updateUser } from "./update";

export const user: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
user.addEndpoint(getById);
user.addEndpoint(createUser);
user.addEndpoint(updateUser);
user.addEndpoint(deleteUser);
user.addEndpointCollection(auth);
