import * as joi from "joi";

interface IValidationOptions {
    value: any;
    schema: joi.Schema;
    errorMessage: string;
    errorStatus: number;
}

interface IValidationError {
    status: number;
    ok: boolean;
    err: Error;
}

/** @function formatError
 *
 *  Returns an error formatted for Seneca.
 *
 *  @param    {Object}  error - The error to be formatted.
 *  @param    {number}  status - The status to be applied to the error (defaults to 500).
 *  @param    {string}  message - The application error message to be returned.
 *  @param    {any}     value - The value whose validation raised this error.
 *
 *  @return   { Object, any}
 */
const formatError = (err: any, status: number, message: string, value: any): joi.ValidationError => {
    err.status = status || 500;
    err.message = message;
    return {
        error: {
            err,
            ok: false,
            status: err.status,
        },
        value,
    };
};

/** @function validate
 *
 *  Validates the provided value using Joi (https://github.com/hapijs/joi) against to the provided schema.
 *  Returns the validated value. Throws an error if validation fails.
 *
 *  @summary   Validate a value against a defined schema.
 *
 *  @param     {Object}  options - The validation options object.
 *  @param     {any}     options.value - The thing to be validated.
 *  @param     {any}     options.schema - The Joi schema against which to validate.
 *  @param     {string}  options.errorMessage - The 'human-readable' message to be assigned to the error if thrown.
 *  @param     {number}  options.errorStatus- The status to be assigned to the error if thrown
 *
 *  @return    {any}
 */
const validateAgainstJoiSchema = (options: IValidationOptions): joi.ValidationResult => {
  try {
    const { error, value: result } = options.schema.validate(options.value);
    if (error) {
      return formatError(error, options.errorStatus, options.errorMessage, result);
    } else {
      return { error: null, value: result };
    }
  } catch (err) {
    return formatError(err, options.errorStatus, options.errorMessage, null);
  }
};

export default {
    formatError,
    validateAgainstJoiSchema,
};
