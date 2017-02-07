import * as path from "path";

import { EndpointCollection } from "../endpoint-collection";

// Import Endpoints
import { get } from "./get";
import { getById } from "./getById";
import { testPost } from "./test-post";

export const images: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
images.addEndpoint(get);
images.addEndpoint(getById);
images.addEndpoint(testPost);
