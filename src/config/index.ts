import * as joi from "joi";

// local modules
import web from "./web";

const configs = {
    web,
};

const processType: string = process.env.PROCESS_TYPE;

const envVarsSchema: joi.Schema = joi.object({
    WITH_SERVICES: joi.boolean()
        .default(false),
}).unknown().required();

const { error }: joi.ValidationResult<any> = joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

if (!configs[processType]) {
    throw new Error(`No config for process type: ${processType}`);
}

export const config: IConfigurationComposite = configs[processType]();
