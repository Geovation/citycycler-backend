import services from "./common/services";
import web from "./web";

import * as logger from "winston";

const processType: string = process.env.PROCESS_TYPE;

logger.info(`Starting '${processType}' process`, { pid: process.pid });

export const start = () => {
    switch (processType) {
        case "web":
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
};
