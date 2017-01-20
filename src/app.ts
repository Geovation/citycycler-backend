import services from "./common/services";
import web from "./web";

import * as logger from "winston";

const processType: string = process.env.PROCESS_TYPE;
const withServices: boolean = process.env.WITH_SERVICES || true;

logger.info(`Starting '${processType}' process`, { pid: process.pid });

switch (processType) {
    case "web":
        if (withServices) {
            logger.info("Starting microservices in web process");
            services();
        }
        web();
        break;
    case "microservices":
        services();
        break;
    default:
        throw new Error(`
            ${processType} is an unsupported process type.
            Use one of: 'web', 'microservices'!
        `);
}
