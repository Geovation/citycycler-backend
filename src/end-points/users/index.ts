import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createUser } from "./create";
import { deleteUser } from "./delete";
import { getById } from "./getById";

export const users: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
users.addEndpoint(getById);
users.addEndpoint(createUser);
users.addEndpoint(deleteUser);
