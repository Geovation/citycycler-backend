import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRouteById } from "./getById";

export const route: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
route.addEndpoint(createRoute);
route.addEndpoint(getRouteById);
route.addEndpoint(deleteRoute);
