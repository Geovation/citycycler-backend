import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { create } from "./create";
import { getRouteById } from "./getById";

export const route: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
route.addEndpoint(create);
route.addEndpoint(getRouteById);
