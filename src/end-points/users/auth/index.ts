import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { generate } from "./generate";

export const auth: EndpointCollection = new EndpointCollection("users/" + path.parse(__dirname).name);

// export Endpoints
auth.addEndpoint(generate);
