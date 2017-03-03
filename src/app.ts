import { start } from "./microservices-framework/app";

import * as Auth from "./common/auth";

// init some services services
Auth.init();

// start micro service framework
start();
