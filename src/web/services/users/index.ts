import * as path from "path";

import { EndpointCollection } from "../endpoint-collection";

// Import Endpoints
import { getById } from "./getById";

export const users: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
users.addEndpoint(getById);
