import web from "web";
import * as logger from "winston";

const processType: string = process.env.PROCESS_TYPE;
// const services: boolean = process.env.WITH_SERVICES || true;

logger.info(`Starting '${processType}' process`, { pid: process.pid });

switch (processType) {
    case "web":
//        if (services) {
//            require("common/services");
//        }
        web();
        break;
//    case "microservices":
//        require("common/services");
//        break;
    default:
        throw new Error(`
            ${processType} is an unsupported process type.
            Use one of: 'web', 'microservices'!
        `);
}
