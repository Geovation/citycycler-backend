import * as promisify from "es6-promisify";
import * as http from "http";
import * as logger from "winston";

import { app } from "./server";
import { config } from "config";

export default function (): void {
    const server: http.Server = http.createServer(app.callback());

    const serverListen: Function = promisify(server.listen, server);

    serverListen(config.server.port)
        .then(() => {
            logger.info(`App is listening on port ${config.server.port}`);
            logger.info("Press CtrlC to quit.");
        })
        .catch((err) => {
            logger.error("Error happened during server start", err);
            process.exit(1);
        });
}
