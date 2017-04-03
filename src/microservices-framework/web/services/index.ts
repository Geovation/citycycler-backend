/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import { EndpointCollection } from "./endpoint-collection";
import { closeSeneca, registerAPI, registerServices } from "./helper";

// IMPORT MICROSERVICES
import { endpoints } from "../../../end-points";

const endpointCollection: EndpointCollection = new EndpointCollection();

// ADD MICROSERVICES TO EXPORT
endpoints.forEach(endpoint => endpointCollection.addEndpointCollection(endpoint));

export const servicesHelper = registerAPI(endpointCollection);
export const senecaReady = registerServices(endpointCollection);

export const closeServices = closeSeneca;
