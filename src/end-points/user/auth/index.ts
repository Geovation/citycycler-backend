import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { generate } from "./generate";
import { regenerate } from "./regenerate";

export const auth: EndpointCollection = new EndpointCollection("user/" + path.parse(__dirname).name);

// export Endpoints
auth.addEndpoint(generate);
auth.addEndpoint(regenerate);
