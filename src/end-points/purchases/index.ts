import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { genClientToken } from "./gen-client-token";
// import { checkout } from "./checkout";

export const purchases: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
purchases.addEndpoint(genClientToken);
