/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import { EndpointCollection } from "./endpoint-collection";
import { closeSeneca, registerAPI, registerServices } from "./helper";

// IMPORT MICROSERVICES
import { images } from "../../../end-points/images";
import { users } from "../../../end-points/users";

const endpointCollection: EndpointCollection = new EndpointCollection();

// ADD MICROSERVICES TO EXPORT
endpointCollection.addEndpointCollection(images);
endpointCollection.addEndpointCollection(users);

export const servicesHelper = registerAPI(endpointCollection);
registerServices(endpointCollection);

export const closeServices = closeSeneca;
