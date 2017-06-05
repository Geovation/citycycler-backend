import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { matchRoute as match } from "./match";

export const matchRoute: EndpointCollection = new EndpointCollection("experiencedRoutes/" + path.parse(__dirname).name);

// export Endpoints
matchRoute.addEndpoint(match);
