import * as path from "path";

import { APIEndpointCollection } from "../api-endpoint-collection";

// Import Endpoints
import { get } from "./get";
import { getById } from "./getById";

export const images: APIEndpointCollection = new APIEndpointCollection(path.parse(__dirname).name);

// export Endpoints
images.addApiEndpoint(get);
images.addApiEndpoint(getById);
