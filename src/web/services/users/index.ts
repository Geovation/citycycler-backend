import * as path from "path";

import { APIEndpointCollection } from "../api-endpoint-collection";

// Import Endpoints
import { getById } from "./getById";

export const users: APIEndpointCollection = new APIEndpointCollection(path.parse(__dirname).name);

// export Endpoints
users.addApiEndpoint(getById);
