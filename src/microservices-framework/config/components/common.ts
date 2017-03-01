import * as joi from "joi";

const envVarsSchema: joi.Schema = joi.object({
    NODE_ENV: joi.string()
        .allow(["development", "production", "test"])
        .required(),
}).unknown().required();

const { error, value: envVars }: joi.ValidationResult<any> = joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    env: envVars.NODE_ENV,
};
