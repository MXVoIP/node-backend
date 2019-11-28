const validate = require('jsonschema').validate;

exports.validateSchema = (instance, srcSchema, requiredFields=[],  additionalFields=false) => {
	// build on to 
	const schema = Object.assign({}, srcSchema, {additionalFields: additionalFields, required: requiredFields});
	// validate the instance against the schema
	return validate(instance, schema);
};

exports.validator = require('validator');